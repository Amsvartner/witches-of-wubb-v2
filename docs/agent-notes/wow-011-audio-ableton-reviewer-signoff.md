# WOW-011 PR 2 (backend sweep) — audio-ableton-reviewer sign-off

- Reviewer: audio-ableton-reviewer (Claude Fable 5), read-only
- Date: 2026-07-10
- Review target: `git diff feat/wow-011-frontend-sweep...feat/wow-011-backend-sweep` (PR #8, head `5b4ef0d`, stacked on PR 1 branch)
- Old-tree reference: `origin/main`
- Method: static only. `yarn start-backend` was NOT run. Checks ran in a detached scratch worktree at `5b4ef0d` (node_modules linked from the main checkout), removed afterward.

## Verdict: **approve-with-nits**

No musical, timing, mapping, or payload delta found. Every hunk in the backend diff is one of: import-path change, identifier rename per the declared map, grouped-namespace-export wrapping, or prettier line-wrap. Nits are documentation-only (stale paths) and do not touch the musical contract.

---

## Per-item verification

### 1. Transposition table — byte-for-byte ✓

- Extracted `origin/main:backend/key-transpositions.ts` (340 lines) and `feat/wow-011-backend-sweep:backend/service/KeyTranspositionService.ts` (344 lines).
- `cmp` of lines 2–339 (the entire table body, all 24 Camelot keys × mappings): **byte-identical**.
- Only deltas: line 1 `export const transpositions` → `const TRANSPOSITIONS` (binding rename, not exported directly) and the 4-line `export const KeyTranspositionService = { TRANSPOSITIONS }` tail.
- Both usage sites (`AbletonAdapter.ts:506–507`, old `ableton-api.ts:498–499`) are the same two-branch keylock lookup `TRANSPOSITIONS[key][newKey] : TRANSPOSITIONS[key][backupKey]) ?? 0` — unchanged.

### 2. Queue/stop/replace + phrase-leader/trigger-order — moved, not modified ✓

- Applied the declared rename map (sed on `origin/main:backend/ableton-api.ts`) and diffed against `backend/adapter/AbletonAdapter.ts` (510 → 560 lines). The residual diff is exactly: import restructure, `export` keyword removal (moved to the grouped export), namespace prefixes (`OutgoingEvents.`, `IncomingEvents.`, `PhraseLeaderService.`, `MusicDatabaseService.`, `KeyTranspositionService.`), one prettier line-wrap at the `clipNameToInfoMap` lookup (AbletonAdapter.ts:312–313), and the 42-line grouped-export block at the end. **Zero logic lines changed.**
- `TRIGGER_ORDER = [Drums, Melody, Bass, Vox]` (AbletonAdapter.ts:46) and `KEY_LEADER_ORDER = [Vox, Melody, Bass, Drums]` (AbletonAdapter.ts:47): unchanged.
- `PhraseLeaderService.findNextPhraseLeader` (backend/service/PhraseLeaderService.ts): sort body identical to old `is-new-phrase-leader.ts`; `TRIGGER_ORDER` is read at call time via `AbletonAdapter.TRIGGER_ORDER` inside the function — same late-binding shape as the old cyclic import.
- `queueClip` replace-on-same-pillar, missing-clip warn branch, `clip_queued`/`clip_unqueued` emissions, `stopOrRemoveClipFromQueue` phrase-leader promotion + `triggerQueuedClips()` chain, `addPhraseLeader` loop-end listener (`endTime - 1` trigger point): all byte-equivalent modulo renames.
- `ClipTypes` enum (backend/type/ClipTypes.ts): still a runtime enum, values `Vox`/`Melody`/`Bass`/`Drums` unchanged.

### 3. Timing constants and event ordering ✓

- `TIMEOUT_IN_MILISECONDS = 60 * 3 * 1000` (180 000) — AbletonAdapter.ts:26; `TIMEOUT_WARNING_IN_MILISECONDS = 30 * 1000` (30 000) — AbletonAdapter.ts:27. Unchanged.
- Phrase-leader `playing_position` throttle wait `300` — AbletonAdapter.ts:293 vs old ableton-api.ts:285. Unchanged; surrounding listener body byte-identical.
- Auto-volume on clip start `setTrackVolume(pillar, 0.6)` — AbletonAdapter.ts:342. Unchanged.
- `emitEvent` (resets timeout via `restartTimeoutTimer()`) vs `emitEventWithoutResetingTimout` (does not): both preserved in `OutgoingEvents`, same call sites use the same variant as before (e.g. `timeout_warning`, `clip_playing`, second `clip_stopped` remain non-resetting). Statement order inside every handler unchanged.

### 4. Tempo/key/volume paths incl. ack semantics ✓

Compared `backend/event/IncomingEvents.ts` vs `origin/main:backend/events/incoming-events.ts` (rename-normalized diff; also read old handlers in full):

- `get_tempo` → ack with tempo; `set_tempo` → ack with tempo (echo); `get_track_volumes` → ack with formatted volumes; **`set_track_volume` → no ack**; `get_keylock_state`/`set_keylock_state` → ack with current state; `get_master-key` → ack; **`set_master-key` → no ack**. All identical to old tree — the ack/no-ack asymmetry is preserved exactly.
- `get_playing_clips`/`get_queued_clips` map-and-strip (`clip` field removed via destructure) unchanged.
- The lazy `trackVolumes` fetch guard `if (!AbletonAdapter.trackVolumes?.length) await AbletonAdapter.getTrackVolumes()` is the same as old `if (!trackVolumes?.length) await GetTrackVolumes()`.
- Only non-mechanical-looking hunk is a prettier line-wrap of the `ingredient_detected` payload spread (IncomingEvents.ts:61–67) — identical properties, identical order.

### 5. Independent OSC/event inventory (rebuilt by grep on both trees) ✓

Emitted socket/lighting events (`emitEvent*` call sites), old vs new — **identical sets and counts**:
`clip_playing`(1), `clip_queued`(1), `clip_started`(1), `clip_stopped`(2), `clip_stopping`(1), `clip_unqueued`(2), `ingredient_detected`(1), `ingredient_removed`(1), `master-key_changed`(1), `tempo_changed`(1), `timeout_warning`(1), `volume_changed`(1).

`socket.on` handlers, old vs new — **identical**: `disconnect`(2), `get/set_tempo`, `get_track_volumes`, `set_track_volume`, `get/set_keylock_state`, `get/set_master-key`, `get_playing_clips`, `get_queued_clips`; plus OSC/websocket tag addresses `/new/tag`, `/departed/tag` (1 each in both trees).

Lighting OSC address templates — identical: `/${pillar}/${eventName}` (pillar = index+1) and `/${eventName}` (OutgoingEvents.ts:14,16 vs old outgoing-events.ts:28,30). `sendOscMessage` body (message construction, `data.type` append, error-logged send) moved verbatim into `backend/adapter/LightingAdapter.ts`. Env reads (`LIGHTING_SERVER_ADDRESS`/`PORT`) still at module eval; `dotenv.config()` in `index.ts` still precedes the adapter require chain (TS CommonJS emit preserves the interleaved statement order, lines 1–7 of index.ts untouched).

### 6. RFID→clip resolution, CSV, pillar IP map ✓

- `backend/service/MusicDatabaseService.ts` vs old `get-clip-from-rfid.ts`: CSV path (`../src/assets/Music Database.csv`), Papa.parse options (`header: true`, `:`-stripping transformHeader), `CsvUtil.parseCsv.bind(this, ...)` population, commented-out `enrichRecommendations` still commented — all identical.
- `backend/util/CsvUtil.ts` vs old `parse-csv.ts`: body identical; only export style changed.
- `src/assets/Music Database.csv`: **zero diff** vs both frontend-sweep branch and origin/main.
- Pillar IP map `192.168.0.101–104 → 0–3` (IncomingEvents.ts:15–20): byte-identical, same file role; lookup sites unchanged.
- RFID lookup `MusicDatabaseService.rfidToClipMap[rfid]` and clip-name normalization `clipName.replace(/[* ]/g, '')` unchanged.

### 7. Live-binding mechanics (getter spot-check) ✓

- Old: `export let trackVolumes` / `export let tracks` consumed via CommonJS namespace property access → live.
- New: `AbletonAdapter` grouped export defines `get trackVolumes()` / `get tracks()` (AbletonAdapter.ts:531–537) returning the module-local `let`s. Every read (`IncomingEvents.ts:148–149`) is a call-time property access invoking the getter — **cannot go stale**.
- Stale-risk pattern would be destructuring the getter into a local; grep across `backend/`, `src/`, `sim/` on the branch: **no destructuring of any grouped namespace object exists**.
- Const array references (`playingClips`, `queuedClips`, `stoppingClips`, `sockets`) are direct references on the namespace object; they are never reassigned (verified: only `push`/`splice`/index mutation in AbletonAdapter), so shared-reference mutation semantics are preserved.
- Module cycles (adapter ↔ event, adapter ↔ PhraseLeaderService): verified statically that no module reads a cross-module namespace property at eval time (only `const logger = LoggerUtil.logger`, and LoggerUtil is acyclic); all cyclic uses are inside function bodies → same partial-export tolerance as the old tree. tsconfig (`@tsconfig/recommended`, CommonJS emit) and backend/package.json untouched.

### Coverage / scope checks

- Old backend file set fully accounted for by the rename map; no backend file added beyond the declared split (plus `backend/type/Maybe.ts`, a ticket-mandated unused type alias — no runtime content).
- Old `export let` bindings dropped from the public surface (`timeoutId`, `timeoutWarningId`, `allAbletonClips`, `phraseLeader`, `cleanUpPhraseLeaderEventListener`, `keyLockEnabled`, `masterKey`): grep of the old tree shows **zero external consumers** — surface reduction only, no behavioral impact.
- `sim/` untouched (zero diff). Frontend files in this PR change only backend import paths (type-only + `CsvUtil` namespace call; `ClipDatabaseUtil.ts` bind-call semantics identical).
- `interface WarpMarker` → `type` (backend/type/WarpMarker.ts): type-level only.
- Deliberately preserved misspelling `emitEventWithoutResetingTimout`: confirmed, name fidelity kept.

### Checks run

- `yarn lint` ✓, `yarn test` ✓ 48/48, `yarn build` ✓ (tsc + vite) at `5b4ef0d` in a scratch worktree. (An initial 1-file failure was an artifact of my worktree missing `backend/node_modules`; after linking it, all green — matches implementer's claim.)

---

## Findings

| #   | Severity   | Location                                        | Finding                                                                                                                                                                                                   |
| --- | ---------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | nit (docs) | `docs/ABLETON_INTEGRATION.md:18`                | Key-leader-order bullet still cites `utils/is-new-phrase-leader.ts` (now `backend/service/PhraseLeaderService.ts`). Ticket AC requires stale paths updated in the same PR.                                |
| 2   | nit (docs) | `docs/ABLETON_INTEGRATION.md:29`                | CSV-parsing note still cites `utils/parse-csv.ts` (now `backend/util/CsvUtil.ts`).                                                                                                                        |
| 3   | nit (docs) | `docs/DATA_MODEL.md:3`, `docs/DATA_MODEL.md:34` | Still cite `backend/types.ts` and `get-clip-from-rfid.ts`.                                                                                                                                                |
| 4   | nit (docs) | `docs/TECH_STACK.md:13`                         | "Frontend imports `backend/types` directly" — now `backend/type/*`.                                                                                                                                       |
| 5   | info       | `sim/core/simulator.ts` (~19 anchors)           | Pre-migration path+line provenance comments — declared deviation in the handoff, acceptable as historical anchors; optional follow-up. ADR path mentions are historical records and correctly left alone. |

No musical findings. Implementer's equivalence table verified independently — all claims held.

## Verdict

**approve-with-nits** — nits are stale documentation paths only (findings 1–4, fixable in this PR or PR 3); the musical contract of `docs/ABLETON_INTEGRATION.md` is preserved byte-for-byte. Nothing was unverifiable statically; no escalation required. Reminder per stack terms: hardware-safety-reviewer sign-off is also required before merge — this note covers only the audio/Ableton mandate.
