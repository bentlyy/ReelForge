import type { Db } from "../db/connection.js";
import type { Asset } from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

const map = (r: any): Asset => ({
  id: r.id,
  episodeId: r.episode_id,
  stageId: r.stage_id ?? null,
  kind: r.kind,
  relativePath: r.relative_path,
  mimeType: r.mime_type ?? null,
  sizeBytes: r.size_bytes ?? null,
  createdAt: r.created_at,
});

export function listAssets(db: Db, episodeId: string): Asset[] {
  return db
    .prepare("SELECT * FROM assets WHERE episode_id=? ORDER BY created_at, id")
    .all(episodeId)
    .map(map);
}

export function getAsset(db: Db, id: string): Asset | null {
  const r = db.prepare("SELECT * FROM assets WHERE id=?").get(id);
  return r ? map(r) : null;
}

export function createAsset(
  db: Db,
  input: {
    episodeId: string;
    stageId: string | null;
    kind: string;
    relativePath: string;
    mimeType: string | null;
    sizeBytes: number;
  },
): Asset {
  const id = newId("ast");
  db.prepare(
    `INSERT INTO assets (id,episode_id,stage_id,kind,relative_path,mime_type,size_bytes,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.episodeId,
    input.stageId,
    input.kind,
    input.relativePath,
    input.mimeType,
    input.sizeBytes,
    nowIso(),
  );
  return getAsset(db, id)!;
}

export function deleteAsset(db: Db, id: string): boolean {
  return db.prepare("DELETE FROM assets WHERE id=?").run(id).changes > 0;
}
