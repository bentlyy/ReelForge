import type { Db } from "../db/connection.js";
import type { Project } from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

const map = (r: any): Project => ({
  id: r.id, name: r.name, description: r.description, platform: r.platform,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export function listProjects(db: Db): Project[] {
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all().map(map);
}
export function getProject(db: Db, id: string): Project | null {
  const r = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return r ? map(r) : null;
}
export function createProject(db: Db, input: { name: string; description: string; platform: string }): Project {
  const now = nowIso(); const id = newId("prj");
  db.prepare(`INSERT INTO projects (id,name,description,platform,created_at,updated_at)
    VALUES (?,?,?,?,?,?)`).run(id, input.name, input.description, input.platform, now, now);
  return getProject(db, id)!;
}
export function updateProject(db: Db, id: string, patch: Partial<{ name: string; description: string; platform: string }>): Project | null {
  const cur = getProject(db, id); if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: nowIso() };
  db.prepare(`UPDATE projects SET name=?,description=?,platform=?,updated_at=? WHERE id=?`)
    .run(next.name, next.description, next.platform, next.updatedAt, id);
  return getProject(db, id);
}
export function deleteProject(db: Db, id: string): boolean {
  return db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
}
