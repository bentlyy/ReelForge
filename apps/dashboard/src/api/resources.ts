import { apiFetch } from "./client";
import type { Project, Episode, PipelineStage, Approval, ActivityEvent, ApiList, ApiItem } from "@reel-engine/shared";

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
export const pipelineApi = {
  runStub: (stageId: string) => apiFetch<ApiItem<PipelineStage>>(`/stages/${stageId}/run-stub`, { method: "POST" }),
  action: (stageId: string, action: string, note = "") => apiFetch<ApiItem<PipelineStage>>(`/stages/${stageId}/actions`, { method: "POST", body: JSON.stringify({ action, note }) }),
  approvals: (stageId: string) => apiFetch<ApiList<Approval>>(`/approvals/stage/${stageId}`),
  history: (episodeId?: string) => apiFetch<ApiList<ActivityEvent>>(`/history${episodeId ? `?episodeId=${episodeId}` : ""}`),
};
