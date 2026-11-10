# ReelEngine — Contexto de continuidad

> Actualizado: 2026-11-10. Carpeta: `C:\Users\garay\OneDrive\Documentos\Proyectos\11_AutoYoutube\ReelEngine`
> Objetivo: motor local para Shorts/Reels/vertical con dashboard web, bajo consumo, servicios externos gratuitos cuando sea posible, **sin modelos pesados**.
> Repo: `https://github.com/bentlyy/ReelForge.git` (branch `main`, tracking `origin/main`).

## Estado actual
**Fase 1 completa y verificada.** **Fase 2 (núcleo) implementada**: contratos, provider registry, cola SQLite, worker in-process opt-in, proveedores `stub`/`manual` y UI de configuración de proveedores (global/proyecto) e import manual de assets; **sin proveedores reales ni instalaciones**.
- Commits relevantes: `8e4ba4e` (Fase 1 foundation), `a483589` (tsbuildinfo), `f48b053` (plan Fase 2), `9fa30d6` (fix BOM + smoke), `068d4e3` (Fase 2 núcleo).
- **Pendiente del usuario:** verificación visual/clics UI, ajuste Fase 1 (detalle no especificado).

## Decisiones confirmadas
- **D1=A**: `engines.node >=24` en `package.json`. *Entorno detectado al implementar*: Node **v22.15.0**, npm 11.21.1, git 2.47.1 → apareció `EBADENGINE`; recomendado actualizar a Node 24 LTS y reinstalar.
- **D2=no**: no se inicializó git dentro de `ReelEngine/` (hay `.gitignore`).
- **D3=pino-http**: logging con `pino` + `pino-http` (`apps/api/src/app.ts`).
- **D4=sí**: `tsx` como devDependency de API.
- **D5=ok**: acciones de pipeline **stub** locales, transaccionales, sin procesos pesados/proveedores reales. `start`/`run-stub` ⇒ `RUNNING`→`WAITING_APPROVAL`. No implementa imágenes, voz, subtítulos, FFmpeg, Whisper, Piper, publicación YouTube.

## Stack (obligatorio Fase 1, respetado)
Node 24 target, TypeScript, npm workspaces, React, Vite, MUI, React Router, TanStack Query, Express, SQLite (`better-sqlite3`), Zod, Pino, Vitest, Supertest. **No** agregar sin justificar: Docker, Redis, PostgreSQL, n8n, ComfyUI, Whisper, Piper, modelos IA, FFmpeg, publicación YouTube.

## Estructura
```text
apps/dashboard  (React)  # UI; sin lógica de negocio, sin SQL, sin API keys
apps/api        (Express)# 127.0.0.1; routes->Zod->services->repositories->SQLite
packages/shared          # contratos Zod, tipos, constantes pipeline
storage/                 # runtime SQLite/assets (gitignored)
config/ docs/ .env.example
```

## Implementado (Fase 1)
- Monorepo npm workspaces + TS base + `packages/shared` (build OK).
- API REST: proyectos, episodios, etapas, aprobaciones, historial, health. Validación Zod, errores centralizados, Pino/pino-http, JSON 256kb, rate limit en memoria, bind **127.0.0.1**.
- SQLite: migración `001_init.sql` + `schema_migrations`; tablas `projects, episodes, pipeline_stages, pipeline_jobs, approvals, assets, activity_events`; `WAL`, `foreign_keys=ON`, `busy_timeout`, transacciones.
- Pipeline: estados `PENDING,RUNNING,WAITING_APPROVAL,APPROVED,COMPLETED,FAILED,CANCELLED`; etapas `SCRIPT,SCENE_PLANNING,IMAGE_GENERATION,VOICE_GENERATION,SUBTITLES,ASSEMBLY,FINAL_RENDER`; crear episodio genera 7 etapas; acciones aprobar/rechazar/cancelar/reintentar/start/complete/run-stub con validación de transiciones (409 inválidas), jobs/aprobaciones/historial, sync estado episodio.
- Dashboard: páginas inicio, proyectos (list/crear/editar), episodios (list/crear/editar), detalle episodio (etapas, estado, progreso, acciones, historial), tema claro/oscuro, nav lateral, responsive, estados vacío/error/carga. TanStack Query (sin polling excesivo).

## Verificación ejecutada
- `npm run build -w @reel-engine/shared` — OK.
- `npm run test -w @reel-engine/api` — **10 archivos, 40 tests passed** (Fase 1 + Fase 2: migraciones, env/dotenv, cola/worker, cancelación, guardas, concurrencia pesada, provider configs, assets).
- `npm run typecheck -w @reel-engine/api` — OK.
- `npm run build -w @reel-engine/dashboard` — OK (warning bundle >500kB, no error).

## Smoke ejecutado (2026-11-10)
- **Fix BOM**: todo el repo se había guardado con BOM UTF-8; `tsx` no lo tolera y `npm run dev:api` fallaba (`Error parsing package.json`). BOM eliminado de 74 archivos. Tras el fix: `npm test` (11 passed) y `npm run build` OK.
- **API E2E OK**: health, crear/editar proyecto, crear episodio (7 etapas), `run-stub`→`WAITING_APPROVAL`, approve→COMPLETED, reject→FAILED, retry→PENDING, cancel→CANCELLED, aprobaciones, historial (9 eventos); 409 correcto al rechazar desde PENDING.
- **UI**: sirve HTML 200 en 5173 y proxy `/api/health` OK. **Clics UI no automatizados** (Chrome sin remote debugging): falta verificación visual manual.

## Pendiente / no afirmar listo sin prueba
- Verificación visual/clics UI (checklist `docs/DEVELOPMENT.md`) — pendiente.
- Ajuste Fase 1 solicitado por usuario: **detalle no especificado** (confirmar antes de cambiar).
- Dashboard bundle size warning (optimización opcional).
- Node 24 real en máquina del usuario (hoy v22.15.0 → EBADENGINE).

## No implementado (intencional)
Generación real de imágenes/voz/subtítulos, FFmpeg, Whisper, Piper, publicación YouTube, proveedores externos configurados, render real (el slot pesado=1 ya se aplica a las etapas heavy). No cargar audiovisuales completos en memoria.

## Comandos útiles
```powershell
cd C:\Users\garay\OneDrive\Documentos\Proyectos\11_AutoYoutube\ReelEngine
copy .env.example .env
npm install
npm run build -w @reel-engine/shared
npm run dev:api        # 127.0.0.1:4000
npm run dev:dashboard  # http://localhost:5173 (proxy /api)
npm test
npm run typecheck
npm run build
```

## Fase 2 — núcleo implementado (2026-11-10)
- **Shared**: `constants/providers.ts`, `schemas/provider.ts` (estricto: rechaza claves secretas; `safeRelativePath`; update schema de config), `types/jobs.ts`, `types/providers.ts` (vista de config efectiva).
- **DB**: migraciones en `apps/api/migrations/` (assets de paquete resueltos por módulo → válidos en `src` y `dist`, con fail-fast si faltan): `001_init.sql`, `002_pipeline_queue.sql` (`provider_configs`, `job_queue` con índices + `idempotency_key UNIQUE`).
- **API**: `providers/` (`IStageProvider`, `StubStageProvider`, `ManualStageProvider`, `ProviderRegistry` con fallback a stub), `repositories/providerConfigs.ts`, `repositories/jobQueue.ts` (enqueue/lease/complete/fail/cancel con guardas de estado), `worker/queueWorker.ts` (in-process opt-in; concurrencia configurable con **máximo 1 etapa pesada**; timeout por etapa desde config con `AbortSignal`; backoff 30s/2m/10m; valida `JobResult`; descarta resultados de jobs cancelados), `lib/storage.ts` (rutas saneadas anti path-traversal).
- **Cola**: enqueue solo desde `PENDING`/`FAILED`; idempotencia por `stageId:status:updatedAt`; cancelar etapa cancela su job activo; `FAILED` reportado por proveedor cuenta como fallo reintentable; historial con `projectId`.
- **Rutas nuevas**: `POST /api/stages/:id/enqueue` (202), `GET /api/stages/:id/jobs`, `GET /api/jobs/:id`, `GET/PUT/DELETE /api/provider-configs` (scope global o `?projectId=`, con `effective` heredado).
- **Assets**: `GET/POST/DELETE /api/episodes/:episodeId/assets`; solo registra archivos ya existentes bajo `episodes/<episodeId>/`, contenidos en `STORAGE_ROOT`; infiere MIME por extensión, guarda tamaño real y emite `asset.imported`/`asset.deleted`. `stageId` es opcional (nivel episodio).
- **UI**: página **Proveedores** (`/providers`) con selector de ámbito, tabla de 7 etapas, edición (kind/enabled/configRef/timeout/intentos) y restablecer override; sin secretos en el frontend. Panel **Assets** en el detalle del episodio para registrar y eliminar archivos del storage local. Cada etapa incluye **cola y logs**: botón `Encolar`, jobs (estado, intento/máximo, error, lease, payload/result) y eventos filtrados por `stageId`.
- **Env**: `WORKER_ENABLED` (default `false`, boolean estricto), `WORKER_POLL_MS`, `WORKER_LEASE_MS`, `WORKER_CONCURRENCY` (default 1), `STORAGE_ROOT`. `.env` se carga desde `apps/api/` y la raíz del repo sin dependencias; `process.env` tiene prioridad; `DB_PATH`/`STORAGE_ROOT` relativos se resuelven contra la raíz del repo. Ver `.env.example`.
- **Decisiones aplicadas**: worker A in-process opt-in; manual-first + stub; secrets solo en `.env`; ffmpeg solo se detectaría si existe (aún no usado); primer alcance = núcleo.
- **Verificación**: `npm test` → 10 archivos, **40 tests passed**; `npm run typecheck` y `npm run build` OK.
- **Smoke UI/API**: API+dashboard en vivo con DB temporal; `/providers` renderizó por DOM headless (título, 7 etapas, ámbito global); API real: override de proyecto `external_api`/9000ms efectivo y reset a `stub`. Assets: archivo real bajo `STORAGE_ROOT`, POST → 201 (`text/plain`, tamaño real), listado en DOM del detalle y DELETE → `removed:true`. Cola: `POST /stages/:id/enqueue` → job `PENDING` 0/3, `GET /stages/:id/jobs` → 1, evento `stage.enqueued`, y DOM del detalle con 7 botones «Ver cola y logs» y «Encolar». Clics/visual fina no automatizados (Chrome sin remote debugging; el screenshot no es legible por el modelo).
- **Smoke en vivo (src y dist)**: `tsx src/server.ts` (puerto 4100) y `node dist/server.js` (4102, `.env` real, DB temporal); en ambos el worker procesó `POST /enqueue` → job `SUCCEEDED`, etapa `WAITING_APPROVAL`; en dist se aplicaron `001+002`; cancelar una etapa dejó su job en `CANCELLED`; sin errores en stderr.

## Fase 2 — no implementado aún
- Proveedores reales `external_api` / `local_cli`; detección/uso de `ffmpeg`; Piper/Whisper.
- Visor global de cola/logs entre episodios (el panel por etapa ya existe); la importación manual de assets no sube archivos desde el navegador.
- Publicación en YouTube/Instagram. Worker en proceso separado (opción B).

## Docs
`README.md`, `CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/PIPELINE.md`, `docs/DEVELOPMENT.md`, `docs/PHASE2_PLAN.md`.
