# Database (SQLite, Fase 1)

Engine: **better-sqlite3**. Pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`.

## Migrations
- `apps/api/src/db/migrations/001_init.sql`
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
`id (PK), episode_id (FK), stage_id (FK nullable), kind, relative_path, mime_type, size_bytes, created_at`. **Unused in Fase 1** (schema ready for providers).

### activity_events
`id, episode_id, project_id, event_type, message, metadata_json, created_at` — history/audit feed.

## Transactions
State-changing operations (stage actions, approval + status update + job/event, episode status sync) use `better-sqlite3` transactions in services/repositories where appropriate.
