# Reel Engine (Fase 1)

Motor local (base) para producir **YouTube Shorts / Instagram Reels / video vertical**, con dashboard web para supervisar etapas de producción. **Fase 1**: fundación sólida (monorepo, API, SQLite, pipeline con estados/aprobaciones stub). **Sin** generación de imágenes, narración, subtítulos, FFmpeg ni publicación YouTube.

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

## Pruebas y tipos
```bash
npm test               # shared (passWithNoTests) + API (Vitest+Supertest)
npm run typecheck
```

## Estructura
`apps/dashboard` (React), `apps/api` (Express), `packages/shared` (contratos Zod/tipos), `storage` (SQLite runtime, ignorado), `config`, `docs`.

## Seguridad (Fase 1)
API solo en `127.0.0.1`, sin API keys en frontend, validación Zod, rate limit en memoria, JSON limitado, rutas saneadas por diseño (sin acceso a paths arbitrarios).

## Fase 1 — alcance
Proyectos/episodios CRUD, etapas `SCRIPT→SCENE_PLANNING→IMAGE_GENERATION→VOICE_GENERATION→SUBTITLES→ASSEMBLY→FINAL_RENDER`, estados `PENDING/RUNNING/WAITING_APPROVAL/APPROVED/COMPLETED/FAILED/CANCELLED`, aprobar/rechazar/cancelar/reintentar, `run-stub` (sin proveedor real), historial, persistencia SQLite (WAL/tx/migraciones). Ver `docs/`.
