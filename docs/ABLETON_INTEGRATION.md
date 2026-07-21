# Ableton integration

Status: observed from `backend/adapter/AbletonAdapter.ts`, `backend/type/`, `backend/service/KeyTranspositionService.ts`, `backend/util/ClipNameUtil.ts` (pre-migration paths: `backend/ableton-api.ts`, `backend/types.ts`, `backend/key-transpositions.ts`). Verify with the human before relying on musical assumptions.

**Do not modify the Ableton project, routing, clip naming, transposition tables, quantization, trigger/key-leader order, or RFID→clip mappings without explicit human approval.**

## How samples are triggered

- `ableton-js` 3.1.5 bridges to a running Ableton Live set (requires the ableton-js MIDI remote script installed in Live — see README link). Discovery happens via `$TMPDIR/ableton-js-*.port` files; if macOS purged the server port file, the backend restores it automatically at startup (falling back to `yarn fix-ableton-port` manually — see README "Troubleshooting: backend hangs or exits at startup").
- On startup the backend loads all tracks and clips (`GetTracksAndClips`) and track volume parameters.
- An RFID `/new/tag` event → CSV lookup → `QueueClip(clipMetadata, pillar)`; clips are found by **normalized clip-name match** within the pillar's track (see "Clip-name matching" below — spaces and asterisks are ignored on both sides). Looped clips: the code finds all clips sharing a normalized name within a 20-slot window ("clips in loop").
- `/departed/tag` → `StopOrRemoveClipFromQueue`.
- 4 tracks correspond to pillars 0–3. Track 5 (0-based index 4, `DRUM_RACK_TRACK_INDEX`) is the "cauldron" drum-rack track (WOW-007C — see "Cauldron drum-rack sample & loudness" below). Beyond that: TBD (attractor clip `Wicked Casting` lives somewhere — TBD which track; not the same track as the cauldron).

## Clip-name matching and naming rules (WOW-031)

Human decision (2026-07-12): clip names in the Live set may freely contain spaces and asterisks, and matching must be robust to both. Since WOW-031 (PR #29), every backend clip-name comparison — Live-set clip lookup, loop-block grouping, memo cache keys, playing/queued checks — goes through `ClipNameUtil.normalizeClipName` (`backend/util/ClipNameUtil.ts`), which strips asterisks and **all** whitespace (`/[*\s]/g`, so also tabs, non-breaking spaces, and BOMs) from both sides before comparing. The offline simulator applies the same normalization (`sim/core/simulator.ts`).

This makes two naming conventions for the Live set hard rules (source: the 2026-07-12 decision plus the audio-ableton-reviewer re-sign-off, `docs/agent-notes/wow-031-audio-ableton-reviewer-resignoff.md`, finding 3):

1. **Distinct clips must differ by more than spaces/asterisks/whitespace.** Decoration-only variants (`Verse`, `Verse *`, `Ve rse`) are the same clip to the backend; when several slots match, the earliest one silently wins.
2. **Loop blocks must remain contiguous runs of same-normalized-name slots.** The loop finder takes everything between the first and last normalized match in its 20-slot window, so a different clip interleaved inside a block gets pulled into the block and would be wrongly transposed under key lock.

Decoration uniformity within a loop block — human decision (2026-07-14), answering the audio-ableton-reviewer re-sign-off's finding 2: samples are generated and named by hand; identical decoration across one clip's loop-block slots is the intention but is **not guaranteed** (human error is possible), so the backend must not assume it. Today two comparisons in the `playing_slot_index` listener (`backend/adapter/AbletonAdapter.ts:468`, `:492`) still compare raw names: a decoration mismatch between consecutive slots of one block would de-transpose the playing block under key lock and emit `clip_started` instead of `clip_playing`. A fast-follow ticket normalizes these two comparisons; until it lands, treat identical decoration within a block as a Live-set requirement and double-check it when adding samples.

## Musical constraints

- **Trigger order:** `Drums → Melody → Bass → Vox` (`TRIGGER_ORDER`). Also governs phrase-leader selection: `PhraseLeaderService.findNextPhraseLeader` sorts playing clips by this same order and picks the first, determining the timing/key reference clip.
- **Correction (WOW-023):** this doc previously described a separate "key-leader order" (`KEY_LEADER_ORDER`, `Vox → Melody → Bass → Drums`) as governing phrase-leader/timing-key reference. Verified by reading `PhraseLeaderService.ts` directly: that constant was never actually referenced by it, or anywhere else in the codebase (confirmed via a repo-wide grep before removing it as dead code) — `TRIGGER_ORDER` alone governs both triggering priority and phrase-leader selection, as stated above.
- **Key lock:** enabled by default (`keyLockEnabled = true`); a master key is set from playing clips and others are transposed to match via `KeyTranspositionService.ts` (Camelot-style notation, e.g. `4A` minor). Departing clips clean up their transposition.
- **Tempo:** get/set via websocket events; clips are BPM-annotated in the CSV (multiple BPMs exist, e.g. 86). Warp/quantization assumptions: clips have warp markers; details TBD.
- **Timeout:** runtime-configurable idle timeout (WOW-007C; was a fixed 3-minute constant) → `stop_all_clips` on all 4 tracks, master key reset. Default unchanged (3 min, enabled). See "Idle-timeout config" below.

## Cauldron drum-rack sample & loudness (WOW-007C)

Ported from upstream `j-pollack/witches-of-wubb` commit `633d67a` ("trigger random drum rack sample"), reimplemented in this repo's conventions with fixes (see `backend/adapter/AbletonAdapter.ts`, the "WOW-007C" comment block above `getDrumRackClips`).

- **`DRUM_RACK_TRACK_INDEX`** (`.env`, 0-based, default `4`): the Live set's drum-rack track, after the four pillar tracks (0–3). Its clips should be short **one-shots** — every tap fires a random one from the cache. Its **mixer track volume doubles as the cauldron loudness control** (`getCauldronVolume`/`setCauldronVolume`), independent of pillar volumes; same `[0, 0.7]` ceiling as pillar volumes (`clampVolume`).
- Unset or invalid (non-integer/negative) `DRUM_RACK_TRACK_INDEX` disables the cauldron-tap and cauldron-volume features cleanly (backend logs a warning at startup) — it does not block the rest of the installation from starting, and a missing/misconfigured track is never fatal.
- The drum-rack clip cache (`drumRackClips`) is fetched once at startup (after `getTracksAndClips`) and lazily refetched by `triggerRandomDrumSample` whenever it's empty or a fire fails (stale-clip recovery).
- `triggerRandomDrumSample` fires the picked clip **before** broadcasting `cauldron_sample_triggered` (fire-then-emit — the browser/lighting side only learns a sample triggered once it actually has) and is throttled (200ms, no trailing edge) so a flurry of taps can't flood Ableton with `fire()` calls.
- A cauldron tap counts as visitor activity and resets the idle timeout, same as any other interaction (uses `OutgoingEvents.emitEvent`, not the without-reset variant).

New socket events (frozen contract additions):

| Event                       | Direction    | Payload                | Ack                           |
| --------------------------- | ------------ | ---------------------- | ----------------------------- |
| `trigger_cauldron_sample`   | UI → backend | none                   | none                          |
| `cauldron_sample_triggered` | backend → UI | `{ clipName: string }` | —                             |
| `get_cauldron_volume`       | UI → backend | none                   | `number` (raw volume, 0..0.7) |
| `set_cauldron_volume`       | UI → backend | `{ volume: number }`   | none                          |
| `cauldron_volume_changed`   | backend → UI | `{ volume: number }`   | —                             |

## Idle-timeout config (WOW-007C)

The previously-fixed 3-minute idle timeout / 30-second warning offset (`TIMEOUT_IN_MILLISECONDS`/`TIMEOUT_WARNING_IN_MILLISECONDS`) is now runtime-configurable via socket events, so the DJ can tune or disable the idle handover from the Settings modal without a redeploy:

- The warning offset (30s) stays fixed and un-configurable — only the overall timeout duration and whether it's enabled at all are exposed.
- Bounds: `timeoutMs` must be an integer in `[60_000, 3_600_000]` (60s–60min); an out-of-bounds value is ignored (warned, config unchanged) rather than clamped or guessed. The 60s floor sits deliberately ABOVE the fixed 30s warning offset — at a lower floor the warning timer would arm with a zero/negative delay and fire instantly on every activity reset (do not "restore" a 30s minimum).
- **Disabling the timeout means spells loop indefinitely and the Live-set attractor never engages** — the pause-music toggle in the Settings modal is exactly this enable/disable switch. This only controls the backend's own idle-timeout handover (`stop_all_clips` + master-key reset); it does not know about or change the Live-side attractor clip (`Wicked Casting`) itself, which is a separate, still-TBD piece of the Live set (see "How samples are triggered" above).
- Same three-minute default as before if never configured.

New socket events:

| Event                  | Direction    | Payload                                   | Ack                                                      |
| ---------------------- | ------------ | ----------------------------------------- | -------------------------------------------------------- |
| `get_idle_timeout`     | UI → backend | none                                      | `{ enabled: boolean; timeoutMs: number }`                |
| `set_idle_timeout`     | UI → backend | `{ enabled: boolean; timeoutMs: number }` | `{ enabled: boolean; timeoutMs: number }` (optional ack) |
| `idle_timeout_changed` | backend → UI | `{ enabled: boolean; timeoutMs: number }` | —                                                        |

`idle_timeout_changed` broadcasts via `emitEventWithoutResettingTimeout` — changing the setting is not itself visitor activity.

### DJ-mode suppression (WOW-007C item 4)

The idle timeout must never hand over to the Live-set attractor while a DJ is actively supervising the installation through the extended DJ controls — that's supervised operation, not visitor idleness. The frontend (`PlayModeContainer`) tells the backend whenever DJ mode is entered or exited via `set_dj_mode`; the backend tracks this in a module-level `djModeActive` flag and gates timer arming on it the same way it already gates on `idleTimeoutEnabled`:

- `startTimeoutTimer` arms nothing while `djModeActive` is true (same early-return shape as the `!idleTimeoutEnabled` guard above it).
- `setDjModeActive` validates the payload is a boolean (a non-boolean is ignored — warned, state unchanged, same "no surprises" posture as `setIdleTimeoutConfig`'s out-of-bounds guard), assigns, logs, broadcasts `dj_mode_changed` via `emitEventWithoutResettingTimeout`, then calls `restartTimeoutTimer()` — which always clears any already-armed timers first, so entering DJ mode also cancels a timer that was already ticking down, and leaving DJ mode re-arms it immediately rather than waiting for the next visitor activity.
- `djModeActive` is **deliberately not persisted** — a plain module-level `let`, reset to `false` on every backend restart. Same failsafe posture as `idleTimeoutEnabled`/`idleTimeoutMs`: if the backend restarts mid-DJ-set, it comes back up with the timeout armed (the safe default), not silently stuck suppressed forever. This is why the frontend re-asserts the current mode on every `connect` event, not just on mode changes — a freshly (re)connected backend has forgotten DJ state entirely.
- The DJ auto-exit walk-away timer (`PlayModeContainer`, drops back to play mode after an idle DJ-mode period) and an explicit Settings-modal mode switch both go through the same `setMode` → `set_dj_mode({active:false})` path — restoring the idle timeout on walk-away is that exact chain, not a separate mechanism.
- **Last-client failsafe** (audio-ableton delta review): all of the above recovery paths live in the frontend, so if the last connected UI dies while DJ mode is active (browser crash, kiosk power loss), the backend clears `djModeActive` itself when the last web client disconnects (`handleLastWebClientDisconnected`, wired in `backend/index.ts`). No supervising UI = timeout armed. A transient socket drop is harmless: the frontend re-asserts its mode on every reconnect, restoring suppression within a second if the DJ session is genuinely still running.

New socket events (frozen contract addition):

| Event             | Direction    | Payload               | Ack |
| ----------------- | ------------ | --------------------- | --- |
| `set_dj_mode`     | UI → backend | `{ active: boolean }` | —   |
| `dj_mode_changed` | backend → UI | `{ active: boolean }` | —   |

`sim/core/simulator.ts` mirrors this exactly (`djModeActive`, `getDjModeActive`/`setDjModeActive`, the same `restartTimeoutTimer` early-return), per the ADR-001 sim-parity contract.

## Desired volume on clip start (WOW-007C, human request)

Previously every clip start on a pillar hard-reset that pillar's volume to a hardcoded `0.6`. Now the backend remembers the last volume a caller explicitly asked for on each pillar (`desiredVolumes`, via `setTrackVolume`) and restores that instead (`resolveClipStartVolume`), falling back to `0.6` only for a pillar whose volume has never been explicitly set. This lets a DJ pre-set a pillar's level (including an empty one, in DJ mode) before anything plays there, without it being clobbered on the next clip start.

## Startup playing-state rebuild (WOW-007C, human bug report)

A backend restart over a still-looping Live set (nodemon restarts on file changes and crashes) used to leave `playingClips` empty until the next slot transition, so a UI reload showed empty pillars over audible music. `getTracksAndClips` now reads each pillar's current `playing_slot_index` and rebuilds the state (`rebuildPillarPlayingState`) — state-only: no emissions, no volume writes, no tempo/key adoption. It also re-establishes the phrase leader over the rebuilt clips (`findNextPhraseLeader` + `addPhraseLeader`, listener registration only) — without a leader, queued clips have no firing path and the first post-restart placement would queue forever (audio-ableton review, PR #56).

Audible caveat: after a restart the master key is empty, so the **first placed clip's key is adopted** and key-lock then transposes every rebuilt clip to it — a mid-loop `pitch_coarse` jump on any rebuilt clip not already in that key. Same class of event as normal key adoption; expected, not a bug.

## Sample categories

Canonical (`ClipTypes`, confirmed by ADR-002): `Vox`, `Melody`, `Bass`, `Drums`.

## Mapping: RFID → object → clip

`src/assets/Music Database.csv` columns: RFID (EPC), Asset ID, Ingredient Name/Description, tested flag, comments, Artist, Song Title, **Clip Name** (must match the Ableton clip name after normalization — spaces/asterisks/whitespace differences are ignored, see "Clip-name matching" above), Clip Type, Instrument, Key, Major/Minor, Key Numerical, BPM, Icon/Asset Name. Parsed at backend startup (`backend/util/CsvUtil.ts` → `MusicDatabaseService.rfidToClipMap`, `.clipNameToInfoMap`); also imported by the frontend. **Production data — never edit without approval.**

## Test / simulation approach

- Current: debug modal in the UI can emit simulated `/new/tag`-equivalent websocket events — but these drive the **real** backend and real Ableton.
- There is no Ableton-free simulation mode. Building one is a pending decision (see ARCHITECTURE.md "Decision needed").
- Agents must not write tests that require a live Ableton connection.
