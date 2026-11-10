import type { Db } from "../db/connection.js";
import type {
  PipelineStageType,
  StageProviderConfig,
} from "@reel-engine/shared";
import { newId, nowIso } from "../lib/id.js";

const map = (r: any): StageProviderConfig => ({
  stageType: r.stage_type,
  providerKind: r.provider_kind,
  enabled: r.enabled === 1,
  configRef: r.config_ref ?? undefined,
  timeoutMs: r.timeout_ms,
  maxAttempts: r.max_attempts,
});

export function getProviderConfig(
  db: Db,
  projectId: string | null,
  stageType: PipelineStageType,
): StageProviderConfig | null {
  if (projectId) {
    const row = db
      .prepare("SELECT * FROM provider_configs WHERE stage_type=? AND project_id=? LIMIT 1")
      .get(stageType, projectId);
    if (row) return map(row);
  }
  const fallback = db
    .prepare("SELECT * FROM provider_configs WHERE stage_type=? AND project_id IS NULL LIMIT 1")
    .get(stageType);
  return fallback ? map(fallback) : null;
}

export function listProviderConfigs(db: Db, projectId?: string | null): StageProviderConfig[] {
  if (projectId) {
    return db
      .prepare("SELECT * FROM provider_configs WHERE project_id=? ORDER BY stage_type")
      .all(projectId)
      .map(map);
  }
  return db.prepare("SELECT * FROM provider_configs ORDER BY stage_type").all().map(map);
}

export function upsertProviderConfig(
  db: Db,
  projectId: string | null,
  config: StageProviderConfig,
): StageProviderConfig {
  const now = nowIso();
  const existing = projectId
    ? db
        .prepare("SELECT id FROM provider_configs WHERE stage_type=? AND project_id=?")
        .get(config.stageType, projectId)
    : db
        .prepare("SELECT id FROM provider_configs WHERE stage_type=? AND project_id IS NULL")
        .get(config.stageType);

  const configRef = config.configRef ?? null;
  if (existing) {
    db.prepare(
      `UPDATE provider_configs SET provider_kind=?, enabled=?, config_ref=?, timeout_ms=?, max_attempts=?, updated_at=? WHERE id=?`,
    ).run(
      config.providerKind,
      config.enabled ? 1 : 0,
      configRef,
      config.timeoutMs,
      config.maxAttempts,
      now,
      (existing as any).id,
    );
  } else {
    db.prepare(
      `INSERT INTO provider_configs
        (id, project_id, stage_type, provider_kind, enabled, config_ref, timeout_ms, max_attempts, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      newId("pcfg"),
      projectId,
      config.stageType,
      config.providerKind,
      config.enabled ? 1 : 0,
      configRef,
      config.timeoutMs,
      config.maxAttempts,
      now,
      now,
    );
  }
  return getProviderConfig(db, projectId, config.stageType)!;
}
