# WOW-015 — Backend test bootstrap

## What was built

Three new colocated test files, zero production code changes:

- `backend/service/test/KeyTranspositionService.test.ts` — 28 tests. Confirms the
  24-entry Camelot table (12 major "B" + 12 minor "A") is internally consistent:
  every key maps every other same-letter key exactly once and never itself;
  every pair is symmetric (X→Y + Y→X sums to 0, or ±12 at the tritone where both
  directions agree in sign); the two `(verify pattern)`-flagged entries (`9B` at
  `KeyTranspositionService.ts:116`, `6A` at `:285`) are explicitly re-checked by
  name even though the general tests already cover them.
- `backend/service/test/PhraseLeaderService.test.ts` — 6 tests. Trigger-order
  promotion (first `AbletonAdapter.TRIGGER_ORDER` entry wins, falls back through
  the rest), all-null list returns `undefined` (coordinates with WOW-014's guard
  on the same return value), null slots ignored, defensive-copy-before-sort
  confirmed by asserting the input array is untouched. Imports
  `AbletonAdapter.TRIGGER_ORDER` directly rather than hardcoding
  `[Drums, Melody, Bass, Vox]`, so the test tracks the documented contract
  ("first entry wins") instead of today's specific ordering.
- `backend/util/test/CsvUtil.test.ts` — 9 tests. `parseCsv`: valid row populates
  both maps; empty/whitespace-only clip name or rfid skips the row entirely
  (neither map touched); multiple rows accumulate without clobbering. Confirms
  the space-stripped-key contract WOW-016 depends on
  (`clipNameToInfoMap['"DoinkU"Vox122']` exists, `clipNameToInfoMap['"Doink U" Vox 122']`
  does not) using a real-shaped quoted/spaced clip name.
  `enrichRecommendations`: groups same-`Key Numerical`-distance-≤1 clips by
  type under both the rfid- and name-keyed maps, excludes clips sharing the
  anchor's own name even under a different rfid, excludes out-of-range keys.

**Stop condition check (ticket-defined):** the transposition-symmetry and
`(verify pattern)` assertions all passed — 28/28. No table edit was made or
needed; if a future change to the table ever breaks these, per the ticket that
is a musical/artist decision, not something to "fix" in code.

## How backend tests run (decision required by the ticket)

Root-level `yarn test` (plain vitest, no per-package runner) already discovers
and runs `backend/**/test/**` with **zero `vite.config.ts` changes**. Confirmed
empirically: all three files above ran via `yarn test` from the repo root
without touching config, alongside the pre-existing `backend/adapter/test/AbletonAdapter.test.ts`
(landed on the unmerged `feat/wow-032-startup-timeout` branch, not yet in
`main`, but same mechanism). Decision: keep the root runner. No CI step change
needed — CI already runs `yarn test` at the root.

## Pre-existing, out-of-scope noise observed again

`PhraseLeaderService.test.ts` imports `AbletonAdapter.ts` (for `TRIGGER_ORDER`),
whose module-load chain reaches `MusicDatabaseService.ts:16`, which resolves
the CSV path via `path.join(process.cwd(), '../src/assets/...)` — correct only
when `cwd` is `backend/` (the real runtime), so it ENOENTs under root-level
`yarn test` (cwd = repo root). The error is caught and logged (pino `error`
level), not thrown, so it doesn't fail any test — just stderr noise on every
run that touches this import chain. Same bug already surfaced on WOW-032's
`AbletonAdapter.test.ts` and is tracked as a follow-up task
(`task_48341bc3`, filed during WOW-032). Not fixed here — out of scope per this
ticket's "any bug found is ticketed, not fixed here" rule, and touching
`MusicDatabaseService.ts` isn't in this ticket's allowed-files list.

## A TS-only fix, no behavior change

Two assertions originally used vitest's `expect(value, message)` two-argument
form for extra failure context. That form works at runtime (vitest re-exports
chai's assertion API, which accepts an optional message) but this project's
installed vitest type declarations only type `expect()` as single-argument —
`npx tsc --noEmit -p backend/tsconfig.json` (and the root config) both rejected
it with `TS2554`. Replaced the one case that needed a custom pre-check message
with a plain `if (backward === undefined) throw new Error(...)` before the
`expect([0, 12, -12]).toContain(...)` call; same failure behavior, no message
argument. Confirms clean under both `tsc` configs.

## Acceptance criteria checked

- [x] `yarn test` passes the new tests locally (111/111 total, 43 new)
- [x] Zero imports of `ableton-js`, `node-osc`, or `socket.io` directly in the
      three new test files (`grep` confirmed empty match)
- [x] No production code changes — diff is additive, three new files only
- [x] `(verify pattern)` entries (`9B`, `6A`) confirmed correct, not ticketed
- [x] `docs/CODING_GUIDELINES.md`'s cited example path
      (`backend/service/test/PhraseLeaderService.test.ts`) now exists and is
      correct as written — no correction needed, file left untouched
- [x] `yarn lint`, `yarn build` both clean

## Out of scope / deliberately not done

- Testing `AbletonAdapter` itself — needs an abstraction seam per the ticket;
  a separate future ticket, not this one (WOW-032 already added a narrow
  `parseRemoteScriptVersion` unit test on its own branch, unrelated to this
  ticket's scope).
- Fixing the `MusicDatabaseService` CWD bug — ticketed already, not fixed here.
- No `vite.config.ts` change — none was needed.
