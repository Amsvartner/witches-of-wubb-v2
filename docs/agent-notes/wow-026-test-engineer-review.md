# WOW-026 PR #27 (ingredient_removed pillar scoping) — test-engineer review

- Reviewer: test-engineer (Claude Sonnet 5, test-review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #27, `fix(wow-026): scope ingredient_removed to the event's own pillar`. Stacked PR: base `feat/wow-019-frontend-reconnect-resync`, head `feat/wow-026-ingredient-removed-pillar-scope`.
- Method: read-only, no edits made (temporary local reverts for mutation-testing were fully restored via `git checkout --`, verified clean before finishing). Independently reproduced the PR's central regression-test claim via its own revert-and-rerun, then went further with a targeted "half-revert" to probe for coverage gaps the PR's own narrative didn't consider.

## Verdict: **APPROVE-WITH-NITS**

### Required

None — the fix is correct, matches the ticket's prescribed change exactly, and all required checks are independently verified green.

### Findings

**1. Diff scope matches the ticket exactly.** `git diff origin/feat/wow-019-frontend-reconnect-resync...origin/feat/wow-026-ingredient-removed-pillar-scope` (single commit `4fffb29`) touches exactly: `src/context/hook/useAbletonContextProviderState.ts` (+2/-2), `src/context/hook/test/useAbletonContextProviderState.test.tsx` (+89), `docs/TICKETS_001_INITIAL.md` (+1, WOW-012 status note only), and a new `docs/agent-notes/wow-026-frontend-implementer-ingredient-removed-pillar-scope.md`. No scope creep beyond the ticket's allowed files plus the standard agent-note artifact.

**2. The production fix is correct and matches the ticket's prescription verbatim.** Both branch conditions in `useAbletonContextProviderState.ts:143` and `:146` changed from `playingClipsRef.current.some((item) => item?.clipName === data.clipName)` / `queuedClipsRef.current.some(...)` to `playingClipsRef.current[data.pillar]?.clipName === data.clipName` / `queuedClipsRef.current[data.pillar]?.clipName === data.clipName` — exactly the fix the ticket text specifies ("compare the specific slot ... and same for queued").

**3. Independently verified the regression test has real teeth (task's crux requirement).** Temporarily reverted the handler to the old `.some()` form on both branches, ran the test file, and confirmed: with both conditions reverted, 7/8 pass, 1 fails — specifically the "actual bug" test fails at `expect(result.current.queuedClips[1]).toBeFalsy()` with `queuedClips[1]` still populated. Went one step further and isolated the second assertion too: with only the `queuedClips[1]` line temporarily removed, `stoppingClips[1]` independently fails as well — confirming both differentiating assertions carry real weight. Restored via `git checkout --` and reran: 8/8 green again. Working tree confirmed clean before and after.

**4. The "pillar A untouched" assertion is structurally trivial — the agent-note's acknowledgment of this is accurate.** `ContextUtils.updateIndex` is a pure single-index copy-on-write; both old and new handler code always call it with `data.pillar` (the event's own pillar, B), never any other index. So `playingClips[0]` (pillar A) can never be touched by this handler regardless of which branch fires. Confirmed empirically: in the full-revert run, execution reached the "pillar A untouched" assertion without throwing, meaning it silently passed even against the buggy code. The agent-note's own text correctly identifies which assertions do the real work.

**5. Gap found — "neither branch should fire" case was untested at review time.** None of the original 3 tests covered: pillar A has a clip named X, pillar B (the event's own pillar) has nothing playing or queued at all, and `ingredient_removed` fires for B naming X. Under the fix this correctly no-ops. Under the old code, the playing-branch `.some()` would still match via A and wrongly fire, fabricating `stoppingClips[B] = data` — a "stopping" clip appearing out of nowhere on a pillar that had nothing. This is arguably the most visually alarming version of the bug described in the ticket's own summary ("can incorrectly clear or **set stopping-state** on the other pillar's UI slot"), and wasn't exercised by any test at review time. Did not violate the ticket's literal acceptance criteria, so not treated as blocking — flagged as a nit.

**6. Gap found — the queued branch's own scoping fix had zero independent regression coverage at review time (empirically confirmed via a targeted half-revert, not just reasoned).** Hand-constructed a "half-reverted" handler — playing-branch condition fixed (indexed), queued-branch condition still buggy (`.some()`) — and ran the WOW-026 describe block against it: all 3 original tests still passed. This proved that a hypothetical future regression reintroducing the any-pillar scan in only the queued branch would sail through the suite undetected, because in every original test, B's own queued/playing state happened to coincide with what `.some()` would also find. Reverted this change immediately after observing the result, confirmed clean.

**7. Test fixture type-correctness confirmed.** `buildClip(pillar, clipName)` returns all 5 required `BrowserClipInfo` fields (`rfid`, `clipName`, `type`, `assetName`, `pillar`); cross-checked against `backend/type/BrowserClipInfo.ts`, `ClipInfo.ts`, `ClipMetadataType.ts`. `npx tsc --noEmit` at repo root: clean.

**8. Normal-path tests (2 and 3) genuinely cover "unchanged" for both playing and queued** — confirmed via the same full-revert run (only the "actual bug" test failed; tests 2 and 3 both still passed against the old buggy code).

**9. PR body and agent-note were accurate as of initial review**, except for one shared inaccuracy in the WOW-012 causal claim, separately caught and detailed by the general reviewer's independent git-archaeology finding (not duplicated here).

**10. Required checks, independently run on the checked-out branch (initial round):** `yarn lint` clean; `npx tsc --noEmit` (root) clean; `yarn test` full suite → 78/78 (matching the PR's claim at that time); `useAbletonContextProviderState.test.tsx` alone → 8/8.

### Nits (non-blocking, both folded into the fix round)

- Add a test for the "pillar B has nothing at all" scenario (Finding 5) — the most direct demonstration of the ticket's own stated failure mode. **Resolved in the fix round**: added as test 4, independently mutation-tested by the implementer.
- Add a mirrored adversarial test for the queued branch specifically (Finding 6) — e.g. pillar A has clip X queued, pillar B has a _different_ clip queued, event fires for B naming X — to close the coverage gap where a queued-branch-only regression is currently invisible to the suite. **Resolved in the fix round**: added as test 5, independently mutation-tested by the implementer (confirmed to fail against a queued-branch-only revert, exactly as this review predicted).
- `buildClip`'s `rfid` field format is unused by the code path under test; harmless, fixture boilerplate only.

### Summary

The WOW-026 fix is a correct, minimal, exactly-as-prescribed two-line change, verified clean on `yarn lint`, `npx tsc --noEmit`, and `yarn test` run independently. The PR's central regression-test claim was independently reproduced via a real revert-and-rerun, going further by isolating both differentiating assertions to confirm each independently catches the bug. Found two real, evidence-backed test-coverage gaps beyond the letter of the acceptance criteria — the "pillar B has nothing" case, and zero independent regression coverage for the queued branch's own scoping fix (the latter empirically confirmed by a targeted half-revert) — neither blocked approval given the underlying fix was objectively correct, and both were folded into the fix round as tests 4 and 5.
