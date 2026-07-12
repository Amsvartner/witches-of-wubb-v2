# Ableton integration

Status: observed from `backend/adapter/AbletonAdapter.ts`, `backend/type/`, `backend/service/KeyTranspositionService.ts` (pre-migration paths: `backend/ableton-api.ts`, `backend/types.ts`, `backend/key-transpositions.ts`). Verify with the human before relying on musical assumptions.

**Do not modify the Ableton project, routing, clip naming, transposition tables, quantization, trigger/key-leader order, or RFID→clip mappings without explicit human approval.**

## How samples are triggered

- `ableton-js` 3.1.5 bridges to a running Ableton Live set (requires the ableton-js MIDI remote script installed in Live — see README link).
- On startup the backend loads all tracks and clips (`GetTracksAndClips`) and track volume parameters.
- An RFID `/new/tag` event → CSV lookup → `QueueClip(clipMetadata, pillar)`; clips are found by **exact clip-name match (trimmed)** within the pillar's track. Looped clips: the code finds all clips sharing a name within a 20-slot window ("clips in loop").
- `/departed/tag` → `StopOrRemoveClipFromQueue`.
- 4 tracks correspond to pillars 0–3. Track 5+: TBD (attractor clip `Wicked Casting` lives somewhere — TBD which track).

## Musical constraints

- **Trigger order:** `Drums → Melody → Bass → Vox` (`TRIGGER_ORDER`). Also governs phrase-leader selection: `PhraseLeaderService.findNextPhraseLeader` sorts playing clips by this same order and picks the first, determining the timing/key reference clip.
- **Correction (WOW-023):** this doc previously described a separate "key-leader order" (`KEY_LEADER_ORDER`, `Vox → Melody → Bass → Drums`) as governing phrase-leader/timing-key reference. Verified by reading `PhraseLeaderService.ts` directly: that constant was never actually referenced by it, or anywhere else in the codebase (confirmed via a repo-wide grep before removing it as dead code) — `TRIGGER_ORDER` alone governs both triggering priority and phrase-leader selection, as stated above.
- **Key lock:** enabled by default (`keyLockEnabled = true`); a master key is set from playing clips and others are transposed to match via `KeyTranspositionService.ts` (Camelot-style notation, e.g. `4A` minor). Departing clips clean up their transposition.
- **Tempo:** get/set via websocket events; clips are BPM-annotated in the CSV (multiple BPMs exist, e.g. 86). Warp/quantization assumptions: clips have warp markers; details TBD.
- **Timeout:** 3 min inactivity → `stop_all_clips` on all 4 tracks, master key reset.

## Sample categories

Canonical (`ClipTypes`, confirmed by ADR-002): `Vox`, `Melody`, `Bass`, `Drums`.

## Mapping: RFID → object → clip

`src/assets/Music Database.csv` columns: RFID (EPC), Asset ID, Ingredient Name/Description, tested flag, comments, Artist, Song Title, **Clip Name** (must match Ableton clip name exactly), Clip Type, Instrument, Key, Major/Minor, Key Numerical, BPM, Icon/Asset Name. Parsed at backend startup (`backend/util/CsvUtil.ts` → `MusicDatabaseService.rfidToClipMap`, `.clipNameToInfoMap`); also imported by the frontend. **Production data — never edit without approval.**

## Test / simulation approach

- Current: debug modal in the UI can emit simulated `/new/tag`-equivalent websocket events — but these drive the **real** backend and real Ableton.
- There is no Ableton-free simulation mode. Building one is a pending decision (see ARCHITECTURE.md "Decision needed").
- Agents must not write tests that require a live Ableton connection.
