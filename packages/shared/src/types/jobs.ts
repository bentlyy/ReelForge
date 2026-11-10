import type { PipelineStageType } from "../constants/pipeline.js";
import type { JobStatus, ProviderKind } from "../constants/providers.js";
import type { JobResult } from "../schemas/provider.js";

export interface JobRequest {
  jobId: string;
  stageId: string;
  episodeId: string;
  projectId: string | null;
  stageType: PipelineStageType;
  attempt: number;
  input: Record<string, unknown>;
  idempotencyKey: string;
}

export interface QueuedJob {
  id: string;
  stageId: string;
  episodeId: string;
  stageType: PipelineStageType;
  idempotencyKey: string;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  runAfter: string;
  payload: Record<string, unknown>;
  result: JobResult | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderRef {
  providerKind: ProviderKind;
  enabled: boolean;
}
