import { apiFetch } from "./client";
import type {
  Project,
  Episode,
  PipelineStage,
  Approval,
  ActivityEvent,
  ApiList,
  ApiItem,
  ProviderConfigView,
  StageProviderConfigUpdate,
  Asset,
  CreateAssetInput,
  QueuedJob,
} from "@reel-engine/shared";

export const projectsApi = {
  list: () => apiFetch<ApiList<Project>>("/projects"),
  get: (id: string) => apiFetch<ApiItem<Project>>(`/projects/${id}`),
  create: (body: any) => apiFetch<ApiItem<Project>>("/projects", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) => apiFetch<ApiItem<Project>>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
export const episodesApi = {
  list: (projectId?: string) => apiFetch<ApiList<Episode>>(`/episodes${projectId ? `?projectId=${projectId}` : ""}`),
  get: (id: string) => apiFetch<ApiItem<Episode & { stages: PipelineStage[] }>>(`/episodes/${id}`),
  create: (body: any) => apiFetch<ApiItem<Episode & { stages: PipelineStage[] }>>("/episodes", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) => apiFetch<ApiItem<Episode & { stages: PipelineStage[] }>>(`/episodes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
const scopeQuery = (projectId?: string | null) =>
  projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

export const providerConfigsApi = {
  list: (projectId?: string | null) =>
    apiFetch<ApiItem<ProviderConfigView>>(`/provider-configs${scopeQuery(projectId)}`),
  upsert: (stageType: string, body: StageProviderConfigUpdate, projectId?: string | null) =>
    apiFetch<ApiItem<unknown>>(`/provider-configs/${stageType}${scopeQuery(projectId)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (stageType: string, projectId?: string | null) =>
    apiFetch<ApiItem<{ removed: boolean }>>(
      `/provider-configs/${stageType}${scopeQuery(projectId)}`,
      { method: "DELETE" },
    ),
};

export const assetsApi = {
  list: (episodeId: string) => apiFetch<ApiList<Asset>>(`/episodes/${episodeId}/assets`),
  create: (episodeId: string, body: CreateAssetInput) =>
    apiFetch<ApiItem<Asset>>(`/episodes/${episodeId}/assets`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (episodeId: string, assetId: string) =>
    apiFetch<ApiItem<{ removed: boolean }>>(`/episodes/${episodeId}/assets/${assetId}`, {
      method: "DELETE",
    }),
};

export const jobsApi = {
  listByStage: (stageId: string) =>
    apiFetch<ApiList<QueuedJob>>(`/stages/${stageId}/jobs`),
  get: (jobId: string) => apiFetch<ApiItem<QueuedJob>>(`/jobs/${jobId}`),
};

export const pipelineApi = {
  runStub: (stageId: string) => apiFetch<ApiItem<PipelineStage>>(`/stages/${stageId}/run-stub`, { method: "POST" }),
  action: (stageId: string, action: string, note = "") => apiFetch<ApiItem<PipelineStage>>(`/stages/${stageId}/actions`, { method: "POST", body: JSON.stringify({ action, note }) }),
  enqueue: (stageId: string) => apiFetch<ApiItem<QueuedJob>>(`/stages/${stageId}/enqueue`, { method: "POST" }),
  approvals: (stageId: string) => apiFetch<ApiList<Approval>>(`/approvals/stage/${stageId}`),
  history: (episodeId?: string) => apiFetch<ApiList<ActivityEvent>>(`/history${episodeId ? `?episodeId=${episodeId}` : ""}`),
};
