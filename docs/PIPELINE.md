# Pipeline

## Statuses
`PENDING, RUNNING, WAITING_APPROVAL, APPROVED, COMPLETED, FAILED, CANCELLED`

## Stages (fixed order)
1. `SCRIPT`
2. `SCENE_PLANNING`
3. `IMAGE_GENERATION`
4. `VOICE_GENERATION`
5. `SUBTITLES`
6. `ASSEMBLY`
7. `FINAL_RENDER`

## Actions (API: `POST /api/stages/:id/actions` `{ action, note }`)
| action | allowed from | result |
|---|---|---|
| `start` (stub/run-stub) | PENDING, FAILED, CANCELLED | RUNNING → **WAITING_APPROVAL** (stub completes; no real provider) |
| `complete` | RUNNING | WAITING_APPROVAL |
| `approve` | WAITING_APPROVAL | COMPLETED (+ approval record) |
| `reject` | WAITING_APPROVAL | FAILED (+ approval record + failed job) |
| `cancel` | PENDING, RUNNING, WAITING_APPROVAL, FAILED | CANCELLED |
| `retry` | FAILED, CANCELLED | PENDING |

Invalid transitions return **409 CONFLICT** (tested).

## Fase 1 stub behavior (D5)
No heavy processes/providers. `POST /api/stages/:id/run-stub` (and `action=start` via dashboard path) performs a local, transactional start+complete to `WAITING_APPROVAL`, records jobs and history. This validates the approval/retry UX and state machine without installing Whisper/Piper/FFmpeg/models.

## Queue / worker (Fase 2 core, opt-in)
- `POST /api/stages/:id/enqueue` (202) accepts stages in `PENDING` or `FAILED` only; repeated calls return the active job (one active job per stage). Idempotency key is `stageId:status:updatedAt`.
- `GET /api/stages/:id/jobs` and `GET /api/jobs/:id` expose job status/result.
- Worker runs **in-process only when `WORKER_ENABLED=true`** (`WORKER_POLL_MS`, `WORKER_LEASE_MS`, `WORKER_CONCURRENCY`): leases one job atomically (`LEASED` → `RUNNING`), calls the configured provider (fallback `stub`), validates `JobResult`, stores it and syncs stage/episode status.
- **Heavy stages are capped at 1 concurrent job** even when `WORKER_CONCURRENCY > 1`; the rest can run in parallel.
- Expired leases are reclaimable. Failures (thrown or provider-reported `FAILED`) retry with backoff (30s/2m/10m) until `max_attempts`, then `FAILED`. The per-stage timeout from provider config aborts via `AbortSignal`.
- Cancelling a stage cancels its active job; late provider results for cancelled jobs are discarded (`complete`/`fail` only apply to `LEASED`/`RUNNING`).
- Default `stub` result → stage `WAITING_APPROVAL`, reusing the same approval/retry model.

## Provider configuration (`provider_configs`)
- `GET /api/provider-configs` returns global scope (`projectId: null`); `?projectId=<id>` returns a project scope plus `effective` for all 7 stages.
- `PUT /api/provider-configs/:stageType[?projectId=]` upserts `{ providerKind, enabled, configRef, timeoutMs, maxAttempts }`; `DELETE` removes the scope row (reset).
- Resolution: project override → global config → stub defaults (120s, 3 attempts). `enabled=false` forces stub. `configRef` is an env var **name** validated as `^[A-Z][A-Z0-9_]{0,80}$`; secrets never enter the DB/UI.
- Dashboard page `/providers` edits the same data by scope; the API returns both the explicit scope rows and the resolved `effective` rows so the UI can show "Override"/"Heredado".

## Episode status sync
Derived after stage changes: any RUNNING → RUNNING; any WAITING_APPROVAL → WAITING_APPROVAL; any FAILED → FAILED; any CANCELLED → CANCELLED; all COMPLETED → COMPLETED; else PENDING.

## Assets (manual import)
- `GET /api/episodes/:episodeId/assets`, `POST /api/episodes/:episodeId/assets`, `DELETE /api/episodes/:episodeId/assets/:assetId`.
- `POST` body: `{ kind, relativePath, stageId?, mimeType? }`; `relativePath` is relative to `STORAGE_ROOT` and must start with `episodes/<episodeId>/`, be contained, and point to an existing file. Optional `stageId` must belong to the same episode.
- `kind` ∈ `image|audio|subtitle|video|manifest|other`; MIME is inferred from the extension when omitted; `sizeBytes` comes from `stat`; history emits `asset.imported`/`asset.deleted`.
- The dashboard **Assets** panel registers/deletes these rows; files are placed on disk manually, never uploaded by the browser.

## Future (not implemented)
Real `external_api` / `local_cli` adapters; FFmpeg detection/usage; Piper/Whisper; automatic artifact generation into `storage/`; publishing; separate-process worker.
