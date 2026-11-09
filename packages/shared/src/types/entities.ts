import type { PipelineStageType, PipelineStatus, ApprovalDecision } from "../constants/pipeline.js";

export interface Project {
  id: string;
  name: string;
  description: string;
  platform: "youtube_shorts" | "instagram_reels" | "generic_vertical";
  createdAt: string;
  updatedAt: string;
}

export interface Episode {
  id: string;
  projectId: string;
  title: string;
  synopsis: string;
  status: PipelineStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  episodeId: string;
  stageType: PipelineStageType;
  stageOrder: number;
  status: PipelineStatus;
  note: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineJob {
  id: string;
  stageId: string;
  status: PipelineStatus;
  attempt: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  stageId: string;
  decision: ApprovalDecision;
  note: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  episodeId: string;
  stageId: string | null;
  kind: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  episodeId: string | null;
  projectId: string | null;
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
