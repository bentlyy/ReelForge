# Development

## Prerequisites
- Node.js **24 LTS** (`engines >=24`). (If on Node 22, upgrade; EBADENGINE may appear.)
- npm.

## Setup
```powershell
cd ReelEngine
copy .env.example .env
npm install
npm run build -w @reel-engine/shared
```

## Run
```powershell
npm run dev:api        # http://127.0.0.1:4000
npm run dev:dashboard  # http://localhost:5173 (/api proxied)
```
Run in separate terminals.

## Test / typecheck / build
```powershell
npm run test           # shared + API
npm run typecheck      # shared + api + dashboard
npm run build
```

## Verified results (this environment)
- `shared` build: OK.
- `api` typecheck: OK. `api` tests (Vitest+Supertest): **5 files, 11 passed** (projects create/edit, episodes create/edit+stages, pipeline transitions/approvals/retry + invalid 409, validation/errors/health, SQLite persistence across reopen).
- `dashboard` build (tsc + vite): OK (bundle size warning only).

## Manual smoke checklist
1. Start API + dashboard; open `http://localhost:5173`.
2. Create project -> appears in list/edit works.
3. Create episode (select project) -> detail shows 7 stages, PENDING.
4. `Ejecutar stub` on a stage -> WAITING_APPROVAL, history updates.
5. Approve -> COMPLETED; Reject -> FAILED then Retry -> PENDING; Cancel works from allowed states.
6. Progress bar/home indicators update; restart API and confirm data persists (SQLite `storage/reelengine.db`).

## Notes / constraints
- API bound to localhost; no secrets in frontend/repo.
- No polling loops added; TanStack Query manages requests (refetch after mutations).
- Do **not** add Docker/Redis/Postgres/n8n/ComfyUI/Whisper/Piper/FFmpeg/YouTube/models in Fase 1.
- Do not claim features ready without running tests/checks.
