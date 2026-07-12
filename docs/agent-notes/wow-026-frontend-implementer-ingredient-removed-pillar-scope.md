# WOW-026 — ingredient_removed handler matches clip names across all pillars instead of the event's pillar

- Role: frontend-implementer (implementer)
- Date: 2026-07-12
- Branch: `feat/wow-026-ingredient-removed-pillar-scope`, stacked on `feat/wow-019-frontend-reconnect-resync`

## Ticket

WOW-026 — see `docs/TICKETS_002_BUGS.md`. Also explicitly supersedes and closes WOW-012 in `docs/TICKETS_001_INITIAL.md`.

## Bug

`useAbletonContextProviderState.ts`'s `ingredient_removed` handler decided which branch to take ("was this clip playing, queued, or neither?") by scanning **every** pillar for a clip-name match (`playingClipsRef.current.some((item) => item?.clipName === data.clipName)`), then applied the resulting state mutation to `data.pillar` regardless of which pillar actually produced the match. If the same clip name is active on two different pillars at once (possible today — see WOW-025's real duplicate-clip-name finding in the CSV), an `ingredient_removed` event for pillar B could have its branch decision hijacked by pillar A's unrelated state:

- If pillar A has the clip **playing** while pillar B actually has it **queued**, removing the tag from pillar B wrongly took the "was playing" branch (because the scan found a match on pillar A) instead of the "was queued" branch. Result: pillar B's real queued clip was never cleared (stuck forever, since the queued branch was never reached), and pillar B was incorrectly marked as "stopping" a clip it had never played.

## Fix

Changed both branch conditions from an any-pillar `.some(...)` scan to a same-pillar direct index lookup, exactly as the ticket prescribes:

```ts
socket.on('ingredient_removed', (data: BrowserClipInfo) => {
  if (playingClipsRef.current[data.pillar]?.clipName === data.clipName) {
    setPlayingClips((current) => updateIndex(data.pillar, null, current));
    setStoppingClips((current) => updateIndex(data.pillar, data, current));
  } else if (queuedClipsRef.current[data.pillar]?.clipName === data.clipName) {
    setQueuedClips((current) => updateIndex(data.pillar, null, current));
  }
});
```

Now the branch decision only ever looks at `data.pillar`'s own slot — it can no longer be influenced by what's happening on any other pillar. One line changed per branch condition; the mutation logic inside each branch is untouched.

## Tests

Added a new `describe` block to the existing `src/context/hook/test/useAbletonContextProviderState.test.tsx` (already established by WOW-019) — 5 tests (3 initial + 2 added in the fix round, see below):

1. **The actual bug, reproduced**: pillar A (0) playing "Shared Name" while pillar B (1) has "Shared Name" queued; fires `ingredient_removed` for pillar B. Asserts pillar A's playing state is untouched, and — the assertion that actually differentiates old vs. new code — pillar B's queued clip is correctly cleared and pillar B is _not_ incorrectly marked as stopping.
2. Normal single-pillar playing removal, unchanged.
3. Normal single-pillar queued removal, unchanged (not explicitly required by the acceptance criteria, but the same code path, added for symmetry with the "and same for queued" note in the ticket's own description).
4. **(Fix round)** Pillar A playing, pillar B has nothing at all — asserts the event does not fabricate a stopping-state on B. This is the most visually alarming version of the bug per the ticket's own summary ("set stopping-state on the other pillar's UI slot") and was flagged as an untested gap by test-engineer review.
5. **(Fix round)** Pillar A queued with name X, pillar B queued with a _different_ name — removal event for B names X. Asserts B's own (different) queued clip survives untouched. Closes a real, independently-confirmed gap: test-engineer review proved via a targeted "half-revert" (fixing only the playing branch, leaving the queued branch as `.some()`) that tests 1–3 alone would not catch a queued-branch-only regression, because in every original test B's own queued state happened to coincide with what `.some()` would also find.

**Verified the regression tests actually catch the bug, not just pass vacuously.** Initial round: temporarily reverted the fix back to the `.some(...)` scan on both branches, re-ran, confirmed test 1 failed exactly as expected (`queuedClips[1]` was still populated instead of cleared) while the other two tests still passed, then restored the fix. Fix round: independently reproduced test-engineer's half-revert finding — reverted _only_ the queued branch back to `.some(...)`, re-ran, and confirmed test 5 failed exactly as predicted (pillar B's real queued clip `My Own Clip` was wiped to `null` instead of surviving), while all other tests still passed. Restored the real fix afterward and confirmed 10/10 green.

Note: mechanically, `updateIndex(data.pillar, ...)` never writes to any index other than `data.pillar` in either the old or new code, so pillar A's own array entry was never at risk of being _directly_ overwritten by an event for pillar B — the bug is entirely in which branch fires for pillar B, not in cross-pillar array corruption. Test 1's "pillar A untouched" assertion is kept as a sanity guard (matches the ticket's acceptance-criteria wording verbatim, and test-engineer review independently confirmed via the same full-revert run that this specific assertion passes even against the buggy code), but the assertions on pillar B's own resulting state (tests 1, 4, 5) are what actually catch the regression.

## Fix round (post general-reviewer + test-engineer review)

- **General reviewer REQUEST-CHANGES, both items addressed**: (1) two unresolved Copilot threads — `docs/TICKETS_001_INITIAL.md`'s WOW-012 status note reworded (see below) and `BrowserClipInfo` changed to a type-only import in the test file (`import type { BrowserClipInfo } from ...`), matching existing repo precedent; both threads resolved. (2) The WOW-012 status note contained a historically inaccurate claim — reworded after independently re-verifying the reviewer's git-archaeology finding myself (`git show 45f9554`, `git show 0aaa123`, `git show da83af6`): the any-pillar `.some(...)`/`findIndex(...) > -1` scan pattern was **not** introduced by the `0aaa123` context restructure. It was already present on the playing branch (as `findIndex(...) > -1`) since commit `45f9554` (2023-05-19 16:39:53 -0700), which replaced an even earlier _unconditional_ handler from `da83af6` (44 minutes prior, same day) with the first version of the playing/queued branching logic — and that commit is also where the queued branch's truthy-`findIndex` bug (WOW-012's actual, narrower bug) originated. `0aaa123` (2026-07-10) only mechanically converted both branches' `findIndex`-based checks to `.some(...)`, fixing WOW-012's bug as a side effect while carrying the pre-existing any-pillar-scan pattern forward unchanged in both branches. The status note now states this accurately instead of blaming `0aaa123` for introducing the scan.
- **Test-engineer APPROVE-WITH-NITS, both coverage-gap nits folded in**: added tests 4 and 5 above, both independently mutation-tested to confirm they have real teeth (see Tests section).

## Docs

Updated `docs/TICKETS_001_INITIAL.md`'s WOW-012 entry with a status note closing it as done/superseded by WOW-026, per this ticket's own explicit instruction and its (permitted) allowed-files entry for that doc — reworded during the fix round for historical accuracy (see above).

## Out of scope / deliberately not done

- Backend `ingredient_removed` payload changes — explicitly out of scope per the ticket.
- Stopping-clips visual treatment — explicitly out of scope per the ticket.
- `ClipButton.tsx` or any other rendering/UI change — this ticket is state-logic only.

## Validation

- [x] `yarn lint` clean
- [x] `npx tsc --noEmit` (root) clean
- [x] `yarn test` — 80/80 (this branch's ancestry is WOW-019 only, not the backend WOW-020/021 stack, so the total differs from other branches in this run — expected)
- [x] `yarn build` clean

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `Arduino/`, `.env` — N/A
- [x] No new/renamed socket.io event names
- [x] No new dependencies
- [x] UI state only, no emissions change — per ticket's own safety notes, no specialist sign-off required
- [x] Docs updated where behavior changed — WOW-012 status note in `docs/TICKETS_001_INITIAL.md`
