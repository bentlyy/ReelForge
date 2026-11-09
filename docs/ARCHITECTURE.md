# Architecture (Fase 1)

## Goal
Local, low-resource foundation for producing vertical videos (YouTube Shorts / Instagram Reels / generic). Fase 1 delivers a controllable dashboard + API + persistent state machine. **No** image/voice/subtitle/FFmpeg/YouTube providers yet.

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
- **Shared**: source of truth for stage types/order, statuses, DTO schemas/types. API validates with shared schemas.

## Runtime (local)
- API binds `API_HOST=127.0.0.1` (default), `API_PORT=4000`. Not exposed externally.
- SQLite file at `DB_PATH` (default `./storage/reelengine.db`), WAL + `foreign_keys=ON`.
- Dashboard dev server proxies `/api` to `127.0.0.1:4000`.

## Provider interfaces (future, Fase 2+)
Pipeline actions are implemented as state transitions/jobs/history now. Future providers (script LLM, scene planning, image, TTS, subtitles, assembly, render) should plug behind a service interface per `stage_type`, producing `assets` and job results, while reusing the same status/approval/retry model. One render at a time should be enforced in the worker/orchestrator when render is added.

## Security (Fase 1)
- Localhost bind only; no API keys in frontend.
- Zod validation on inputs; id params constrained.
- JSON body limit (256kb); in-memory rate limit (lightweight).
- No arbitrary file path access; storage paths must be sanitized/contained (to enforce when assets/providers are added).
- Secrets via env (`.env`), never committed.
