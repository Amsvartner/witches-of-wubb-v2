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

Added a new `describe` block to the existing `src/context/hook/test/useAbletonContextProviderState.test.tsx` (already established by WOW-019) — 3 tests:

1. **The actual bug, reproduced**: pillar A (0) playing "Shared Name" while pillar B (1) has "Shared Name" queued; fires `ingredient_removed` for pillar B. Asserts pillar A's playing state is untouched, and — the assertion that actually differentiates old vs. new code — pillar B's queued clip is correctly cleared and pillar B is _not_ incorrectly marked as stopping.
2. Normal single-pillar playing removal, unchanged.
3. Normal single-pillar queued removal, unchanged (not explicitly required by the acceptance criteria, but the same code path, added for symmetry with the "and same for queued" note in the ticket's own description).

**Verified the regression test actually catches the bug**, not just passes vacuously: temporarily reverted the fix back to the `.some(...)` scan (backed up the file first), re-ran the suite, and confirmed test 1 failed exactly as expected (`queuedClips[1]` was still populated instead of cleared) while the other two tests still passed. Restored the real fix from the backup afterward and re-ran to confirm 8/8 green again.

Note: mechanically, `updateIndex(data.pillar, ...)` never writes to any index other than `data.pillar` in either the old or new code, so pillar A's own array entry was never at risk of being _directly_ overwritten by an event for pillar B — the bug is entirely in which branch fires for pillar B, not in cross-pillar array corruption. Test 1's "pillar A untouched" assertion is kept as a sanity guard (matches the ticket's acceptance-criteria wording verbatim), but the assertions on pillar B's own resulting state are what actually catch the regression.

## Out of scope / deliberately not done

- Backend `ingredient_removed` payload changes — explicitly out of scope per the ticket.
- Stopping-clips visual treatment — explicitly out of scope per the ticket.
- `ClipButton.tsx` or any other rendering/UI change — this ticket is state-logic only.

## Docs

Updated `docs/TICKETS_001_INITIAL.md`'s WOW-012 entry with a status note closing it as done/superseded by this ticket, per this ticket's own explicit instruction and its (permitted) allowed-files entry for that doc.

## Validation

- [x] `yarn lint` clean
- [x] `npx tsc --noEmit` (root) clean
- [x] `yarn test` — 78/78 (this branch's ancestry is WOW-019 only, not the backend WOW-020/021 stack, so the total differs from other branches in this run — expected)
- [x] `yarn build` clean

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `Arduino/`, `.env` — N/A
- [x] No new/renamed socket.io event names
- [x] No new dependencies
- [x] UI state only, no emissions change — per ticket's own safety notes, no specialist sign-off required
- [x] Docs updated where behavior changed — WOW-012 status note in `docs/TICKETS_001_INITIAL.md`
