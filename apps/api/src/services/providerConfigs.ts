import type { Db } from "../db/connection.js";
import type {
  PipelineStageType,
  StageProviderConfig,
  StageProviderConfigUpdate,
} from "@reel-engine/shared";
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  PIPELINE_STAGE_TYPES,
} from "@reel-engine/shared";
import * as repo from "../repositories/providerConfigs.js";
import * as projectsRepo from "../repositories/projects.js";
import { notFound } from "../lib/errors.js";

function defaultConfig(stageType: PipelineStageType): StageProviderConfig {
  return {
    stageType,
    providerKind: "stub",
    enabled: true,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
  };
}

function assertProject(db: Db, projectId: string | null) {
  if (projectId !== null && !projectsRepo.getProject(db, projectId)) {
    throw notFound("Project not found");
  }
}

export function getProviderConfigView(db: Db, projectId: string | null) {
  assertProject(db, projectId);
  const configs = repo.listProviderConfigs(db, projectId);
  const effective = PIPELINE_STAGE_TYPES.map(
    (stageType) => repo.getProviderConfig(db, projectId, stageType) ?? defaultConfig(stageType),
  );
  return { projectId, configs, effective };
}

export function upsertProviderConfig(
  db: Db,
  projectId: string | null,
  stageType: PipelineStageType,
  input: StageProviderConfigUpdate,
) {
  assertProject(db, projectId);
  return repo.upsertProviderConfig(db, projectId, { stageType, ...input });
}

export function deleteProviderConfig(
  db: Db,
  projectId: string | null,
  stageType: PipelineStageType,
) {
  assertProject(db, projectId);
  return { removed: repo.deleteProviderConfig(db, projectId, stageType) };
}
