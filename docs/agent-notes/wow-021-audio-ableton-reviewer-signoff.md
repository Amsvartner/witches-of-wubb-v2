# WOW-021 PR #26 (clip cache invalidation) — audio-ableton-reviewer sign-off

- Reviewer: audio-ableton-reviewer (Claude Sonnet 5, specialist sign-off phase of the WOW pipeline — **required** per this ticket's own safety notes: "clip-triggering path — audio-ableton-reviewer sign-off. No musical logic change.")
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #26, `fix(wow-021): clear memoized clip-index caches on each getTracksAndClips fetch`. Stacked PR: base `feat/wow-020-bpm-warp-marker-guard`, head `feat/wow-021-clip-cache-invalidation`.
- Method: read-only, no edits made, no live hardware, no live Ableton, no OSC/Art-Net traffic. Traced the full caller graph rather than trusting the PR narrative; reran the full validation suite independently.

## Verdict: **APPROVE**

## Scope confirmation

`git diff origin/feat/wow-020-bpm-warp-marker-guard...origin/feat/wow-021-clip-cache-invalidation` touches exactly two files:

- `backend/adapter/AbletonAdapter.ts` — 7 lines added (5 comment + 2 code), nothing removed, nothing else changed.
- `docs/agent-notes/wow-021-creative-tech-integrator-clip-cache-invalidation.md` — new implementer note, no code.

The added code, at the top of `getTracksAndClips` (`backend/adapter/AbletonAdapter.ts:410-416`):

```ts
MemoizedClipIndex.cache.clear?.();
FindAllClipsInLoop.cache.clear?.();
```

placed before `allAbletonClips = []` (:418) and before `tracks = await ableton.song.get('tracks')` (:419). No other line in the function, or in the file, changed. This matches the ticket's own description almost verbatim (`docs/TICKETS_002_BUGS.md:126`).

## Point-by-point

**1. Diff narrowness** — Confirmed via `git diff --stat` (7 insertions, 2 files, one of which is a doc). No touch to `TRIGGER_ORDER` (`AbletonAdapter.ts:55`), `KEY_LEADER_ORDER` (:56), `KeyTranspositionService.ts`, `ClipTypes.ts`, `PhraseLeaderService.ts`, the CSV, or any event name.

**2. What's memoized, keyed on what, real caller trace** — `MemoizedClipIndex` (:209-215) memoizes `allAbletonClips[pillar].findIndex(clip => clip?.raw.name.trim() === clipName.trim())`, keyed on `` `${clipName}-${pillar}` ``. `FindAllClipsInLoop` (:227-246) memoizes a 20-slot-window slice of `allAbletonClips[pillar]` (an array of actual `Clip` object references), same key shape, and internally calls `MemoizedClipIndex`. Real caller trace for the RFID tag-in path: `IncomingEvents.ts:72` `handleNewTag` → `AbletonAdapter.queueClip(clipMetadata, pillar)` → `AbletonAdapter.ts:255` `const clips = FindAllClipsInLoop(clipName, pillar)` → `clips[0].fire()` (:274) or captured into `queuedClips[pillar]` (:280-284) for later `.fire()` in `triggerQueuedClips` (:305). Both functions are module-private (not on the exported `AbletonAdapter` object, :672-714) — their only callers are six call sites inside this same file.

**3. Not a musical-logic change** — Confirmed. The lookup predicate (`clip.raw.name.trim() === clipName.trim()`), the loop-window logic (20-slot `findLastIndex`), the key-matching/transposition math in `transposeClipToNewKey` (:642-670), and `TRIGGER_ORDER`/`KEY_LEADER_ORDER` are byte-for-byte unchanged. The change only alters cache _lifetime_. Noted for the record: both caches must be cleared together for correctness, and the diff does clear both — if only `FindAllClipsInLoop`'s cache were cleared while `MemoizedClipIndex`'s stale index survived, a subsequent cache-miss would apply a stale _index number_ against the _new_ `allAbletonClips[pillar]`, silently returning clips from the wrong slot if track/clip-slot ordering ever shifted between fetches — a wrong-clip bug, worse than the ticket's handle-breaks-or-errors framing. The PR clears both, correctly avoiding this.

**4. Does the fix close the bug; any remaining stale-reference path** — Both memoized functions are synchronous closures over the module-level `let allAbletonClips` (:41) — they always read whatever `allAbletonClips` currently references, never a captured snapshot. After a clear, the first post-clear call on either function is guaranteed to miss cache and recompute against the (by-then-fresh) array. This closes the bug as claimed.

One real residual gap, explicitly out of this ticket's scope: `queuedClips[pillar].clip` (captured at :281) and `playingClips[pillar].clip` (captured at :490) hold direct `Clip` object references independent of the two memoized caches. If a clip was queued/playing _before_ a re-fetch, its captured `.clip` reference is not touched by this fix and is later dereferenced directly (e.g. `triggerQueuedClips` calls `item.clip.fire()` straight from `queuedClips`, never re-resolving through `FindAllClipsInLoop`). Pre-existing behavior, untouched by and unrelated to this diff (allowed files are `AbletonAdapter.ts` only; "Out of scope" explicitly excludes restructuring module-level state) — does not block sign-off, but worth a follow-up ticket if/when a re-fetch-while-playing scenario becomes real.

**5. Live-installation risk (missed/wrong trigger)** — Traced the actual call graph: `getTracksAndClips` has exactly one call site in the whole repo outside its own definition — `AbletonAdapter.ts:144`, inside `startAbleton()`, itself called exactly once, at `backend/index.ts:23`, fully `await`-ed _before_ the socket.io/OSC servers are even constructed. No other code path anywhere calls `AbletonAdapter.getTracksAndClips()` a second time within a running process — the "reconnect, remote-script restart, manual re-scan" scenarios named in the ticket aren't wired to anything yet; recovery today is whole-process exit via `uncaughtException`/`unhandledRejection` handlers, which reinitializes all module state (including these caches) from empty. **Under the current codebase this diff introduces zero live-installation risk** — it's forward-defensive code for a re-fetch path that doesn't exist yet. For completeness: if a future ticket did add an in-process re-fetch trigger, the two `.clear()` calls run synchronously before the first `await`, so nothing can interleave with the clear itself, but the subsequent repopulation loop is not atomic and a lookup landing mid-repopulation could throw — currently unreachable, pre-existing/orthogonal to this fix, and arguably still better than the pre-fix alternative of a silent stale-handle hit. Flagged as a residual note for whichever future ticket wires up a live re-fetch, not a blocker here.

**6. Single-fetch behavior unchanged** — `MemoizedClipIndex.cache`/`FindAllClipsInLoop.cache` are lodash's default `Map`-backed caches, freshly constructed at module load. `Map.prototype.clear()` on an already-empty map is a no-op. So the very first `getTracksAndClips()` call (startup, caches empty) behaves identically before and after this change. Reran validation independently: `yarn lint` clean, `npx tsc --noEmit -p backend/tsconfig.json` clean, `yarn test` → 84/84 passed (confirming the PR's claim that no test seam exists for `getTracksAndClips`/the memoized functions is accurate, not an excuse).

## Findings

| Severity | Location                                                                             | Musical assumption at risk                                                                                                                                      | Verdict                                  |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Info     | `backend/adapter/AbletonAdapter.ts:415-416`                                          | Cache lifetime only; clip-name matching, trigger/key-leader order, transposition, warp/BPM logic all untouched                                                  | Approve                                  |
| Info     | `backend/adapter/AbletonAdapter.ts:281`, `:305`, `:490` (pre-existing, out of scope) | `queuedClips`/`playingClips` capture `Clip` refs independent of the memoized caches; not reconciled by this fix if a future re-fetch happens mid-queue/mid-play | Note for follow-up ticket, not a blocker |
| Info     | `backend/index.ts:22-28`, `AbletonAdapter.ts:144` (context, not a defect)            | No code path currently calls `getTracksAndClips` more than once per process; this fix is currently-dormant/forward-defensive                                    | No action needed                         |

## Summary

No blocking issues found. The change does exactly and only what the ticket and PR describe: it clears two module-private memoization caches at the top of `getTracksAndClips`, before the array they index into is reassigned, with no effect on clip-name matching, `TRIGGER_ORDER`/`KEY_LEADER_ORDER`, key-lock/transposition, warp/BPM handling, timeout behavior, or category enum values, and no effect on the first-ever fetch. Two informational, non-blocking notes carried forward for future tickets: (1) `queuedClips`/`playingClips` hold `Clip` references independent of these caches and wouldn't be reconciled by a future in-process re-fetch; (2) `getTracksAndClips` currently has exactly one call site per process, so this fix is presently forward-defensive rather than closing a reachable live bug — still correct and worth having for whenever a re-fetch path is wired up.
