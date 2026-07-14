# Ableton integration

Status: observed from `backend/adapter/AbletonAdapter.ts`, `backend/type/`, `backend/service/KeyTranspositionService.ts`, `backend/util/ClipNameUtil.ts` (pre-migration paths: `backend/ableton-api.ts`, `backend/types.ts`, `backend/key-transpositions.ts`). Verify with the human before relying on musical assumptions.

**Do not modify the Ableton project, routing, clip naming, transposition tables, quantization, trigger/key-leader order, or RFID→clip mappings without explicit human approval.**

## How samples are triggered

- `ableton-js` 3.1.5 bridges to a running Ableton Live set (requires the ableton-js MIDI remote script installed in Live — see README link). Discovery happens via `$TMPDIR/ableton-js-*.port` files; if macOS purged the server port file, the backend restores it automatically at startup (falling back to `yarn fix-ableton-port` manually — see README "Troubleshooting: backend hangs or exits at startup").
- On startup the backend loads all tracks and clips (`GetTracksAndClips`) and track volume parameters.
- An RFID `/new/tag` event → CSV lookup → `QueueClip(clipMetadata, pillar)`; clips are found by **normalized clip-name match** within the pillar's track (see "Clip-name matching" below — spaces and asterisks are ignored on both sides). Looped clips: the code finds all clips sharing a normalized name within a 20-slot window ("clips in loop").
- `/departed/tag` → `StopOrRemoveClipFromQueue`.
- 4 tracks correspond to pillars 0–3. Track 5+: TBD (attractor clip `Wicked Casting` lives somewhere — TBD which track).

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
- **Timeout:** 3 min inactivity → `stop_all_clips` on all 4 tracks, master key reset.

## Sample categories

Canonical (`ClipTypes`, confirmed by ADR-002): `Vox`, `Melody`, `Bass`, `Drums`.

## Mapping: RFID → object → clip

`src/assets/Music Database.csv` columns: RFID (EPC), Asset ID, Ingredient Name/Description, tested flag, comments, Artist, Song Title, **Clip Name** (must match the Ableton clip name after normalization — spaces/asterisks/whitespace differences are ignored, see "Clip-name matching" above), Clip Type, Instrument, Key, Major/Minor, Key Numerical, BPM, Icon/Asset Name. Parsed at backend startup (`backend/util/CsvUtil.ts` → `MusicDatabaseService.rfidToClipMap`, `.clipNameToInfoMap`); also imported by the frontend. **Production data — never edit without approval.**

## Test / simulation approach

- Current: debug modal in the UI can emit simulated `/new/tag`-equivalent websocket events — but these drive the **real** backend and real Ableton.
- There is no Ableton-free simulation mode. Building one is a pending decision (see ARCHITECTURE.md "Decision needed").
- Agents must not write tests that require a live Ableton connection.
