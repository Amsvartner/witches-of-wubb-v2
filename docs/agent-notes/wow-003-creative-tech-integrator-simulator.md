# WOW-003 — creative-tech-integrator implementation note: offline simulator

Date: 2026-07-10
Ticket: WOW-003 — Build offline simulator (mock backend) — ADR-001
Branch: `feat/wow-003-offline-simulator`

## What I discovered about the repo

- The frontend already targets `localhost:3335` via `.env` (`VITE_WS_SERVER_PORT=3335`), so ADR-001's fixed port needs no frontend change.
- The frontend consumes more events than the ticket's emit list: `clip_queued`, `clip_unqueued`, `clip_started`, `clip_playing`, `clip_stopping`, `clip_stopped`, `tempo_changed`, `volume_changed`, `master-key_changed` (`src/contexts/ableton-provider.tsx`). These are all real backend events emitted from `backend/ableton-api.ts`, covered by the ticket's instruction to mirror the observable browser-facing result of `QueueClip`/`StopOrRemoveClipFromQueue` — the simulator implements them all.
- **`EnrichRecommendations` is disabled in the real backend** (`backend/utils/get-clip-from-rfid.ts:21-23`, commented out), so live `ingredient_detected` payloads carry no `recommendedClips`. The simulator mirrors this: no enrichment. `src/hooks/use-grimoire.ts:87` reads `recommendedClips` and gets `undefined` — same as against the real backend.
- `ingredient_removed` carries **no `rfid`** in the real payload (`backend/events/incoming-events.ts:93` spreads metadata without adding it); `ingredient_detected` does (`:75`). Mirrored.
- The `get_playing_clips`/`get_queued_clips` acks project a 7-field subset (`pillar`, `clipName`, `type`, `assetName`, `rfid`, `artist`, `songTitle`) — `ingredientName`/`key` are dropped (`backend/events/incoming-events.ts:110-147`). Mirrored.
- The idle-timeout timer only starts with the first emitted event (`restartTimeoutTimer` via `EmitEvent`); `handleTimeout` clears the master key _without_ emitting `master-key_changed`. Mirrored.

## Files created/updated

- `sim/core/` — transport-free simulator logic (ADR-001): `types.ts` (mirrored browser-facing types), `csv.ts` (dependency-free CSV parser), `music-database.ts` (backend-identical CSV → metadata mapping), `simulator.ts` (fake state + contract handlers), `scenario.ts` (scripted-scenario engine), `scenarios.ts` (built-ins from real CSV rows), `index.ts`.
- `sim/server.ts` — thin socket.io wrapper on port 3335, localhost-only bind, logs every received/emitted event.
- `spec/sim/` — vitest suites importing `sim/core` directly: `simulator.spec.ts`, `scenario.spec.ts`, `music-database.spec.ts`, `csv.spec.ts`, and `import-guard.spec.ts` (fails the build if `sim/**` ever imports `ableton-js`, `node-osc`, `backend/`, or `sim/core` imports `socket.io`).
- `package.json` — `"sim": "vite-node sim/server.ts --"` script (vite-node ships with the existing vitest install); `socket.io@^4.6.0` devDependency (pre-approved 2026-07-10).
- `README.md` — simulator usage section.

## Contract-fidelity table

Target: **documented deltas = none** (all event names, payload shapes, and ack semantics match). Timing approximations are listed separately below — they do not change names/shapes/order.

| Event                                                           | Source of truth                         | Simulator behavior                                                                                  | Delta |
| --------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| `get_playing_clips` (ack)                                       | `backend/events/incoming-events.ts:110` | `BrowserClipInfoList`, length 4, `null` empties, 7-field subset                                     | none  |
| `get_queued_clips` (ack)                                        | `incoming-events.ts:129`                | same shape as above                                                                                 | none  |
| `get_tempo` (ack)                                               | `incoming-events.ts:148`                | number                                                                                              | none  |
| `set_tempo` (ack)                                               | `incoming-events.ts:152`                | sets, emits `tempo_changed`, acks tempo                                                             | none  |
| `get_track_volumes` (ack)                                       | `incoming-events.ts:156`                | `number[]`                                                                                          | none  |
| `set_track_volume` (**no ack**)                                 | `incoming-events.ts:164`                | sets, emits `volume_changed {pillar, volume}`                                                       | none  |
| `get_keylock_state` (ack)                                       | `incoming-events.ts:167`                | boolean                                                                                             | none  |
| `set_keylock_state` (ack)                                       | `incoming-events.ts:170`                | sets, acks new state, **no event emitted**                                                          | none  |
| `get_master-key` (ack)                                          | `incoming-events.ts:174`                | string                                                                                              | none  |
| `set_master-key` (**no ack**)                                   | `incoming-events.ts:177`                | sets, emits `master-key_changed {key}`                                                              | none  |
| `/new/tag` (in)                                                 | `incoming-events.ts:42-53,68-83`        | `TagDetectionData` → `ingredient_detected` + queue/trigger semantics; unknown rfid → warn, no event | none  |
| `/departed/tag` (in)                                            | `incoming-events.ts:54-65,85-101`       | → `ingredient_removed` + stop/unqueue semantics                                                     | none  |
| `ingredient_detected` (out)                                     | `incoming-events.ts:75`                 | metadata + `rfid`, `pillar`, `requestAddress`                                                       | none  |
| `ingredient_removed` (out)                                      | `incoming-events.ts:93`                 | metadata + `pillar`, `requestAddress` (no `rfid`, as real)                                          | none  |
| `timeout_warning` (out)                                         | `backend/ableton-api.ts:64-69`          | bare event, 30s before 3-min idle timeout, only while clips play                                    | none  |
| `clip_queued` (out)                                             | `ableton-api.ts:180`                    | `{pillar, ...metadata}` when queueing over playing audio                                            | none  |
| `clip_unqueued` (out)                                           | `ableton-api.ts:187,247`                | queued clip removed                                                                                 | none  |
| `clip_started` (out)                                            | `ableton-api.ts:333`                    | clip info + `bpm` on (re)start, followed by `volume_changed` (0.6)                                  | none  |
| `clip_playing` (out)                                            | `ableton-api.ts:331`                    | same-clip restart case                                                                              | none  |
| `clip_stopping` (out)                                           | `ableton-api.ts:216`                    | playing clip info on stop                                                                           | none  |
| `clip_stopped` (out)                                            | `ableton-api.ts:258,352`                | clip info + `pillar` (bare `{pillar}` when nothing was tracked / on timeout)                        | none  |
| `tempo_changed` / `volume_changed` / `master-key_changed` (out) | `ableton-api.ts:408,431,469`            | emitted on every corresponding set, including from clip starts                                      | none  |

Timeout-reset semantics mirror `EmitEvent` vs `EmitEventWithoutResetingTimout` (`backend/events/outgoing-events.ts`): `timeout_warning`, `clip_playing`, and `clip_stopped` do not reset the idle timer; everything else does.

## Assumptions made (documented approximations, not contract deltas)

- **Synchronous triggering**: the real backend fires clips through Ableton quantization, so `clip_started` lands a beat-aligned moment after `ingredient_detected`; the sim emits it immediately. Order is identical.
- **Phrase boundary**: queued clips trigger after a fixed `phraseLengthMs` (default 8s) instead of the phrase leader's loop end, which only the live set knows. When the last playing clip stops with clips queued, they trigger immediately (mirrors `StopOrRemoveClipFromQueue` → `TriggerQueuedClips`).
- **BPM source**: `clip_started.bpm` comes from the CSV BPM column instead of Ableton warp markers.
- **Sim-only defaults**: tempo 120, volumes 0.6×4 (real values come from the live set at startup).
- **Missing-clip branch not modeled**: the real backend emits `clip_unqueued` when a CSV clip has no matching clip in the live Ableton set (`backend/ableton-api.ts:185-191`). The sim has no live set, so every database clip "exists" and this branch never fires. Shapes and acks are unaffected. (Added per reviewer should-fix.)
- **Localhost-only bind** (`127.0.0.1`): deliberate — the sim must not be reachable from the installation network. The real backend binds wider; this is a dev-tool restriction, not a contract behavior.

## Decisions/questions waiting for the human

None — no contract ambiguity required a Decision entry. The socket.io devDependency was pre-approved (DECISIONS_NEEDED "Resolved", 2026-07-10).

## Safe validation run

- `yarn lint` ✅, `yarn test` ✅ (38 tests, incl. 33 new sim tests), `yarn build` ✅, `git diff --check` ✅.
- End-to-end demo executed: `yarn sim full-spell` + `yarn dev`, browser at the vite URL — ingredient appeared on pillar 1 with metadata, master key adopted (4A), tempo slider moved to 86 BPM, volume 0.6; UI tempo-slider drag observed arriving in the sim log as `set_tempo` and broadcast back as `tempo_changed`. Zero browser console errors.
- `backend/`, `Arduino/`, `src/assets/Music Database.csv` untouched (CSV read-only at runtime).

## Human-verifiable demo

1. Terminal 1: `yarn sim full-spell` — the console logs every event as the script places drums → melody → bass → vox on pillars 1–4, holds the spell, then removes the objects, looping forever.
2. Terminal 2: `yarn dev`, open the printed URL (e.g. `http://localhost:5173`).
3. Observe: ~2s in, an ingredient icon appears on pillar 1 and the tempo snaps to the clip's BPM and key (e.g. 86 BPM / 4A); more ingredients join every ~6s (queued clips start at the next phrase boundary, ~8s); after ~40s the ingredients disappear one by one.
4. Round-trip check: drag the BPM slider in the UI — the sim terminal logs `recv set_tempo …` and every open browser tab updates via `tempo_changed`. Same for the volume sliders and key controls.
5. Other scenarios: `yarn sim replace-ingredient` (one-object-per-pillar swap), `yarn sim timeout` (idle timeout; shorten the wait with `SIM_TIMEOUT_MS=20000 SIM_TIMEOUT_WARNING_MS=10000 yarn sim timeout`), `yarn sim idle` (manual driving, e.g. from the UI debug panel).

No hardware, Ableton, or network beyond `localhost:3335` is involved at any point.

## Suggested next prompt

Run the test-engineer prompt (`docs/agent-prompts/wow-003-test-engineer-prompts.md`) against this branch.
