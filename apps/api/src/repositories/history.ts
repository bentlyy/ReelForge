import type { Db } from "../db/connection.js";
import type { ActivityEvent } from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

export function addEvent(db: Db, e: { episodeId?: string|null; projectId?: string|null; eventType: string; message: string; metadata?: Record<string,unknown> }): void {
  db.prepare(`INSERT INTO activity_events (id,episode_id,project_id,event_type,message,metadata_json,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(newId("evt"), e.episodeId ?? null, e.projectId ?? null, e.eventType, e.message, JSON.stringify(e.metadata ?? {}), nowIso());
}
const map = (r: any): ActivityEvent => ({ id: r.id, episodeId: r.episode_id, projectId: r.project_id, eventType: r.event_type, message: r.message, metadata: JSON.parse(r.metadata_json||"{}"), createdAt: r.created_at });
export function listHistory(db: Db, episodeId?: string, projectId?: string): ActivityEvent[] {
  if (episodeId) return db.prepare("SELECT * FROM activity_events WHERE episode_id=? ORDER BY created_at DESC LIMIT 200").all(episodeId).map(map);
  if (projectId) return db.prepare("SELECT * FROM activity_events WHERE project_id=? ORDER BY created_at DESC LIMIT 200").all(projectId).map(map);
  return db.prepare("SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 200").all().map(map);
}
