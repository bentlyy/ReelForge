import { describe, it, expect } from "vitest";
import request from "supertest";
import pino from "pino";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { JobRequest, JobResult, PipelineStageType } from "@reel-engine/shared";
import { safeRelativePathSchema, stageProviderConfigSchema } from "@reel-engine/shared";
import { app, db } from "./setup.js";
import { createDefaultRegistry } from "../providers/registry.js";
import type { IStageProvider, ProviderContext } from "../providers/types.js";
import { StorageService } from "../lib/storage.js";
import * as jobQueue from "../repositories/jobQueue.js";
import * as stagesRepo from "../repositories/stages.js";
import { QueueWorker } from "../worker/queueWorker.js";

const logger = pino({ level: "silent" });

async function mkEpisode() {
  const projectId = (await request(app).post("/api/projects").send({ name: "P" })).body.data.id;
  const episode = (await request(app).post("/api/episodes").send({ projectId, title: "E" })).body
    .data;
  return { projectId, episodeId: episode.id as string, stage: episode.stages[0], stages: episode.stages };
}

class FailingProvider implements IStageProvider {
  readonly kind = "stub" as const;

  constructor(readonly stageType: PipelineStageType) {}

  validateConfig(): void {}

  async run(): Promise<JobResult> {
    return { status: "FAILED", errorCode: "NOPE", errorMessage: "provider failed" };
  }
}

class InvalidResultProvider implements IStageProvider {
  readonly kind = "stub" as const;

  constructor(readonly stageType: PipelineStageType) {}

  validateConfig(): void {}

  async run(): Promise<JobResult> {
    return { status: "COMPLETED", extra: true } as unknown as JobResult;
  }
}

class TrackingProvider implements IStageProvider {
  readonly kind = "stub" as const;

  constructor(
    readonly stageType: PipelineStageType,
    private readonly state: { active: number; max: number },
    private readonly delayMs = 40,
  ) {}

  validateConfig(): void {}

  async run(_req: JobRequest, _ctx: ProviderContext): Promise<JobResult> {
    this.state.active++;
    this.state.max = Math.max(this.state.max, this.state.active);
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.state.active--;
    return { status: "COMPLETED", output: { ok: true } };
  }
}

describe("shared provider contracts", () => {
  it("rejects secret-looking provider configs", () => {
    expect(
      stageProviderConfigSchema.safeParse({ stageType: "SCRIPT", providerKind: "stub" }).success,
    ).toBe(true);
    expect(
      stageProviderConfigSchema.safeParse({
        stageType: "SCRIPT",
        providerKind: "stub",
        apiKey: "sk-123",
      }).success,
    ).toBe(false);
    expect(
      stageProviderConfigSchema.safeParse({
        stageType: "SCRIPT",
        providerKind: "stub",
        configRef: "sk-live-secret",
      }).success,
    ).toBe(false);
    expect(
      stageProviderConfigSchema.safeParse({
        stageType: "SCRIPT",
        providerKind: "manual",
        configRef: "MY_API_KEY",
      }).success,
    ).toBe(true);
  });

  it("rejects unsafe relative asset paths", () => {
    const bad = ["../etc/passwd", "/etc/passwd", "C:/x", "a/../../b", "a\\b", "a//b", "./a", ""];
    for (const p of bad) {
      expect(safeRelativePathSchema.safeParse(p).success, p).toBe(false);
    }
    expect(safeRelativePathSchema.safeParse("episodes/abc/script/a.txt").success).toBe(true);
  });
});

describe("storage sanitization", () => {
  it("blocks traversal and resolves safe files under the episode dir", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "reel-storage-"));
    try {
      const svc = new StorageService(root);
      expect(() => svc.resolveEpisodeFile("../evil", "SCRIPT", "a.txt")).toThrow();
      expect(() => svc.resolveEpisodeFile("ep1", "SCRIPT", "../secret")).toThrow();
      expect(() => svc.resolveEpisodeFile("ep1", "SCRIPT", "a/b.txt")).toThrow();
      const full = svc.resolveEpisodeFile("ep1", "SCRIPT", "scene.txt");
      expect(full).toContain(path.join("episodes", "ep1", "script", "scene.txt"));
      expect(full.startsWith(path.resolve(root) + path.sep)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("provider registry", () => {
  it("resolves configured provider and falls back to stub", () => {
    const registry = createDefaultRegistry({
      configSource: {
        getConfig: (_projectId, stageType) =>
          stageType === "SCRIPT"
            ? { providerKind: "manual", enabled: true }
            : { providerKind: "external_api", enabled: true },
      },
    });
    expect(registry.resolve("p1", "SCRIPT").kind).toBe("manual");
    expect(registry.resolve("p1", "ASSEMBLY").kind).toBe("stub");
  });

  it("uses stub when config is disabled", () => {
    const registry = createDefaultRegistry({
      configSource: { getConfig: () => ({ providerKind: "manual", enabled: false }) },
    });
    expect(registry.resolve("p1", "SCRIPT").kind).toBe("stub");
  });
});

describe("job queue", () => {
  it("is idempotent per idempotency key", async () => {
    const { episodeId, stage } = await mkEpisode();
    const base = {
      stageId: stage.id as string,
      episodeId,
      stageType: stage.stageType as PipelineStageType,
      maxAttempts: 2,
    };
    const a = jobQueue.enqueue(db, { ...base, idempotencyKey: "key-1" });
    const b = jobQueue.enqueue(db, { ...base, idempotencyKey: "key-1" });
    expect(b.id).toBe(a.id);
    expect(jobQueue.listByStage(db, stage.id)).toHaveLength(1);
  });

  it("lease prevents duplicate processing and reclaims expired leases", async () => {
    const { episodeId, stage } = await mkEpisode();
    const t0 = new Date().toISOString();
    const job = jobQueue.enqueue(db, {
      stageId: stage.id,
      episodeId,
      stageType: stage.stageType as PipelineStageType,
      idempotencyKey: "lease-1",
      runAfter: t0,
    });

    const first = jobQueue.leaseNext(db, "owner-a", { leaseMs: 60_000, now: t0 });
    expect(first?.id).toBe(job.id);
    expect(first?.status).toBe("LEASED");
    expect(first?.attempt).toBe(1);

    expect(jobQueue.leaseNext(db, "owner-b", { leaseMs: 60_000, now: t0 })).toBeNull();

    const afterExpiry = new Date(Date.parse(t0) + 60_001).toISOString();
    const reclaimed = jobQueue.leaseNext(db, "owner-b", { leaseMs: 60_000, now: afterExpiry });
    expect(reclaimed?.id).toBe(job.id);
    expect(reclaimed?.attempt).toBe(2);
  });

  it("enqueues via HTTP and returns active job on repeat", async () => {
    const { stage } = await mkEpisode();
    const r1 = await request(app).post(`/api/stages/${stage.id}/enqueue`).send();
    expect(r1.status).toBe(202);
    expect(r1.body.data.status).toBe("PENDING");
    expect(typeof r1.body.data.payload.timeoutMs).toBe("number");

    const r2 = await request(app).post(`/api/stages/${stage.id}/enqueue`).send();
    expect(r2.body.data.id).toBe(r1.body.data.id);

    const listed = await request(app).get(`/api/stages/${stage.id}/jobs`);
    expect(listed.body.data).toHaveLength(1);

    const byId = await request(app).get(`/api/jobs/${r1.body.data.id}`);
    expect(byId.body.data.id).toBe(r1.body.data.id);
  });

  it("rejects enqueue from a cancelled stage and cancels its active job", async () => {
    const { stage } = await mkEpisode();
    const r1 = await request(app).post(`/api/stages/${stage.id}/enqueue`).send();
    expect(r1.status).toBe(202);

    const cancel = await request(app)
      .post(`/api/stages/${stage.id}/actions`)
      .send({ action: "cancel", note: "stop" });
    expect(cancel.status).toBe(200);
    expect(jobQueue.get(db, r1.body.data.id)?.status).toBe("CANCELLED");

    const r2 = await request(app).post(`/api/stages/${stage.id}/enqueue`).send();
    expect(r2.status).toBe(409);
  });

  it("ignores completion/failure of cancelled jobs", async () => {
    const { episodeId, stage } = await mkEpisode();
    const now = new Date().toISOString();
    const job = jobQueue.enqueue(db, {
      stageId: stage.id,
      episodeId,
      stageType: stage.stageType as PipelineStageType,
      idempotencyKey: "guard-1",
      runAfter: now,
    });
    const leased = jobQueue.leaseNext(db, "w", { leaseMs: 60_000, now });
    expect(leased?.id).toBe(job.id);

    jobQueue.cancel(db, job.id);
    expect(jobQueue.complete(db, job.id, { status: "COMPLETED" })).toBeNull();
    expect(jobQueue.fail(db, job.id, { message: "late" }, 0)).toBeNull();
    expect(jobQueue.get(db, job.id)?.status).toBe("CANCELLED");
  });

  it("retries until max attempts then fails", async () => {
    const { episodeId, stage } = await mkEpisode();
    const now = new Date().toISOString();
    const job = jobQueue.enqueue(db, {
      stageId: stage.id,
      episodeId,
      stageType: stage.stageType as PipelineStageType,
      idempotencyKey: "retry-1",
      maxAttempts: 2,
      runAfter: now,
    });

    const l1 = jobQueue.leaseNext(db, "w", { leaseMs: 60_000, now });
    expect(l1?.attempt).toBe(1);
    const f1 = jobQueue.fail(db, job.id, { message: "boom" }, 0);
    expect(f1?.status).toBe("PENDING");

    const later = new Date(Date.now() + 1_000).toISOString();
    const l2 = jobQueue.leaseNext(db, "w", { leaseMs: 60_000, now: later });
    expect(l2?.attempt).toBe(2);
    const f2 = jobQueue.fail(db, job.id, { message: "boom" }, 0);
    expect(f2?.status).toBe("FAILED");
  });
});

describe("queue worker", () => {
  it("processes a stub job and moves the stage to WAITING_APPROVAL", async () => {
    const { episodeId, stage } = await mkEpisode();
    const job = jobQueue.enqueue(db, {
      stageId: stage.id,
      episodeId,
      stageType: stage.stageType as PipelineStageType,
      idempotencyKey: "worker-stub-1",
      runAfter: new Date().toISOString(),
    });

    const worker = new QueueWorker(
      { db, registry: createDefaultRegistry(), logger, storageRoot: os.tmpdir() },
      { owner: "test-worker", concurrency: 1, timeoutMs: 5_000 },
    );

    const processed = await worker.tickOnce();
    expect(processed).toBe(true);
    expect(jobQueue.get(db, job.id)?.status).toBe("SUCCEEDED");
    expect(stagesRepo.getStage(db, stage.id)?.status).toBe("WAITING_APPROVAL");
  });

  it("enforces concurrency = 1", async () => {
    const a = await mkEpisode();
    const b = await mkEpisode();
    const now = new Date().toISOString();

    const jobA = jobQueue.enqueue(db, {
      stageId: a.stage.id,
      episodeId: a.episodeId,
      stageType: a.stage.stageType as PipelineStageType,
      idempotencyKey: "conc-a",
      runAfter: now,
    });
    const jobB = jobQueue.enqueue(db, {
      stageId: b.stage.id,
      episodeId: b.episodeId,
      stageType: b.stage.stageType as PipelineStageType,
      idempotencyKey: "conc-b",
      runAfter: now,
    });

    const state = { active: 0, max: 0 };
    const registry = createDefaultRegistry();
    registry.register(new TrackingProvider("SCRIPT" as PipelineStageType, state, 50));

    const worker = new QueueWorker(
      { db, registry, logger, storageRoot: os.tmpdir() },
      { owner: "conc-worker", concurrency: 1, timeoutMs: 5_000 },
    );

    const results = await Promise.all([worker.tickOnce(), worker.tickOnce()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(state.max).toBe(1);

    await worker.tickOnce();
    expect(state.max).toBe(1);
    expect(jobQueue.get(db, jobA.id)?.status).toBe("SUCCEEDED");
    expect(jobQueue.get(db, jobB.id)?.status).toBe("SUCCEEDED");
  });

  it("runs at most one heavy stage at a time with concurrency 2", async () => {
    const a = await mkEpisode();
    const b = await mkEpisode();
    const heavyA = a.stages.find((s: any) => s.stageType === "IMAGE_GENERATION")!;
    const heavyB = b.stages.find((s: any) => s.stageType === "IMAGE_GENERATION")!;
    const now = new Date().toISOString();

    const jobA = jobQueue.enqueue(db, {
      stageId: heavyA.id,
      episodeId: a.episodeId,
      stageType: "IMAGE_GENERATION",
      idempotencyKey: "heavy-a",
      runAfter: now,
    });
    const jobB = jobQueue.enqueue(db, {
      stageId: heavyB.id,
      episodeId: b.episodeId,
      stageType: "IMAGE_GENERATION",
      idempotencyKey: "heavy-b",
      runAfter: now,
    });

    const state = { active: 0, max: 0 };
    const registry = createDefaultRegistry();
    registry.register(new TrackingProvider("IMAGE_GENERATION", state, 50));

    const worker = new QueueWorker(
      { db, registry, logger, storageRoot: os.tmpdir() },
      { owner: "heavy-worker", concurrency: 2, timeoutMs: 5_000 },
    );

    const results = await Promise.all([worker.tickOnce(), worker.tickOnce()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(state.max).toBe(1);

    await worker.tickOnce();
    expect(state.max).toBe(1);
    expect(jobQueue.get(db, jobA.id)?.status).toBe("SUCCEEDED");
    expect(jobQueue.get(db, jobB.id)?.status).toBe("SUCCEEDED");
  });

  it("treats provider-reported FAILED as a retriable job failure", async () => {
    const { episodeId, stage } = await mkEpisode();
    const job = jobQueue.enqueue(db, {
      stageId: stage.id,
      episodeId,
      stageType: stage.stageType as PipelineStageType,
      idempotencyKey: "failed-result-1",
      maxAttempts: 1,
      runAfter: new Date().toISOString(),
    });

    const registry = createDefaultRegistry();
    registry.register(new FailingProvider(stage.stageType as PipelineStageType));
    const worker = new QueueWorker(
      { db, registry, logger, storageRoot: os.tmpdir() },
      { owner: "fail-worker", concurrency: 1, timeoutMs: 5_000 },
    );

    expect(await worker.tickOnce()).toBe(true);
    const stored = jobQueue.get(db, job.id);
    expect(stored?.status).toBe("FAILED");
    expect(stored?.errorCode).toBe("NOPE");
    expect(stagesRepo.getStage(db, stage.id)?.status).toBe("FAILED");
  });

  it("rejects invalid provider results via the shared schema", async () => {
    const { episodeId, stage } = await mkEpisode();
    const job = jobQueue.enqueue(db, {
      stageId: stage.id,
      episodeId,
      stageType: stage.stageType as PipelineStageType,
      idempotencyKey: "invalid-result-1",
      maxAttempts: 1,
      runAfter: new Date().toISOString(),
    });

    const registry = createDefaultRegistry();
    registry.register(new InvalidResultProvider(stage.stageType as PipelineStageType));
    const worker = new QueueWorker(
      { db, registry, logger, storageRoot: os.tmpdir() },
      { owner: "invalid-worker", concurrency: 1, timeoutMs: 5_000 },
    );

    expect(await worker.tickOnce()).toBe(true);
    const stored = jobQueue.get(db, job.id);
    expect(stored?.status).toBe("FAILED");
    expect(stored?.errorMessage ?? "").toContain("Unrecognized");
  });
});
