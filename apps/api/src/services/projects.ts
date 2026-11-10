import type { Db } from "../db/connection.js";
import * as repo from "../repositories/projects.js";
import * as history from "../repositories/history.js";
import { notFound } from "../lib/errors.js";
import type { CreateProjectInput, UpdateProjectInput } from "@reel-engine/shared";

export function list(db: Db) { return repo.listProjects(db); }
export function get(db: Db, id: string) { const p = repo.getProject(db, id); if (!p) throw notFound("Project not found"); return p; }
export function create(db: Db, input: CreateProjectInput) {
  const p = repo.createProject(db, input);
  history.addEvent(db, { projectId: p.id, eventType: "project.created", message: `Project created: ${p.name}` });
  return p;
}
export function update(db: Db, id: string, input: UpdateProjectInput) {
  const p = repo.updateProject(db, id, input); if (!p) throw notFound("Project not found");
  history.addEvent(db, { projectId: p.id, eventType: "project.updated", message: `Project updated: ${p.name}` });
  return p;
}
