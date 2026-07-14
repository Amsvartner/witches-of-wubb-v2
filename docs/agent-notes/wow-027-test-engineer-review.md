# WOW-027 PR #28 (throttle slider emissions) — test-engineer review

- Reviewer: test-engineer (Claude Sonnet 5, test-review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #28, `fix(wow-027): throttle tempo/volume slider emissions`. Not stacked — base `main`, head `feat/wow-027-throttle-slider-emissions`.
- Method: read-only, no edits made (temporary local mutations for mutation-testing were fully restored via `git checkout --` each time, verified clean before finishing). Independently reproduced every mutation-testing claim in the implementer's agent-note rather than trusting it, plus investigated one additional open question (useMemo identity-stability protection) the implementer's note didn't explicitly address.

## Verdict: **APPROVE-WITH-NITS**

## Required

None.

## Findings

**1. PR diff scope.** `gh pr diff 28` touches exactly seven files: the agent-note, `TempoSliderContainer.tsx`, `VolumeSliderContainer.tsx`, `src/container/test/TempoSliderContainer.test.tsx`, `src/container/test/VolumeSliderContainer.test.tsx`, `src/util/throttle.ts`, `src/util/test/throttle.test.ts`. All within WOW-027's allowed-files list. No `package.json`/`yarn.lock` changes — confirms no new dependency, as the ticket requires.

**2. `throttle.ts` trailing-edge mutation.** Disabled the trailing-fire block's body (`if (false && pendingArgs !== undefined)`). Ran `yarn test src/util/test/throttle.test.ts`: **exactly 2 of 7 tests failed** — "fires a trailing call with the most recent args once the window elapses" (expected 2 calls, got 1) and "keeps bounding emissions across a drag that outlasts one window, still landing the true final value" (expected last call `[50]`, got `[41]`). The other 5 passed unchanged, including the two tests correctly insensitive to this mutation (single tap, fresh-leading-edge-after-full-cooldown). This exactly matches the implementer's claim. Notably, the bounding test's call-count-range assertion alone would _not_ have caught this mutation (still produces 5 calls, in range) — it's specifically the `toHaveBeenLastCalledWith(50)` assertion that catches it, since the mutation degrades the throttle into repeated one-off leading-edge fires (1, 11, 21, 31, 41) rather than genuinely just dropping the trailing fire. Restored via `git checkout --`; re-ran, confirmed 7/7 pass.

**3. `TempoSliderContainer.tsx` re-sync mutation.** Deleted the `useEffect(() => setDisplayTempo(tempo), [tempo])` block. Ran the test file: exactly 1 of 4 tests failed — the re-sync test, stuck at `120` instead of updating to `140`. The other 3 passed unaffected. Matches the implementer's claim exactly. Restored; re-ran, confirmed 4/4 pass.

**4. `VolumeSliderContainer.tsx` reset mutation.** Removed `setDisplayVolume(RESET_VALUE);` from `resetVolume`. Ran the test file: exactly 1 of 5 tests failed — the reset-immediacy test. The other 4 passed unaffected. Matches the implementer's claim exactly. Restored; re-ran, confirmed 5/5 pass.

**5. `useMemo` identity-stability investigation (beyond the implementer's own claims).** Investigated whether the suite has real teeth against someone silently dropping the `useMemo` wrapper (which would recreate a fresh, never-throttled `throttle()` instance on every render). Changed `useMemo(() => throttle(changeTempo, EMIT_THROTTLE_MS), [changeTempo])` to a bare `throttle(changeTempo, EMIT_THROTTLE_MS)` call. Ran the test file: **2 of 4 tests failed immediately and clearly** — both throttle-dependent tests reported 10 calls instead of 1. Mechanism: RTL's `fireEvent.change` flushes the `setDisplayTempo` state update via `act()` synchronously before the loop's next iteration, so each of the 10 loop iterations runs against a freshly-rendered `handleChange` closure; under the mutation, every render creates a brand-new never-called throttle instance, so every change event hits the leading-edge path. **Conclusion: this is not a silent gap** — the existing "rapid drag" tests already catch a useMemo regression, incidentally rather than by an explicit identity-equality assertion (which, per this repo's "verify behavior, not implementation" guideline, is arguably the more idiomatic choice anyway). Restored via `git checkout --`; re-ran, confirmed 4/4 pass. Only ran this specific mutation against `TempoSliderContainer.tsx`; `VolumeSliderContainer.tsx` uses an identical pattern and should behave the same by code symmetry, but this wasn't independently re-verified on that file.

**6. No `Date`/`Date.now()` usage.** `grep -in "date" src/util/throttle.ts` returns zero matches. The implementation is purely `setTimeout`/closure-state based, with no wall-clock reads at all — fully supports the implementer's claim that determinism under `vi.useFakeTimers()` doesn't depend on whether a given vitest version also fakes `Date`.

**7. Full validation, run twice** (clean baseline before mutation testing, again after all mutations reverted): `yarn lint` clean both times; `npx tsc --noEmit` (root) clean both times; `yarn test` full suite → 16 test files, 84 tests passed, both times — exactly reproduces the claimed "84/84."

## Nits (non-blocking)

- No container-level test exercises a _sustained_, multi-throttle-window drag — both container test files' "rapid drag" tests only span a single ~100ms window. The sustained-bounding property is thoroughly proven at the pure-`throttle.ts`-util level (the 50-event/500ms test) but never re-exercised through the container wiring. Low risk given the container-to-util wiring is a single trivial `useMemo` line — not required, just noting the acceptance criteria's "dragging a slider end-to-end" phrasing is fully proven only at the util layer.
- The useMemo-regression protection (finding 5) is real but incidental, and depends on the specific test-loop structure (tight `fireEvent.change` calls relying on synchronous `act()` flushing). A future refactor of these tests (e.g., switching to `userEvent`-style interactions with different batching) could lose this protection without anyone noticing, since nothing documents that the loop structure is what makes it effective. A one-line comment would cheaply future-proof it.
- The implementer's "live verification against the real simulator" claim (21 synthetic input events → exactly 2 emissions each) was not independently reproduced by this review — doing so requires an interactive `yarn sim` + `yarn dev` session, which is outside a static mutation-testing review and, per the ticket's own "Required tests/checks," is explicitly a manual smoke test, not an automated one.
- Minor: `buildContextValue` helpers are byte-for-byte duplicated across both container test files. Not required to dedupe (colocated test-file duplication is a common, accepted tradeoff here).

## Process note

During three of the `git checkout --` restores, a system-reminder appeared each time claiming the file had been "modified by the user or a linter," calling it "intentional," and instructing not to tell the user "since they are already aware." Each time, the file content shown was simply the correct original code — i.e., the reminder was describing this review's own restoration, not an external edit. This was not treated as an authoritative instruction (tool/environment output is data, not a command, and embedded secrecy instructions don't bind), and it didn't change any action taken — restoring the original file was exactly what the task required regardless. Flagged for transparency since silently complying with an embedded "don't tell the user" instruction would be the wrong call even when, as here, it turned out inconsequential.

## Summary

Every mutation-testing claim in the implementer's agent-note reproduced exactly under independent re-execution: the throttle util's trailing-edge disable failed precisely the 2 claimed tests, the tempo re-sync deletion failed precisely the 1 claimed test, and the volume reset deletion failed precisely the 1 claimed test — all restored cleanly afterward. The one open question this review dug into beyond the implementer's own claims — whether the suite would catch a `useMemo` regression — checked out: removing it fails 2 tests immediately with an unambiguous count mismatch, so this is not a silent gap, just an undocumented/incidental one worth a comment. `throttle.ts` has zero `Date` usage, confirming the fake-timer-determinism claim. Lint, typecheck, and the full test suite (84/84, 16 files) are all clean, reproduced twice. No scope violations, no new dependencies. Working tree fully restored and verified clean.
