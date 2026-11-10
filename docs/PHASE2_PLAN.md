# Phase 2 Plan (detailed) — core implemented, advanced adapters pending

> Status: **core + provider-config UI implemented (2026-11-10)**: shared contracts, provider registry with `stub`/`manual`, SQLite queue, in-process opt-in worker (`WORKER_ENABLED`), sanitized storage paths, routes `POST /api/stages/:id/enqueue`, `GET /api/stages/:id/jobs`, `GET /api/jobs/:id`, `GET/PUT/DELETE /api/provider-configs`, dashboard page `/providers` (global/project scope), manual asset registration (`GET/POST/DELETE /api/episodes/:episodeId/assets` + episode **Assets** panel), and per-stage queue/logs panel (`Encolar`, job status/attempts/error/lease/payload/result, stage events). **Not implemented**: real `external_api`/`local_cli` adapters, ffmpeg detection/usage, Piper/Whisper, file uploads/browser picker, publishing, separate-process worker. No Docker/Redis/Postgres/n8n/ComfyUI/Whisper/Piper/AI models installed. Requires explicit user approval before adding providers or installing tools.

## Goals
- Plug real providers behind interfaces per pipeline stage, keep low resource usage.
- Persist jobs in SQLite; **max 1 heavy job at a time**; idempotent retries; cancellable where safe.
- Keep API bound to `127.0.0.1`, no secrets in frontend, sanitized paths under `storage/`.

## 1) Shared contracts (`packages/shared`)
Add (Zod + types), versioned carefully to avoid breaking Fase 1:
- `ProviderKind` / per-stage provider config ref: `manual | external_api | local_cli | stub`.
- `StageProviderConfig`: `{ stageType, providerKind, enabled, configRef, timeoutMs, maxAttempts }` (no secrets; secrets resolved server-side from env/config).
- `JobRequest`: `{ jobId, stageId, episodeId, projectId, stageType, attempt, input: Record<string,unknown>, idempotencyKey }`.
- `JobResult`: `{ status: 'COMPLETED'|'FAILED'|'WAITING_APPROVAL', output?: Record<string,unknown>, assets?: AssetRef[], errorCode?, errorMessage? }`.
- `AssetRef`: `{ kind, relativePath, mimeType?, sizeBytes? }` — `relativePath` must be validated/sanitized server-side under `storage/episodes/<episodeId>/...`.
- API DTOs for provider configs and job inspection (read-only in dashboard).

## 2) Provider interfaces (`apps/api`)
```ts
interface IStageProvider {
  readonly stageType: PipelineStageType;
  readonly kind: ProviderKind;
  validateConfig(cfg: unknown): void;
  run(req: JobRequest, ctx: ProviderContext): Promise<JobResult>; // ctx: db/logger/signal/storageRoot
  cancel?(jobId: string): Promise<void>; // cooperative
}
```
- `ProviderRegistry`: resolves provider by `(projectId|default, stageType)`; falls back to **stub/manual**.
- Keep Fase 1 stub as `StubStageProvider` (produces `WAITING_APPROVAL`/artifact placeholders, no heavy work).
- Config storage options (choose one, minimal): table `provider_configs` (SQLite migration) or `config/providers.local.json` gitignored + env secret refs. **No API keys in DB plaintext**; use env var names.

## 3) SQLite queue + worker (no Redis/Docker)
Migration adds:
- `job_queue` (or extend `pipeline_jobs`): `id, stage_id, episode_id, idempotency_key UNIQUE, status(PENDING|LEASED|RUNNING|SUCCEEDED|FAILED|CANCELLED), attempt, max_attempts, lease_owner, lease_expires_at, run_after, payload_json, result_json, error_message, created_at, updated_at`.
- Indexes: `(status, run_after)`, `(stage_id)`, unique `idempotency_key`.
- Acquire lease transactionally: select eligible PENDING/run_after<=now, set LEASED with short TTL; prevents double-run.

Worker model (decision needed):
- **A (default, safest):** in-process worker started only when `WORKER_ENABLED=true` and API runs in a controlled mode; polls lightly (e.g. 5–15s, backoff when idle) — *no busy loop*.
- **B:** separate `apps/worker` Node process reading same SQLite (WAL) — clearer isolation, still local/light.

Concurrency:
- Global semaphore **1** for heavy stages (`IMAGE_GENERATION, VOICE_GENERATION, ASSEMBLY, FINAL_RENDER` initially configurable); lightweight stages may be separate but default 1.
- `run_after` backoff for retries: e.g. 30s, 2m, 10m (cap), max attempts configurable.
- Cancellation: cooperative via `AbortSignal`/flag checked between steps; hard-kill only for `local_cli` child processes with timeout.

## 4) Stage adapters (future, per approval/install)
| Stage | Default Fase 2-safe | Possible adapter (explicit approval) |
|---|---|---|
| SCRIPT | manual text / template in UI | external API if approved (key in env) |
| SCENE_PLANNING | manual/template | external API/manual |
| IMAGE_GENERATION | manual import asset | external API/manual; **no ComfyUI/models** default |
| VOICE_GENERATION | manual import audio | local CLI/API **only if installed/approved** (no auto-install Piper) |
| SUBTITLES | manual import SRT/VTT | local CLI/API **only if installed/approved** |
| ASSEMBLY | manifest/manual | FFmpeg CLI **only if `ffmpeg` present & approved**, 1 at a time, stream/chunk IO |
| FINAL_RENDER | manifest/manual | FFmpeg CLI, 1 at a time |

## 5) Storage & security
- `StorageService` resolves/creates `storage/episodes/<safeEpisodeId>/<stage>/<safeFilename>`.
- Reject `..`, absolute paths, null bytes; allowlist extensions per kind; max size checks.
- **Implemented**: register existing files in `assets` only when they live under `episodes/<episodeId>/`, remain contained in `STORAGE_ROOT`, and exist; size from `stat`, MIME inferred, optional same-episode stage, history events. Checksum optional later.
- Dashboard never receives secrets; provider config UI stores only non-secret refs/enabled flags.

## 6) Dashboard additions
- **Implemented**: provider config panel per project/stage (kind/enabled/timeout/attempts, no secrets) at `/providers`, backed by `/api/provider-configs`.
- **Implemented**: per-stage job list/log tail (`GET /api/stages/:id/jobs`, status/attempts/error/lease/payload/result, events filtered by `metadata.stageId`) and safe `Encolar` action. A cross-episode queue view and live polling remain pending.
- **Implemented**: asset list/register/delete in the episode detail (kind, stage, relative path, MIME, size). Preview is still pending; never load full large video into memory unnecessarily.

## 7) Tests required before calling ready
- Registry resolves stub fallback; config validation rejects secrets/invalid paths.
- Queue lease prevents duplicate processing; retry/backoff/idempotency key stable.
- Concurrency cap = 1 for heavy lane (mock providers with delays).
- Path traversal/sanitization blocked.
- Assets: prefix `episodes/<id>/` enforced, missing files/outside-root/backslash paths rejected, foreign stage rejected, MIME inferred, delete scoped to the episode.
- Existing Fase 1 tests remain green.

## Decisions needed from user (blockers)
1. **Ajuste Fase 1 exacto** (aún no especificado).
2. **Smoke manual Fase 1**: resultado OK/fallos del checklist.
3. **Worker model**: A in-process opt-in or B separate process.
4. **Provider por etapa** (manual/external/local_cli/stub) y prioridad de implementación.
5. **Instalaciones aprobadas** (ninguna por defecto): ¿permitir detección/uso de `ffmpeg` si ya existe? ¿aprobar instalación futura de Piper/Whisper? (solo con aprobación explícita).
6. **Secrets**: ¿`.env` local solo, o archivo `config/providers.local.json` gitignored + env refs?
