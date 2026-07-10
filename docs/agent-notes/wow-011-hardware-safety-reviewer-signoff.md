# WOW-011 PR 2 (backend sweep) — hardware-safety-reviewer sign-off

- Reviewer: hardware-safety-reviewer (Claude Fable 5)
- Date: 2026-07-10
- Review target: `git diff feat/wow-011-frontend-sweep...feat/wow-011-backend-sweep` (PR #8, stacked)
- Base: `feat/wow-011-frontend-sweep` @ c475540 · Head: `feat/wow-011-backend-sweep` @ 5b4ef0d (both match origin)
- Method: static only. `yarn start-backend` was NOT run; nothing was sent to any hardware, Ableton, or network target. All claims in the implementer handoff (`wow-011-creative-tech-integrator-backend.md`) were re-verified independently from the git objects, not taken on trust.

## Verdict: **APPROVE**

No safety-relevant delta found. Every path that can reach speakers, LEDs, RFID readers, or pillar hardware is line-equivalent modulo renames/module grouping. Two non-blocking observations at the end.

---

## 1. Volume — PASS

- Auto-volume on clip start: `setTrackVolume(pillar, 0.6)` — constant `0.6` unchanged (`backend/adapter/AbletonAdapter.ts:339`, old `backend/ableton-api.ts` `SetTrackVolume(pillar, 0.6)`).
- `setTrackVolume` body identical: same lazy `getTrackVolumes()` refill, same `trackVolume?.set('value', volume)`, same `volume_changed` emit (`AbletonAdapter.ts:375-382`).
- `getTrackVolumes` device-search logic unchanged (only the function-name lines differ in the diff; body is context).
- The `set_track_volume` socket handler passes `{pillar, volume}` through unchanged (`backend/event/IncomingEvents.ts:165-167`).
- Keyword sweep of every added line in the diff (`volume|gain|ramp|db`) found only renames, type-file moves, and doc text — **no new constant, no ramp, no default change**.
- Live-binding hazard checked: `trackVolumes` is a reassigned `let`; the grouped `AbletonAdapter` exposes it via a **getter** (`AbletonAdapter.ts:456-460`), so `IncomingEvents`' reads see the current array exactly as the old `export let` binding did. No risk of a stale/empty volume array changing behavior.
- No changes to Ableton gain staging, timeout stop (`stop_all_clips` × 4, master key reset — identical), or the 180 000 ms / 30 000 ms timeout constants.

## 2. Lights / strobe — PASS

- Old `backend/events/outgoing-events.ts` vs new `backend/event/OutgoingEvents.ts` + `backend/adapter/LightingAdapter.ts`: the emission logic moved **untouched**. Verified side by side:
  - Address patterns exactly `/${pillar}/${eventName}` (pillar = `data.pillar + 1`) and `/${eventName}` — identical (`OutgoingEvents.ts:12-17`).
  - Payload: `message.append(data.type)` only when `data?.type` — identical (`LightingAdapter.ts:12-16`).
  - Send failure path: error-logged callback, audio unaffected — identical (`LightingAdapter.ts:18-20`).
- No timing, rate, brightness, or repetition change anywhere; keyword sweep for `strobe|flash|blink|flicker|brightness|setInterval` over all added lines: zero hits outside docs.
- Emit rate is governed by the same callers (`emitEvent`/`emitEventWithoutResetingTimout`) with identical call sites — no new loop or repeated-emit path that could produce flicker.

## 3. Pillar IP map / addresses / env — PASS

- `IP_ADDRESS_TO_PILLAR_INDEX_MAP` in `backend/event/IncomingEvents.ts:16-21` is **character-identical** (192.168.0.101→0 … 192.168.0.104→3); the diff hunk shows only the `export`→`const` keyword line changing above an unchanged map body.
- `getPillarIPAddressFromIndex` unchanged.
- Grep of all added lines for dotted quads: only doc prose and the implementer's handoff table — **no new hardcoded address** in code.
- `LIGHTING_SERVER_ADDRESS`/`LIGHTING_SERVER_PORT`, `WS_SEVER_PORT`, `OSC_SERVER_PORT` reads unchanged; `.env` not in the diff.

## 4. Emission surface inventory (independent) — PASS

Files matching `node-osc|ableton-js|dgram|net|serialport|artnet` in each tree (excluding package manifests/lockfiles, which are untouched):

| Old tree (base)                     | Capability                             | New tree (head)                            | Capability                                     |
| ----------------------------------- | -------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `backend/events/outgoing-events.ts` | **OSC client → lighting server**       | `backend/adapter/LightingAdapter.ts`       | **OSC client → lighting server** (sole client) |
| `backend/index.ts`                  | OSC **server** (inbound :9000)         | `backend/index.ts`                         | identical                                      |
| `backend/ableton-api.ts`            | ableton-js control + OSC server handle | `backend/adapter/AbletonAdapter.ts`        | identical                                      |
| `backend/events/incoming-events.ts` | `import type` from node-osc only       | `backend/event/IncomingEvents.ts`          | `import type` only                             |
| `backend/types.ts`                  | type-only ableton-js import            | `backend/type/ClipBoard.ts`, `ClipInfo.ts` | `import type` only                             |
| `sim/core/types.ts`                 | unchanged, not in diff                 | `sim/core/types.ts`                        | unchanged                                      |

Net: the set of hardware-capable modules did **not grow** — the OSC client consolidated 1:1 into `LightingAdapter`. `LightingAdapter.sendOscMessage` has exactly one importer (`OutgoingEvents.ts`) and two call sites, matching the old tree's private `SendOSCMessage`. No sim/test guard existed around the lighting client before, and none was added or removed — behavior parity, not a regression.

## 5. Startup / boot order — PASS

- `backend/index.ts` old vs new compared in full: `dotenv.config({path: resolve('..', '.env')})` on line 3 → `startAbleton()` → socket.io server (`WS_SEVER_PORT`) → `nodeOSC.Server` on `OSC_SERVER_PORT`/0.0.0.0 → identical `connection`/`listening`/`message` handlers. Only symbol names changed.
- Env-read timing for the lighting client: in both trees the client is constructed at module eval of the outgoing/lighting module, which is required transitively via the adapter import **after** `dotenv.config()` (line 3 precedes the import in both). The require chain changed (`ableton-api → outgoing-events` became `AbletonAdapter → OutgoingEvents → LightingAdapter`) but the relative order to dotenv is identical.
- The pre-existing adapter↔event module cycle resolves the same way: all cross-module references are call-time property accesses on grouped objects (TS CommonJS late binding), none at module-eval time.
- `backend/package.json` (nodemon `index.ts` entry) untouched, so `yarn start-backend` semantics are unchanged by construction.

## 6. Untouchables — PASS

`git diff --stat` over `Arduino/`, `src/assets/Music Database.csv`, `.env`, `backend/package.json`, `backend/yarn.lock`, root `package.json`/`yarn.lock`: **empty**. Grep for `wubb-net`/credentials in the new tree outside `Arduino/`: only pre-existing doc mentions of the SSID name (no password anywhere) — nothing new copied in this diff.

## 7. Docs / safety-rule path references — PASS

- `AGENTS.md`: pillar-IP-map rule now points at `backend/event/IncomingEvents.ts`, transposition rule at `backend/service/KeyTranspositionService.ts`, clip categories at `backend/type/ClipTypes.ts` — all real files at head.
- `docs/HARDWARE_INTEGRATION.md`, `docs/ARCHITECTURE.md`, `docs/ABLETON_INTEGRATION.md` path updates verified against the new tree.

## Supporting checks

- Transposition table: body (lines 2-340) diffed old vs new — **byte-identical**; only the binding name (`transpositions` → `TRANSPOSITIONS` + namespace wrapper) changed.
- `MusicDatabaseService`/`PhraseLeaderService`/`CsvUtil`/`LoggerUtil`: bodies moved verbatim (CSV path, Papa.parse config, TRIGGER_ORDER sort all identical).
- Frontend diff (`src/`): import-path updates only; no behavior.
- `yarn lint`: clean. `yarn test`: 48/48 pass (vitest, local, no hardware).

## Non-blocking observations (not safety findings)

1. **minor** — `docs/ARCHITECTURE.md:15`: the renamed diagram line (`AbletonAdapter.ts: …`) overflows the ASCII box border by two characters. Cosmetic.
2. **minor** — ~40 comments in `sim/core/*` still cite pre-migration paths/line numbers as provenance anchors (deliberate, flagged by the implementer for follow-up). No hardware impact; the sim never emits to hardware.

---

**Verdict: APPROVE.** Sign-off granted for merge of PR 2 under the AGENTS.md v0.4 conventions-migration exception (subject to the separately required audio-ableton-reviewer sign-off).
