CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  stage_type TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_ref TEXT,
  timeout_ms INTEGER NOT NULL DEFAULT 120000,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_scope
  ON provider_configs(COALESCE(project_id, '*'), stage_type);

CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  stage_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  lease_owner TEXT,
  lease_expires_at TEXT,
  run_after TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_job_queue_ready ON job_queue(status, run_after);
CREATE INDEX IF NOT EXISTS idx_job_queue_stage ON job_queue(stage_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_lease ON job_queue(status, lease_expires_at);
