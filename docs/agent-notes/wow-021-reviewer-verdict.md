# WOW-021 PR #26 (clip cache invalidation) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, general review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #26, `fix(wow-021): clear memoized clip-index caches on each getTracksAndClips fetch`. Stacked PR: base `feat/wow-020-bpm-warp-marker-guard`, head `feat/wow-021-clip-cache-invalidation`.
- Method: read-only, no edits made. Cross-checked `gh pr diff 26` against local `git diff origin/feat/wow-020-bpm-warp-marker-guard...HEAD`. Ran all required checks independently rather than trusting the PR's claimed numbers. Built an isolated compile check (scratchpad only, zero repo files touched) to empirically verify the optional-chaining requirement rather than trusting the type-reading alone.

## Verdict: **APPROVE-WITH-NITS**

Originally conditional on the audio-ableton-reviewer's required sign-off (running in parallel) — that sign-off has since landed as **APPROVE** (`docs/agent-notes/wow-021-audio-ableton-reviewer-signoff.md`), so both required reviews for this ticket are now clean.

## Required

None.

## Findings

**1. PR diff scope — confirmed minimal and correct.** `gh pr diff 26` and local `git diff origin/feat/wow-020-bpm-warp-marker-guard...HEAD` (cross-checked both ways) show exactly: `backend/adapter/AbletonAdapter.ts` (+7 lines, 0 removed) and a new `docs/agent-notes/wow-021-creative-tech-integrator-clip-cache-invalidation.md`. Single commit at review time. No third file. Matches the ticket's allowed-files list (`backend/adapter/AbletonAdapter.ts` only) plus the standard agent-note artifact.

**2. Full-file read of `backend/adapter/AbletonAdapter.ts` on the branch — the two new lines are the only change to the function.** `MemoizedClipIndex` (lines 209–215) and `FindAllClipsInLoop` (lines 227–246) definitions are byte-for-byte unchanged. `getTracksAndClips` (lines 408–537) is unchanged except for the two new calls plus their comment.

**3. Placement — verified precisely, exactly as the ticket demands.** Both `.cache.clear?.()` calls are unconditional, synchronous, and the first statements in the function body (after the log line) — strictly before `allAbletonClips` is reassigned and strictly before the function's first `await`. Read the entire function body: straight-line code plus one `for` loop with a single `return` at the very end — no early-return path anywhere that could skip the clear calls.

**4. Optional-chaining type-correctness — verified empirically, not just by reading docs.** The actual import is `from 'lodash.memoize'`. Checked the type package that actually governs it: `backend/node_modules/@types/lodash.memoize/index.d.ts` re-exports lodash's own memoize typing, `MemoizedFunction.cache: MapCache`, `MapCache.clear?: (() => void) | undefined` (`backend/node_modules/@types/lodash/common/common.d.ts:167`). `backend/tsconfig.json` extends `@tsconfig/recommended` (`strict: true`). Built an isolated compile check reproducing the exact import and tsconfig strictness: a bare `MemoizedClipIndex.cache.clear()` produces `error TS2722: Cannot invoke an object which is possibly 'undefined'`; `.cache.clear?.()` (what the PR ships) compiles clean. Genuinely required for type-correctness under this repo's actual installed types and tsconfig, not defensive decoration.

**5. Scope discipline — clean.** No drift into other files, no module-level restructuring, no memoization removal (ticket treats removal as optional/out-of-scope, and the PR correctly leaves it alone). Pre-existing PascalCase naming on `MemoizedClipIndex`/`FindAllClipsInLoop` (violates the camelCase-for-functions convention in `docs/CODING_GUIDELINES.md`) is untouched legacy code outside this diff — correctly not migrated here per the guidelines' own "do not partially migrate files in unrelated PRs" rule.

**6. Agent-note claims cross-checked against the diff — accurate.** Placement, no-early-return, and "clearing an empty cache is a no-op so first-fetch behavior is unchanged" all verified true by direct reading. See Nit 2 for one cosmetic wording quibble.

**7. PR body cross-checked against diff and agent-note — consistent throughout.**

**8. Required checks — ran all independently on the checked-out branch, all clean, numbers match exactly:** `yarn lint` clean; `npx tsc --noEmit` (root) clean; `npx tsc --noEmit -p backend/tsconfig.json` clean; `yarn test` — 84 passed (84), 14 test files; `yarn build` clean (only pre-existing, unrelated `caniuse-lite`/font-resolution warnings).

**9. Concurrency edge case — investigated with actual call-site tracing, not speculation. Real but non-blocking finding (see Nit 1).** Traced every caller: `getTracksAndClips` has exactly one call site in the whole repo (`startAbleton()` at `AbletonAdapter.ts:144`), itself called exactly once at process startup (`backend/index.ts:23`), fully awaited _before_ the socket.io/OSC servers are wired up — so no concurrent lookup can race the one fetch that currently ever happens. Reasoned further about the scenario the ticket itself motivates (a future reconnect/re-scan calling `getTracksAndClips` a second time while servers are live): `allAbletonClips = []` already ran synchronously-before-the-first-`await` in the pre-existing, unpatched code too, so this PR doesn't introduce that empty-array window. What this PR's cache-clear changes, in that hypothetical future scenario, is that a concurrent lookup for a previously-cached key flips from "silently returns a stale `Clip` reference" (the original bug) to "cache miss against `allAbletonClips[pillar] === []`, throws `TypeError`." Checked whether that throw is caught at every call site: `queueClip`, `stopOrRemoveClipFromQueue`, the `playing_slot_index` listener, and `handleTimeout` all degrade gracefully (try/catch or `.catch()`). Two call sites are **not** guarded: `setKeyLockState` and `setMasterKey`, invoked directly from unguarded socket handlers (`IncomingEvents.ts:180-189`, no try/catch) — an uncaught exception there would reach `process.on('uncaughtException')` and crash the process, the exact failure class WOW-014 exists to close.

## Nits (non-blocking)

1. **Latent crash-hardening gap adjacent to this fix, not caused by it** (finding 9 above): if a future reconnect/re-fetch path is ever added to `getTracksAndClips`'s only caller chain, a concurrent `set_keylock_state`/`set_master-key` socket call landing during that fetch's `await` window could throw an uncaught `TypeError` and crash the process, because those two handlers have no try/catch unlike every other caller of `FindAllClipsInLoop`/`MemoizedClipIndex`. Worth a mention when WOW-014 (or whatever ticket eventually adds a reconnect path) is scoped — not actionable here since it requires touching `IncomingEvents.ts`, outside this ticket's allowed files.
2. **Cosmetic:** the agent-note's justification for not removing memoization ("would touch the same module-level state the ticket's Out of scope excludes") is a slightly generous reading — swapping `memoize(fn)` for a direct call is arguably more mechanical than "restructuring module-level state." Doesn't affect the correctness of the decision (removal is optional per the ticket either way).

## Summary

The fix is exactly what the ticket prescribes, placed exactly where the ticket specifies, with no early-return path able to skip it and no-op behavior on the first (and currently only) fetch. The optional-chaining requirement was verified empirically against this repo's actual installed types and tsconfig (bare `.clear()` fails with TS2722; `.clear?.()` compiles clean). Scope is clean: exactly the one allowed file plus the standard agent-note. All required checks reproduced clean independently, matching the PR's claims exactly. Traced every call site of the two memoized functions and confirmed the one theoretical concurrency risk (stale-cache-turned-crash under a future re-fetch scenario, via two unguarded socket handlers) is pre-existing, not reachable today, and not introduced or worsened by this diff. No scope creep, no hardcoding, no docs-drift.
