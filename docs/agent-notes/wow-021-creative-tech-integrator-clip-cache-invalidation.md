# WOW-021 — Memoized clip lookups never invalidate after clips are re-fetched

- Role: creative-tech-integrator (implementer)
- Date: 2026-07-12
- Branch: `feat/wow-021-clip-cache-invalidation`, stacked on `feat/wow-020-bpm-warp-marker-guard` (which is itself stacked on `feat/wow-018-idle-timeout-cleanup` → `feat/wow-032-...` → `feat/wow-014-...`)

## Ticket

WOW-021 — see `docs/TICKETS_002_BUGS.md`. `MemoizedClipIndex` and `FindAllClipsInLoop` (both `lodash.memoize`-wrapped, unbounded, no TTL) cache Ableton `Clip` object references keyed by `clipName-pillar`. If `getTracksAndClips` ever re-fetches the Live set (reconnect, remote-script restart, manual re-scan), the memo caches keep resolving lookups to `Clip` handles from the _previous_ fetch's `allAbletonClips` array — stale references that silently break or error when queueing (see WOW-014).

## Fix

Added two lines at the very top of `getTracksAndClips`, before `allAbletonClips` is reassigned:

```ts
MemoizedClipIndex.cache.clear?.();
FindAllClipsInLoop.cache.clear?.();
```

`.cache.clear?.()` (optional chaining) rather than a bare `.cache.clear()`: `lodash`'s `MemoizedFunction.cache` type is `MapCache`, and `MapCache.clear` is typed as `(() => void) | undefined` — optional in the type even though lodash's actual default `Map`-based cache implementation always provides it. Optional-chaining is the type-correct call under `backend/tsconfig.json`'s strict settings without an unsafe non-null assertion.

Every fetch now starts from empty caches, so a lookup performed any time after a re-fetch can only resolve against the fresh `allAbletonClips`/`tracks` populated by that same fetch — there is no code path left where a memo entry outlives the fetch that produced it.

## Why not remove memoization entirely

The ticket's description floats a secondary option: "Consider whether memoization is worth keeping at all given the lookup cost is a `findIndex` over ~dozens of clips." Deliberately not pursued, for three reasons:

1. The ticket's own "Fix:" sentence names cache-clearing as _the_ fix; removing memoization is framed as something to "consider," not required.
2. It's materially bigger in scope and risk than this ticket's stated allowed-files/acceptance-criteria suggest — `MemoizedClipIndex` and `FindAllClipsInLoop` are called from the hot clip-triggering path (RFID tag-in), and swapping memoized lookups for plain linear scans changes the performance characteristics of that path, not just its caching. That's a real behavior question ("must be verified identical" per the ticket) that deserves its own ticket and its own dedicated benchmark/verification pass, not a rider on a one-line cache-invalidation fix.
3. Out of scope explicitly rules out "restructuring the adapter's module-level state (larger refactor, separate proposal)" — removing memoization touches the same module-level `const MemoizedClipIndex = memoize(...)` declarations and would qualify.

Cache-clearing fully resolves the staleness bug on its own. If the memoization's performance benefit is ever judged not worth the invalidation-hygiene burden, that's a clean follow-up ticket with its own before/after verification.

## Verification

`getTracksAndClips` has no dedicated unit test today (this ticket's allowed files are `backend/adapter/AbletonAdapter.ts` only — no test directory), and the ticket itself says this is "verifiable by unit test if the adapter gains a seam, otherwise by review." No such seam exists yet (the function isn't exported, and `ableton.song.get('tracks')` isn't mockable without a larger harness change, which is out of scope). Verification here is by direct code review of placement:

- The two `.cache.clear?.()` calls run unconditionally at the very start of `getTracksAndClips`, before `allAbletonClips = []` and before `tracks = await ableton.song.get('tracks')` — so they always run exactly once per fetch, with no early-return path in the function that could skip them.
- Single-fetch (first-ever call) behavior is unchanged: clearing an already-empty cache is a no-op, so the very first `getTracksAndClips()` call behaves identically to before this change.
- No change to what gets cached, how entries are keyed, or when entries are written during a fetch — only when the caches are wiped.

## Validation

- [x] `yarn lint` clean
- [x] `npx tsc --noEmit` (root) clean
- [x] `npx tsc --noEmit -p backend/tsconfig.json` clean
- [x] `yarn test` — 84/84
- [x] `yarn build` clean

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `Arduino/`, `.env` — N/A
- [x] No new/renamed socket.io event names
- [x] No new dependencies
- [x] Clip-triggering path — **audio-ableton-reviewer sign-off required per this ticket's safety notes** — requested in PR
- [x] No musical logic change — confirmed: this only changes cache lifetime, not what's cached or how clips are matched/triggered
