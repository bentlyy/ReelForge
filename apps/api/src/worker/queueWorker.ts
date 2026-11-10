import type { Logger } from "pino";
import type { JobRequest, JobResult, QueuedJob } from "@reel-engine/shared";
import {
  DEFAULT_WORKER_CONCURRENCY,
  DEFAULT_WORKER_LEASE_MS,
  DEFAULT_WORKER_POLL_MS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  HEAVY_STAGE_TYPES,
  jobResultSchema,
} from "@reel-engine/shared";
import type { Db } from "../db/connection.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type { ProviderContext } from "../providers/types.js";
import * as jobQueue from "../repositories/jobQueue.js";
import * as stagesRepo from "../repositories/stages.js";
import * as episodesRepo from "../repositories/episodes.js";
import * as historyRepo from "../repositories/history.js";
import { syncEpisodeStatus } from "../services/pipeline.js";
import { nowIso } from "../lib/id.js";

const BACKOFF_MS = [30_000, 120_000, 600_000];
const HEAVY = new Set<string>(HEAVY_STAGE_TYPES);
const RUNNABLE_STAGE_STATUSES = new Set(["PENDING", "FAILED", "RUNNING"]);

export interface QueueWorkerOptions {
  owner?: string;
  pollIntervalMs?: number;
  idleBackoffMs?: number;
  leaseMs?: number;
  concurrency?: number;
  timeoutMs?: number;
  retryDelayMs?: (attempt: number) => number;
}

export interface QueueWorkerDeps {
  db: Db;
  registry: ProviderRegistry;
  logger: Logger;
  storageRoot: string;
}

export class QueueWorker {
  private running = false;
  private active = 0;
  private activeHeavy = 0;
  private loopPromise: Promise<void> | null = null;

  private readonly owner: string;
  private readonly pollIntervalMs: number;
  private readonly idleBackoffMs: number;
  private readonly leaseMs: number;
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: (attempt: number) => number;

  constructor(
    private readonly deps: QueueWorkerDeps,
    opts: QueueWorkerOptions = {},
  ) {
    this.owner = opts.owner ?? `worker_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_WORKER_POLL_MS;
    this.idleBackoffMs = opts.idleBackoffMs ?? Math.max(this.pollIntervalMs, 5_000);
    this.leaseMs = opts.leaseMs ?? DEFAULT_WORKER_LEASE_MS;
    this.concurrency = Math.max(1, opts.concurrency ?? DEFAULT_WORKER_CONCURRENCY);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    this.retryDelayMs =
      opts.retryDelayMs ??
      ((attempt) => BACKOFF_MS[Math.min(Math.max(attempt - 1, 0), BACKOFF_MS.length - 1)]!);
  }

  get activeCount(): number {
    return this.active;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.loopPromise) await this.loopPromise;
    this.loopPromise = null;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      let processed = false;
      try {
        processed = await this.tickOnce();
      } catch (err) {
        this.deps.logger.error({ err }, "worker tick failed");
      }
      if (!this.running) break;
      await sleep(processed ? this.pollIntervalMs : this.idleBackoffMs);
    }
  }

  async tickOnce(): Promise<boolean> {
    if (this.active >= this.concurrency) return false;
    const excludeStageTypes = this.activeHeavy >= 1 ? HEAVY_STAGE_TYPES : undefined;
    const job = jobQueue.leaseNext(this.deps.db, this.owner, {
      leaseMs: this.leaseMs,
      excludeStageTypes,
    });
    if (!job) return false;

    const heavy = HEAVY.has(job.stageType);
    this.active++;
    if (heavy) this.activeHeavy++;
    try {
      await this.process(job);
      return true;
    } finally {
      this.active--;
      if (heavy) this.activeHeavy--;
    }
  }

  private async process(job: QueuedJob): Promise<void> {
    const running = jobQueue.markRunning(this.deps.db, job.id, this.owner);
    if (!running) return;

    const episode = episodesRepo.getEpisode(this.deps.db, running.episodeId);
    const projectId = episode?.projectId ?? null;

    if (!this.prepareStage(running, projectId)) {
      jobQueue.cancel(this.deps.db, running.id);
      this.deps.logger.info(
        { jobId: running.id, stageId: running.stageId },
        "job skipped: stage is not runnable",
      );
      return;
    }

    const provider = this.deps.registry.resolve(projectId, running.stageType);
    const controller = new AbortController();
    const ctx: ProviderContext = {
      db: this.deps.db,
      logger: this.deps.logger,
      storageRoot: this.deps.storageRoot,
      signal: controller.signal,
    };
    const req: JobRequest = {
      jobId: running.id,
      stageId: running.stageId,
      episodeId: running.episodeId,
      projectId,
      stageType: running.stageType,
      attempt: running.attempt,
      input: running.payload,
      idempotencyKey: running.idempotencyKey,
    };
    const timeoutMs = readTimeoutMs(running.payload) ?? this.timeoutMs;

    try {
      const raw = await this.withTimeout(provider.run(req, ctx), controller, timeoutMs);
      const result = jobResultSchema.parse(raw);

      if (result.status === "FAILED") {
        this.handleFailure(
          running,
          projectId,
          result.errorCode ?? "PROVIDER_ERROR",
          result.errorMessage ?? "Provider reported failure",
        );
        return;
      }

      const finished = jobQueue.complete(this.deps.db, running.id, result);
      if (!finished) {
        this.deps.logger.info(
          { jobId: running.id },
          "job result discarded: job is no longer active",
        );
        return;
      }
      this.applyResult(running, result, projectId);
      this.deps.logger.info(
        { jobId: running.id, stageType: running.stageType, status: result.status },
        "job finished",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: unknown } | null)?.code;
      this.handleFailure(
        running,
        projectId,
        typeof code === "string" ? code : "PROVIDER_ERROR",
        message,
      );
    }
  }

  private handleFailure(
    job: QueuedJob,
    projectId: string | null,
    code: string,
    message: string,
  ): void {
    const willRetry = job.attempt < job.maxAttempts;
    const delay = willRetry ? this.retryDelayMs(job.attempt) : 0;
    const failed = jobQueue.fail(this.deps.db, job.id, { code, message }, delay);
    if (!failed) {
      this.deps.logger.info(
        { jobId: job.id },
        "job failure discarded: job is no longer active",
      );
      return;
    }
    const retry = failed.status === "PENDING";
    this.applyFailure(job, retry, message, projectId);
    this.deps.logger.warn(
      { jobId: job.id, attempt: job.attempt, willRetry: retry, error: message },
      "job failed",
    );
  }

  private prepareStage(job: QueuedJob, projectId: string | null): boolean {
    const stage = stagesRepo.getStage(this.deps.db, job.stageId);
    if (!stage || !RUNNABLE_STAGE_STATUSES.has(stage.status)) return false;
    if (stage.status === "RUNNING") return true;

    stagesRepo.updateStage(this.deps.db, stage.id, {
      status: "RUNNING",
      startedAt: stage.startedAt ?? nowIso(),
      completedAt: null,
    });
    historyRepo.addEvent(this.deps.db, {
      episodeId: stage.episodeId,
      projectId,
      eventType: "stage.started",
      message: `Stage ${stage.stageType} started by worker`,
      metadata: { stageId: stage.id, jobId: job.id },
    });
    syncEpisodeStatus(this.deps.db, stage.episodeId);
    return true;
  }

  private applyResult(job: QueuedJob, result: JobResult, projectId: string | null): void {
    const stage = stagesRepo.getStage(this.deps.db, job.stageId);
    if (!stage || stage.status === "CANCELLED") return;

    if (result.status === "COMPLETED") {
      stagesRepo.updateStage(this.deps.db, stage.id, { status: "COMPLETED", completedAt: nowIso() });
      historyRepo.addEvent(this.deps.db, {
        episodeId: stage.episodeId,
        projectId,
        eventType: "stage.completed",
        message: `Stage ${stage.stageType} completed by worker`,
        metadata: { stageId: stage.id, jobId: job.id },
      });
    } else {
      stagesRepo.updateStage(this.deps.db, stage.id, { status: "WAITING_APPROVAL" });
      historyRepo.addEvent(this.deps.db, {
        episodeId: stage.episodeId,
        projectId,
        eventType: "stage.waiting_approval",
        message: `Stage ${stage.stageType} waiting approval (worker)`,
        metadata: { stageId: stage.id, jobId: job.id },
      });
    }
    syncEpisodeStatus(this.deps.db, stage.episodeId);
  }

  private applyFailure(
    job: QueuedJob,
    willRetry: boolean,
    message: string,
    projectId: string | null,
  ): void {
    const stage = stagesRepo.getStage(this.deps.db, job.stageId);
    if (!stage || stage.status === "CANCELLED") return;

    if (willRetry) {
      stagesRepo.updateStage(this.deps.db, stage.id, { status: "PENDING", note: message });
      historyRepo.addEvent(this.deps.db, {
        episodeId: stage.episodeId,
        projectId,
        eventType: "stage.retry_scheduled",
        message: `Stage ${stage.stageType} will retry`,
        metadata: { stageId: stage.id, jobId: job.id },
      });
    } else {
      stagesRepo.updateStage(this.deps.db, stage.id, { status: "FAILED", note: message });
      historyRepo.addEvent(this.deps.db, {
        episodeId: stage.episodeId,
        projectId,
        eventType: "stage.failed",
        message: `Stage ${stage.stageType} failed after retries`,
        metadata: { stageId: stage.id, jobId: job.id },
      });
    }
    syncEpisodeStatus(this.deps.db, stage.episodeId);
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    controller: AbortController,
    timeoutMs: number,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Provider timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref?.();
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function readTimeoutMs(payload: Record<string, unknown>): number | null {
  const value = payload.timeoutMs;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1_000) return null;
  return Math.trunc(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}
