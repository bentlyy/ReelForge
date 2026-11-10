# Architecture (Fase 1 + Fase 2 core)

## Goal
Local, low-resource foundation for producing vertical videos (YouTube Shorts / Instagram Reels / generic). Fase 1 delivers a controllable dashboard + API + persistent state machine. Fase 2 core adds provider contracts, a SQLite job queue and an opt-in in-process worker. **No** real image/voice/subtitle/FFmpeg/YouTube providers yet.

## Monorepo layout
```text
ReelEngine/
  apps/dashboard   # React + Vite + MUI + React Router + TanStack Query
  apps/api         # Express (127.0.0.1) + SQLite + Zod + Pino
  packages/shared  # Zod schemas, pipeline constants, TS types/contracts
  storage/         # runtime SQLite/assets (gitignored contents)
  config/          # env examples
  docs/
```

## Boundaries
- **Dashboard**: UI/state fetching only (TanStack Query). No business logic, no SQL, no secrets.
- **API**: HTTP routes -> validation (Zod) -> services -> repositories -> SQLite. Central error handler + logging.
- **Shared**: source of truth for stage types/order, statuses, DTO schemas/types, provider/job contracts. API validates with shared schemas.

## Runtime (local)
- API binds `API_HOST=127.0.0.1` (default), `API_PORT=4000`. Not exposed externally.
- SQLite file at `DB_PATH` (default `storage/reelengine.db`, relative to the repo root), WAL + `foreign_keys=ON`; assets under `STORAGE_ROOT` (default `storage`).
- `.env` is loaded from `apps/api/.env` and the repo root without extra dependencies; explicit `process.env` wins. Relative `DB_PATH`/`STORAGE_ROOT` resolve against the repo root.
- SQL migrations live in `apps/api/migrations` (package assets) and are resolved by module location, so `src` and compiled `dist` share the same files.
- Dashboard dev server proxies `/api` to `127.0.0.1:4000`.
- Queue worker is **disabled by default**; enable with `WORKER_ENABLED=true` (`WORKER_POLL_MS`, `WORKER_LEASE_MS`, `WORKER_CONCURRENCY=1`). It runs in the API process (option A).

## Provider interfaces & queue (Fase 2 core)
- `IStageProvider` per `stage_type` with `ProviderRegistry`; configured via `provider_configs` (global or per-project, edited through `/api/provider-configs` and the `/providers` page), fallback to `stub`. `manual` is available; `external_api`/`local_cli` are reserved.
- Jobs persist in `job_queue` with idempotency keys and atomic leases. `QueueWorker.tickOnce()` leases at most one job per tick (concurrency 1), enforces timeouts via `AbortSignal`, retries with backoff and cancels cooperatively.
- Provider output is validated (`jobResultSchema`); stage/episode statuses are synced through the existing state machine.
- Real providers must produce assets under `storage/` via `StorageService` (sanitized, contained), while reusing the same approval/retry model. One heavy render at a time when render is added.
- Manual asset import registers existing files only: `GET/POST/DELETE /api/episodes/:episodeId/assets` validates the `episodes/<episodeId>/` prefix, containment in `STORAGE_ROOT`, file existence, and an optional stage belonging to the same episode. MIME is inferred, size read from disk, and `asset.imported`/`asset.deleted` history events are recorded. No uploads through the browser.

## Security
- Localhost bind only; no API keys in frontend.
- Zod validation on inputs; id params constrained; provider configs **reject secret-looking values** (`config_ref` is an env var name).
- JSON body limit (256kb); in-memory rate limit (lightweight).
- Storage paths sanitized/contained (`lib/storage.ts` blocks traversal, absolute paths and path separators in filenames).
- Secrets via env (`.env`), never committed.
