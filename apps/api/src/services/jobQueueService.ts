import type { Db } from "../db/connection.js";
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
} from "@reel-engine/shared";
import * as stagesRepo from "../repositories/stages.js";
import * as episodesRepo from "../repositories/episodes.js";
import * as jobQueue from "../repositories/jobQueue.js";
import * as history from "../repositories/history.js";
import { getProviderConfig } from "../repositories/providerConfigs.js";
import { conflict, notFound } from "../lib/errors.js";

const ENQUEUEABLE = ["PENDING", "FAILED"];

export function enqueueStage(db: Db, stageId: string) {
  const stage = stagesRepo.getStage(db, stageId);
  if (!stage) throw notFound("Stage not found");

  const active = jobQueue.findActiveByStage(db, stageId);
  if (active) return active;

  if (!ENQUEUEABLE.includes(stage.status)) {
    throw conflict(`Cannot enqueue stage from ${stage.status}`);
  }

  const episode = episodesRepo.getEpisode(db, stage.episodeId);
  if (!episode) throw notFound("Episode not found");

  const cfg = getProviderConfig(db, episode.projectId, stage.stageType);
  const job = jobQueue.enqueue(db, {
    stageId,
    episodeId: stage.episodeId,
    stageType: stage.stageType,
    idempotencyKey: `${stageId}:${stage.status}:${stage.updatedAt}`,
    maxAttempts: cfg?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    payload: { timeoutMs: cfg?.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS },
  });

  history.addEvent(db, {
    episodeId: stage.episodeId,
    projectId: episode.projectId,
    eventType: "stage.enqueued",
    message: `Stage ${stage.stageType} enqueued`,
    metadata: { stageId, jobId: job.id },
  });

  return job;
}

export function getJob(db: Db, id: string) {
  const job = jobQueue.get(db, id);
  if (!job) throw notFound("Job not found");
  return job;
}

export function listStageJobs(db: Db, stageId: string) {
  return jobQueue.listByStage(db, stageId);
}
