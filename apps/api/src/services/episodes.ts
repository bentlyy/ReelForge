import type { Db } from "../db/connection.js";
import * as repo from "../repositories/episodes.js";
import * as projectsRepo from "../repositories/projects.js";
import * as stagesRepo from "../repositories/stages.js";
import * as history from "../repositories/history.js";
import { notFound } from "../lib/errors.js";
import type { CreateEpisodeInput, UpdateEpisodeInput } from "@reel-engine/shared";

export function list(db: Db, projectId?: string) { return repo.listEpisodes(db, projectId); }
export function get(db: Db, id: string) {
  const e = repo.getEpisode(db, id); if (!e) throw notFound("Episode not found");
  const stages = stagesRepo.ensureStages(db, e.id);
  return { ...e, stages };
}
export function create(db: Db, input: CreateEpisodeInput) {
  const proj = projectsRepo.getProject(db, input.projectId); if (!proj) throw notFound("Project not found");
  const e = repo.createEpisode(db, input);
  stagesRepo.ensureStages(db, e.id);
  history.addEvent(db, { projectId: e.projectId, episodeId: e.id, eventType: "episode.created", message: `Episode created: ${e.title}` });
  return get(db, e.id);
}
export function update(db: Db, id: string, input: UpdateEpisodeInput) {
  const e = repo.updateEpisode(db, id, input); if (!e) throw notFound("Episode not found");
  history.addEvent(db, { projectId: e.projectId, episodeId: e.id, eventType: "episode.updated", message: `Episode updated: ${e.title}` });
  return get(db, e.id);
}
