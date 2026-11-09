# ReelEngine — Contexto de continuidad

> Actualizado: 2026-05-09. Carpeta: `C:\Users\garay\OneDrive\Documentos\Proyectos\11_AutoYoutube\ReelEngine`
> Objetivo: motor local para Shorts/Reels/vertical con dashboard web, bajo consumo, servicios externos gratuitos cuando sea posible, **sin modelos pesados**.

## Estado actual
**Fase 1: base implementada y verificada (backend/tests/build).** Smoke manual UI pendiente de confirmación del usuario.

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
- `npm run test -w @reel-engine/api` — **5 archivos, 11 tests passed** (proyectos CRUD, episodios+etapas, transiciones/aprobaciones/retry/409, validación/errores/health, persistencia SQLite tras reabrir).
- `npm run typecheck -w @reel-engine/api` — OK.
- `npm run build -w @reel-engine/dashboard` — OK (warning bundle >500kB, no error).

## Pendiente / no afirmar listo sin prueba
- **Smoke manual UI+API** (checklist en `docs/DEVELOPMENT.md`) — pendiente.
- Ajuste Fase 1 solicitado por usuario: **detalle no especificado** (confirmar antes de cambiar).
- Dashboard bundle size warning (optimización opcional).
- Node 24 real en máquina del usuario.

## No implementado (intencional)
Generación real de imágenes/voz/subtítulos, FFmpeg, Whisper, Piper, publicación YouTube, proveedores externos configurados, worker pesado de render (diseño: 1 render a la vez futuro). No cargar audiovisuales completos en memoria.

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

## Plan Fase 2 (solo planificado, aprobado para diseñar; no implementar generación real aún)
- Contratos/provider interfaces por etapa (`IStageProvider`, registry, config por proyecto/etapa) en `shared`/`api`.
- Cola persistida en SQLite + worker controlado (in-process opcional/proceso separado), **concurrencia pesada = 1**, timeouts, cancelación cooperativa, reintentos idempotentes.
- Adapters futuros (decidir/aprobar): script/scene manual o API externa aprobada; voz/subtítulos/imagen externos o CLI local **solo con aprobación e instalación explícita**; FFmpeg si está disponible, 1 a la vez.
- Assets en `storage/` con rutas saneadas (sin path traversal), registro en DB; UI config/logs/assets (sin keys en front).
- **Decisiones previas Fase 2**: proveedor por etapa, si se instala FFmpeg/Piper/Whisper, worker in-process vs separado.

## Docs
`README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/PIPELINE.md`, `docs/DEVELOPMENT.md`.
