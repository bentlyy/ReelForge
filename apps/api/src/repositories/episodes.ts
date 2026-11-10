import type { Db } from "../db/connection.js";
import type { Episode } from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

const map = (r: any): Episode => ({
  id: r.id, projectId: r.project_id, title: r.title, synopsis: r.synopsis,
  status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
});

export function listEpisodes(db: Db, projectId?: string): Episode[] {
  if (projectId) return db.prepare("SELECT * FROM episodes WHERE project_id=? ORDER BY updated_at DESC").all(projectId).map(map);
  return db.prepare("SELECT * FROM episodes ORDER BY updated_at DESC").all().map(map);
}
export function getEpisode(db: Db, id: string): Episode | null {
  const r = db.prepare("SELECT * FROM episodes WHERE id = ?").get(id);
  return r ? map(r) : null;
}
export function createEpisode(db: Db, input: { projectId: string; title: string; synopsis: string }): Episode {
  const now = nowIso(); const id = newId("ep");
  db.prepare(`INSERT INTO episodes (id,project_id,title,synopsis,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(id, input.projectId, input.title, input.synopsis, "PENDING", now, now);
  return getEpisode(db, id)!;
}
export function updateEpisode(db: Db, id: string, patch: Partial<{ title: string; synopsis: string; status: string }>): Episode | null {
  const cur = getEpisode(db, id); if (!cur) return null;
  const next = { title: cur.title, synopsis: cur.synopsis, status: cur.status, ...patch };
  db.prepare(`UPDATE episodes SET title=?,synopsis=?,status=?,updated_at=? WHERE id=?`)
    .run(next.title, next.synopsis, next.status, nowIso(), id);
  return getEpisode(db, id);
}
