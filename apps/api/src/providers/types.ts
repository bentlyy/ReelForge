import type { Logger } from "pino";
import type {
  JobRequest,
  JobResult,
  PipelineStageType,
  ProviderKind,
} from "@reel-engine/shared";
import type { Db } from "../db/connection.js";

export interface ProviderContext {
  db: Db;
  logger: Logger;
  storageRoot: string;
  signal?: AbortSignal;
}

export interface IStageProvider {
  readonly stageType: PipelineStageType;
  readonly kind: ProviderKind;
  validateConfig(cfg: unknown): void;
  run(req: JobRequest, ctx: ProviderContext): Promise<JobResult>;
  cancel?(jobId: string): Promise<void>;
}

export interface ProviderConfigSource {
  getConfig(
    projectId: string | null,
    stageType: PipelineStageType,
  ): { providerKind: ProviderKind; enabled: boolean } | null;
}
