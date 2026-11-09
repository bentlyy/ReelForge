# Pipeline (Fase 1)

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

## Episode status sync
Derived after stage changes: any RUNNING → RUNNING; any WAITING_APPROVAL → WAITING_APPROVAL; any FAILED → FAILED; any CANCELLED → CANCELLED; all COMPLETED → COMPLETED; else PENDING.

## Future (not in Fase 1)
Real provider jobs, artifact generation into `storage/` (sanitized), one-render-at-a-time queue, idempotent retries with preserved completed artifacts.
