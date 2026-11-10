export const PROVIDER_KINDS = ["manual", "external_api", "local_cli", "stub"] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const JOB_STATUSES = ["PENDING", "LEASED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_RESULT_STATUSES = ["COMPLETED", "FAILED", "WAITING_APPROVAL"] as const;
export type JobResultStatus = (typeof JOB_RESULT_STATUSES)[number];

export const HEAVY_STAGE_TYPES = [
  "IMAGE_GENERATION",
  "VOICE_GENERATION",
  "ASSEMBLY",
  "FINAL_RENDER",
] as const;

export const DEFAULT_PROVIDER_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_WORKER_POLL_MS = 5_000;
export const DEFAULT_WORKER_LEASE_MS = 60_000;
export const DEFAULT_WORKER_CONCURRENCY = 1;
