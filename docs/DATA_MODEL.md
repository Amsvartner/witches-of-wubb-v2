# Data model

Status: observed. There is no formal schema; the model is implied by `backend/types.ts` and the CSV. Proposed formalizations are marked **(draft)**.

## Core entities (observed)

**RFID tag** — 24-hex EPC string, primary key of the whole system.

**Object ("ingredient")** — physical prop; represented only as CSV row fields: `Asset ID`, `Ingredient Name / Description`, `Icon / Asset Name` (confirmed 2026-07-09: icons in `public/ingredients/` match this column). Confirmed: **one object per pillar at a time**.

**Clip (sample)** — `ClipMetadataType`: `clipName` (must equal Ableton clip name), `type` (ClipTypes: Vox | Melody | Bass | Drums), `artist`, `songTitle`, `bpm`, `key` (Camelot, e.g. `4A`), `ingredientName`, `assetName`, optional `recommendedClips` per type (drives grimoire suggestions).

**Pillar** — integer 0–3, derived from reader IP (`IP_ADDRESS_TO_PILLAR_INDEX_MAP`). 1-indexed in outgoing OSC addresses.

**Placement state** — backend module-level arrays indexed by pillar: `queuedClips`, `playingClips`, `stoppingClips` (`ClipList`); plus `phraseLeader`, `masterKey`, `keyLockEnabled`, `trackVolumes`. Held in memory only; lost on restart.

**LED state** — not modeled in this repo; lighting server derives it from mirrored OSC events. TBD.

**Ableton mapping** — `ClipBoard`: per-track array of ableton-js `Clip` objects, matched to CSV by clip name.

**UI state** — React contexts mirror backend state via socket.io request/response (`get_*` events) and pushed events (`ingredient_detected`, `ingredient_removed`, `timeout_warning`); `use-grimoire` adds client-only spell name/recipe state.

## Identity chain

```
RFID EPC → CSV row → clipName → Ableton Clip(s) on track[pillar]
        ↘ ingredient metadata → UI display (icon, names)
```

## Gaps / questions (draft proposals — need human confirmation)

- No versioning or validation of the CSV; a typo silently breaks a tag. **(draft)** propose a startup validation report (CSV vs. Ableton clip names) — read-only, safe.
- Placement state is in-memory; no persistence or reconciliation after backend restart mid-show. TBD if acceptable.
- `recommendedClips` enrichment appears disabled (commented out in `get-clip-from-rfid.ts`) — grimoire may run on partial data. Verify.
- ~~Category naming discrepancy~~ — resolved: `Vox, Melody, Bass, Drums` (ADR-002).
- Should the data model formally include LED state and reader health? TBD.
