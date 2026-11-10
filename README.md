# Reel Engine (Fase 1 + Fase 2 core)

Motor local (base) para producir **YouTube Shorts / Instagram Reels / video vertical**, con dashboard web para supervisar etapas de producción. **Fase 1**: monorepo, API, SQLite, pipeline con estados/aprobaciones stub. **Fase 2 (núcleo)**: contratos de proveedores, cola persistida, worker in-process opt-in y proveedores `stub`/`manual`. **Sin** generación real de imágenes, narración, subtítulos, FFmpeg ni publicación YouTube.

## Requisitos
- **Node.js 24 LTS** (`engines` >=24; tu entorno actual puede requerir actualización desde v22).
- npm (workspaces).

## Stack (obligatorio Fase 1)
Node 24, TypeScript, npm workspaces, React + Vite + MUI + React Router + TanStack Query, Express, SQLite (`better-sqlite3`), Zod, Pino (+ `pino-http`), Vitest, Supertest. Sin Docker/Redis/Postgres/n8n/ComfyUI/Whisper/Piper/modelos IA.

## Instalación
```bash
cd ReelEngine
cp .env.example .env   # ajustar si hace falta (Windows: copy .env.example .env)
npm install
npm run build -w @reel-engine/shared
```

## Ejecutar
```bash
npm run dev:api        # API en 127.0.0.1:4000 (bind local)
npm run dev:dashboard  # Vite en 5173, proxy /api -> 4000
```
Abrir `http://localhost:5173`.

El worker de cola está **apagado por defecto**. Para procesar jobs en el mismo proceso de la API: `WORKER_ENABLED=true npm run dev:api` (o define la variable en `.env`). `.env` se carga desde la raíz del repo y `apps/api/`; `process.env` tiene prioridad y los paths relativos (`DB_PATH`, `STORAGE_ROOT`) se resuelven contra la raíz. Ver `.env.example`.

## Pruebas y tipos
```bash
npm test               # shared (passWithNoTests) + API (Vitest+Supertest)
npm run typecheck
npm run build
```

## Estructura
`apps/dashboard` (React), `apps/api` (Express), `packages/shared` (contratos Zod/tipos), `storage` (SQLite runtime, ignorado), `config`, `docs`.

## Seguridad
API solo en `127.0.0.1`, sin API keys en frontend, validación Zod, rate limit en memoria, JSON limitado, rutas de storage saneadas (`lib/storage.ts`, sin path traversal) y configs de proveedor que rechazan valores con pinta de secreto.

## Fase 1 — alcance
Proyectos/episodios CRUD, etapas `SCRIPT→SCENE_PLANNING→IMAGE_GENERATION→VOICE_GENERATION→SUBTITLES→ASSEMBLY→FINAL_RENDER`, estados `PENDING/RUNNING/WAITING_APPROVAL/APPROVED/COMPLETED/FAILED/CANCELLED`, aprobar/rechazar/cancelar/reintentar, `run-stub` (sin proveedor real), historial, persistencia SQLite (WAL/tx/migraciones). Ver `docs/`.

## Fase 2 (núcleo) — alcance
`POST /api/stages/:id/enqueue` (202), `GET /api/stages/:id/jobs`, `GET /api/jobs/:id`. Cola `job_queue` idempotente con leases, reintentos con backoff, timeout por etapa y cancelación ligada a la etapa; worker in-process (`WORKER_ENABLED`, concurrencia configurable con **máximo 1 etapa pesada**) que valida `JobResult`, con providers `stub`/`manual` y `provider_configs` sin secretos. Pendiente: adapters reales, FFmpeg/Piper/Whisper, UI de configuración/import y publicación.
