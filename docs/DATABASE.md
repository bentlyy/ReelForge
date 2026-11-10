# Database (SQLite)

Engine: **better-sqlite3**. Pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`.

## Migrations
- `apps/api/migrations/001_init.sql` — core tables.
- `apps/api/migrations/002_pipeline_queue.sql` — provider configs + job queue (Fase 2 core).
- Package-level assets (outside `src`/`dist`); `src/db/migrate.ts` resolves them by module location, so both `tsx` and compiled `dist` use the same files. Fails fast if the directory is missing.
- Applied by `src/db/migrate.ts` (tracks `schema_migrations`). Runs at API startup and in tests.
- Data persists across restarts (verified by `src/__tests__/persistence.test.ts`).

## Tables
### projects
`id (PK), name, description, platform (youtube_shorts|instagram_reels|generic_vertical), created_at, updated_at`

### episodes
`id (PK), project_id (FK projects, CASCADE), title, synopsis, status, created_at, updated_at` — index `project_id`.

### pipeline_stages
`id (PK), episode_id (FK, CASCADE), stage_type, stage_order, status, note, started_at, completed_at, created_at, updated_at`, **unique (episode_id, stage_type)**. Created automatically (7 stages) when an episode is created/fetched.

Stage types/order: `SCRIPT, SCENE_PLANNING, IMAGE_GENERATION, VOICE_GENERATION, SUBTITLES, ASSEMBLY, FINAL_RENDER`.

### pipeline_jobs
`id (PK), stage_id (FK, CASCADE), status, attempt, error_message, created_at, updated_at` — records stub/action attempts.

### approvals
`id (PK), stage_id (FK, CASCADE), decision (APPROVED|REJECTED), note, created_at`.

### assets
`id (PK), episode_id (FK), stage_id (FK nullable), kind, relative_path, mime_type, size_bytes, created_at`. **Not written yet** (stub/manual providers do not produce files).

### activity_events
`id, episode_id, project_id, event_type, message, metadata_json, created_at` — history/audit feed.

### provider_configs (Fase 2)
`id (PK), project_id (FK projects, CASCADE, nullable = global), stage_type, provider_kind, enabled, config_ref, timeout_ms, max_attempts, created_at, updated_at` — unique scope `(COALESCE(project_id,'*'), stage_type)`. `config_ref` names an env var, **never a secret value**.

### job_queue (Fase 2)
`id (PK), stage_id (FK, CASCADE), episode_id (FK, CASCADE), stage_type, idempotency_key UNIQUE, status (PENDING|LEASED|RUNNING|SUCCEEDED|FAILED|CANCELLED), attempt, max_attempts, lease_owner, lease_expires_at, run_after, payload_json, result_json, error_code, error_message, created_at, updated_at` — indexes on `(status, run_after)`, `stage_id`, `(status, lease_expires_at)`.

## Transactions
State-changing operations (stage actions, approval + status update + job/event, episode status sync, queue lease) use `better-sqlite3` transactions in services/repositories where appropriate.
