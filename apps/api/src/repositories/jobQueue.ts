import type { Db } from "../db/connection.js";
import type {
  JobResult,
  PipelineStageType,
  QueuedJob,
} from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

const TERMINAL = ["SUCCEEDED", "FAILED", "CANCELLED"];
const ACTIVE = ["LEASED", "RUNNING"];

const map = (r: any): QueuedJob => ({
  id: r.id,
  stageId: r.stage_id,
  episodeId: r.episode_id,
  stageType: r.stage_type,
  idempotencyKey: r.idempotency_key,
  status: r.status,
  attempt: r.attempt,
  maxAttempts: r.max_attempts,
  leaseOwner: r.lease_owner,
  leaseExpiresAt: r.lease_expires_at,
  runAfter: r.run_after,
  payload: JSON.parse(r.payload_json || "{}"),
  result: r.result_json ? JSON.parse(r.result_json) : null,
  errorCode: r.error_code,
  errorMessage: r.error_message,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface EnqueueInput {
  stageId: string;
  episodeId: string;
  stageType: PipelineStageType;
  idempotencyKey: string;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
  runAfter?: string;
}

export function enqueue(db: Db, input: EnqueueInput): QueuedJob {
  const now = nowIso();
  db.prepare(
    `INSERT INTO job_queue
      (id, stage_id, episode_id, stage_type, idempotency_key, status, attempt, max_attempts, run_after, payload_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(idempotency_key) DO NOTHING`,
  ).run(
    newId("job"),
    input.stageId,
    input.episodeId,
    input.stageType,
    input.idempotencyKey,
    "PENDING",
    0,
    input.maxAttempts ?? 3,
    input.runAfter ?? now,
    JSON.stringify(input.payload ?? {}),
    now,
    now,
  );
  return getByIdempotencyKey(db, input.idempotencyKey)!;
}

export function getByIdempotencyKey(db: Db, key: string): QueuedJob | null {
  const row = db.prepare("SELECT * FROM job_queue WHERE idempotency_key=?").get(key);
  return row ? map(row) : null;
}

export function get(db: Db, id: string): QueuedJob | null {
  const row = db.prepare("SELECT * FROM job_queue WHERE id=?").get(id);
  return row ? map(row) : null;
}

export function findActiveByStage(db: Db, stageId: string): QueuedJob | null {
  const row = db
    .prepare(
      `SELECT * FROM job_queue
       WHERE stage_id=? AND status NOT IN ('SUCCEEDED','FAILED','CANCELLED')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(stageId);
  return row ? map(row) : null;
}

export function listByStage(db: Db, stageId: string): QueuedJob[] {
  return db
    .prepare("SELECT * FROM job_queue WHERE stage_id=? ORDER BY created_at DESC")
    .all(stageId)
    .map(map);
}

export function leaseNext(
  db: Db,
  owner: string,
  opts: { leaseMs: number; now?: string; excludeStageTypes?: readonly string[] },
): QueuedJob | null {
  const now = opts.now ?? nowIso();
  const expires = new Date(Date.parse(now) + opts.leaseMs).toISOString();
  const excluded = opts.excludeStageTypes ?? [];
  const exclusion = excluded.length
    ? ` AND stage_type NOT IN (${excluded.map(() => "?").join(",")})`
    : "";

  const tx = db.transaction(() => {
    const candidate = db
      .prepare(
        `SELECT id FROM job_queue
         WHERE ((status='PENDING' AND run_after<=?)
            OR (status='LEASED' AND lease_expires_at IS NOT NULL AND lease_expires_at<=?))${exclusion}
         ORDER BY run_after ASC, created_at ASC
         LIMIT 1`,
      )
      .get(now, now, ...excluded) as { id: string } | undefined;
    if (!candidate) return null;

    const res = db
      .prepare(
        `UPDATE job_queue
         SET status='LEASED', lease_owner=?, lease_expires_at=?, attempt=attempt+1, updated_at=?
         WHERE id=?
           AND ((status='PENDING' AND run_after<=?)
             OR (status='LEASED' AND lease_expires_at IS NOT NULL AND lease_expires_at<=?))${exclusion}`,
      )
      .run(owner, expires, now, candidate.id, now, now, ...excluded);
    if (res.changes !== 1) return null;
    return get(db, candidate.id);
  });
  return tx();
}

export function markRunning(db: Db, id: string, owner: string): QueuedJob | null {
  const res = db
    .prepare(
      `UPDATE job_queue SET status='RUNNING', updated_at=? WHERE id=? AND status='LEASED' AND lease_owner=?`,
    )
    .run(nowIso(), id, owner);
  return res.changes === 1 ? get(db, id) : null;
}

export function complete(db: Db, id: string, result: JobResult): QueuedJob | null {
  const placeholders = ACTIVE.map(() => "?").join(",");
  const res = db
    .prepare(
      `UPDATE job_queue
       SET status='SUCCEEDED', result_json=?, error_code=NULL, error_message=NULL,
           lease_owner=NULL, lease_expires_at=NULL, updated_at=?
       WHERE id=? AND status IN (${placeholders})`,
    )
    .run(JSON.stringify(result), nowIso(), id, ...ACTIVE);
  return res.changes === 1 ? get(db, id) : null;
}

export function fail(
  db: Db,
  id: string,
  error: { code?: string; message: string },
  retryDelayMs = 0,
): QueuedJob | null {
  const job = get(db, id);
  if (!job || !ACTIVE.includes(job.status)) return null;
  const now = nowIso();
  const isFinal = job.attempt >= job.maxAttempts;
  const placeholders = ACTIVE.map(() => "?").join(",");

  if (isFinal) {
    const res = db
      .prepare(
        `UPDATE job_queue
         SET status='FAILED', error_code=?, error_message=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=?
         WHERE id=? AND status IN (${placeholders})`,
      )
      .run(error.code ?? "PROVIDER_ERROR", error.message, now, id, ...ACTIVE);
    return res.changes === 1 ? get(db, id) : null;
  }

  const runAfter = new Date(Date.parse(now) + retryDelayMs).toISOString();
  const res = db
    .prepare(
      `UPDATE job_queue
       SET status='PENDING', run_after=?, error_code=?, error_message=?,
           lease_owner=NULL, lease_expires_at=NULL, updated_at=?
       WHERE id=? AND status IN (${placeholders})`,
    )
    .run(runAfter, error.code ?? "PROVIDER_ERROR", error.message, now, id, ...ACTIVE);
  return res.changes === 1 ? get(db, id) : null;
}

export function cancel(db: Db, id: string): QueuedJob | null {
  const placeholders = TERMINAL.map(() => "?").join(",");
  db.prepare(
    `UPDATE job_queue
     SET status='CANCELLED', lease_owner=NULL, lease_expires_at=NULL, updated_at=?
     WHERE id=? AND status NOT IN (${placeholders})`,
  ).run(nowIso(), id, ...TERMINAL);
  return get(db, id);
}

export function cancelActiveByStage(db: Db, stageId: string): number {
  const placeholders = TERMINAL.map(() => "?").join(",");
  const res = db
    .prepare(
      `UPDATE job_queue
       SET status='CANCELLED', lease_owner=NULL, lease_expires_at=NULL, updated_at=?
       WHERE stage_id=? AND status NOT IN (${placeholders})`,
    )
    .run(nowIso(), stageId, ...TERMINAL);
  return res.changes;
}
