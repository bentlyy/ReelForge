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
npm run dev:api        # http://127.0.0.1:4000 (loads repo .env)
npm run dev:dashboard  # http://localhost:5173 (/api proxied)
```
Run in separate terminals. Production build uses the same migrations and env rules:
```powershell
npm run build
npm start -w @reel-engine/api   # node dist/server.js
```

## Test / typecheck / build
```powershell
npm run test           # shared + API
npm run typecheck      # shared + api + dashboard
npm run build
```

## Verified results (this environment)
- `shared` build: OK.
- `api` typecheck: OK. `api` tests (Vitest+Supertest): **10 files, 40 passed** (Fase 1 + migrations, env/dotenv, queue/worker, cancellation, guards, heavy concurrency, provider configs, assets).
- `dashboard` build (tsc + vite): OK (bundle size warning only).

## Manual smoke checklist
1. Start API + dashboard; open `http://localhost:5173`.
2. Create project -> appears in list/edit works.
3. Create episode (select project) -> detail shows 7 stages, PENDING.
4. `Ejecutar stub` on a stage -> WAITING_APPROVAL, history updates.
5. Approve -> COMPLETED; Reject -> FAILED then Retry -> PENDING; Cancel works from allowed states.
6. Progress bar/home indicators update; restart API and confirm data persists (SQLite `storage/reelengine.db`).
7. Open `Proveedores`: switch Global/project scope, edit a stage (kind/timeout/attempts), save, verify the row; for a project override use Restablecer and confirm it inherits global again.
8. Assets: place a real file at `storage/episodes/<episodeId>/script/hello.txt`, open the episode detail, `Importar asset` with the relative path, verify MIME/size and history, then `Eliminar` it. Expect 400 for missing files, paths outside `episodes/<episodeId>/` or another episode's stage.

## Notes / constraints
- API bound to localhost; no secrets in frontend/repo.
- No polling loops added; TanStack Query manages requests (refetch after mutations).
- Do **not** add Docker/Redis/Postgres/n8n/ComfyUI/Whisper/Piper/FFmpeg/YouTube/models in Fase 1.
- Do not claim features ready without running tests/checks.
