import type { Db } from "../db/connection.js";
import type { PipelineStage, PipelineJob } from "@reel-engine/shared";
import { PIPELINE_STAGE_ORDER, PIPELINE_STAGE_TYPES, type PipelineStageType } from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

const mapStage = (r: any): PipelineStage => ({
  id: r.id, episodeId: r.episode_id, stageType: r.stage_type, stageOrder: r.stage_order,
  status: r.status, note: r.note, startedAt: r.started_at, completedAt: r.completed_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapJob = (r: any): PipelineJob => ({
  id: r.id, stageId: r.stage_id, status: r.status, attempt: r.attempt,
  errorMessage: r.error_message, createdAt: r.created_at, updatedAt: r.updated_at,
});

export function ensureStages(db: Db, episodeId: string): PipelineStage[] {
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT 1 FROM pipeline_stages WHERE episode_id=? LIMIT 1").get(episodeId);
    if (!existing) {
      const now = nowIso();
      const ins = db.prepare(`INSERT INTO pipeline_stages (id,episode_id,stage_type,stage_order,status,note,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)`);
      for (const t of PIPELINE_STAGE_TYPES) {
        ins.run(newId("stg"), episodeId, t, PIPELINE_STAGE_ORDER[t as PipelineStageType], "PENDING", "", now, now);
      }
    }
  });
  tx();
  return listStages(db, episodeId);
}

export function listStages(db: Db, episodeId: string): PipelineStage[] {
  return db.prepare("SELECT * FROM pipeline_stages WHERE episode_id=? ORDER BY stage_order").all(episodeId).map(mapStage);
}
export function getStage(db: Db, id: string): PipelineStage | null {
  const r = db.prepare("SELECT * FROM pipeline_stages WHERE id=?").get(id);
  return r ? mapStage(r) : null;
}
export function updateStage(db: Db, id: string, patch: Partial<Pick<PipelineStage,"status"|"note"|"startedAt"|"completedAt">>): PipelineStage | null {
  const cur = getStage(db, id); if (!cur) return null;
  db.prepare(`UPDATE pipeline_stages SET status=?,note=?,started_at=?,completed_at=?,updated_at=? WHERE id=?`)
    .run(patch.status ?? cur.status, patch.note ?? cur.note, patch.startedAt !== undefined ? patch.startedAt : cur.startedAt,
      patch.completedAt !== undefined ? patch.completedAt : cur.completedAt, nowIso(), id);
  return getStage(db, id);
}
export function createJob(db: Db, stageId: string, status: string, attempt: number, errorMessage?: string | null): PipelineJob {
  const now = nowIso(); const id = newId("job");
  db.prepare(`INSERT INTO pipeline_jobs (id,stage_id,status,attempt,error_message,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
    .run(id, stageId, status, attempt, errorMessage ?? null, now, now);
  return db.prepare("SELECT * FROM pipeline_jobs WHERE id=?").get(id) as any ? mapJob(db.prepare("SELECT * FROM pipeline_jobs WHERE id=?").get(id)) : (null as any);
}
export function latestAttempt(db: Db, stageId: string): number {
  const r = db.prepare("SELECT MAX(attempt) as m FROM pipeline_jobs WHERE stage_id=?").get(stageId) as any;
  return (r?.m as number) || 0;
}
