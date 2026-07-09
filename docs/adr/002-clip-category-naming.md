# 002. Clip category naming follows the implementation

Date: 2026-07-09
Status: accepted

## Context

The initial brief described categories as "bass, base, melody, vocal"; the code, CSV, and Ableton set use `Vox`, `Melody`, `Bass`, `Drums` (`ClipTypes` in `backend/types.ts`).

## Decision

Canonical categories are **Vox, Melody, Bass, Drums** — follow the implementation. No renames anywhere (types, CSV, Ableton, UI copy may present friendly labels but the identifiers stay).

## Consequences

- High-blast-radius rename avoided.
- UI/LED color-coding keys off these four values (LEDs already light per category, externally handled).
