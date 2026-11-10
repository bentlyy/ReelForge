export const PIPELINE_STAGE_TYPES = [
  "SCRIPT",
  "SCENE_PLANNING",
  "IMAGE_GENERATION",
  "VOICE_GENERATION",
  "SUBTITLES",
  "ASSEMBLY",
  "FINAL_RENDER",
] as const;

export type PipelineStageType = (typeof PIPELINE_STAGE_TYPES)[number];

export const PIPELINE_STAGE_ORDER: Record<PipelineStageType, number> = {
  SCRIPT: 1,
  SCENE_PLANNING: 2,
  IMAGE_GENERATION: 3,
  VOICE_GENERATION: 4,
  SUBTITLES: 5,
  ASSEMBLY: 6,
  FINAL_RENDER: 7,
};

export const PIPELINE_STATUSES = [
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const APPROVAL_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
