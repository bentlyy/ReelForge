import type { Db } from "../db/connection.js";
import type { Approval } from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

const map = (r: any): Approval => ({ id: r.id, stageId: r.stage_id, decision: r.decision, note: r.note, createdAt: r.created_at });
export function createApproval(db: Db, stageId: string, decision: "APPROVED"|"REJECTED", note: string): Approval {
  const id = newId("apr"); const now = nowIso();
  db.prepare(`INSERT INTO approvals (id,stage_id,decision,note,created_at) VALUES (?,?,?,?,?)`).run(id, stageId, decision, note, now);
  return map(db.prepare("SELECT * FROM approvals WHERE id=?").get(id));
}
export function listApprovals(db: Db, stageId: string): Approval[] {
  return db.prepare("SELECT * FROM approvals WHERE stage_id=? ORDER BY created_at DESC").all(stageId).map(map);
}
