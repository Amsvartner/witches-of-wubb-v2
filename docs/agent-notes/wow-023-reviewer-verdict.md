# WOW-023 PR #33 (hygiene sweep) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, general review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote)
- Review target: PR #33, head commit `4a24306` (the pre-fix-round-2 commit), diffed against its immediate base `feat/wow-031-clip-name-normalization`.
- Method: read-only, isolated `git worktree`. Base ref and merge-base verified live rather than trusted from the task prompt.

## Verdict: **CHANGES-REQUESTED** — explicitly framed by the reviewer as "a light gate, not a rejection"

## Environment notes (both diagnosed and worked around, not silently trusted)

- `yarn test` from this worktree returned exactly 16 files / 95 tests — clean, uncontaminated, matching this PR's own claims.
- `yarn lint` initially failed hard on a duplicate `eslint-plugin-react` resolution error, caused by `.eslintrc` not setting `root: true` and ESLint's config cascade walking upward into the main checkout. Worked around with `--resolve-plugins-relative-to .`; result was clean.
- The named `sim-full-spell`/`frontend` preview launch configs failed a Node engine-version check, because they evaluate against the _main checkout's current branch_ (`feat/wow-022-node-22-lts`, mid-flight from unrelated background work at the time, which has an `engines` constraint this worktree's actual PR content doesn't). Worked around by starting `yarn sim full-spell` / `yarn dev` manually from inside the isolated worktree instead.

## Verified / confirmed correct (independently, not just trusting the agent-note)

- Diff scope, single-commit stack confirmed via `git merge-base`.
- **Live sim + UI smoke test independently reproduced**, not just trusted: `document.querySelectorAll('[id="bpm"]')` returned the same `col-start-2`/`col-start-1` alternation across all four pillars as the old dynamic template literal would have; `ingredients_container` present, `ingredients_contianer` (typo) absent; clip names rendered in correct "Artist - Song Title" format; zero console/server errors.
- **Every one of the ten items independently traced against the actual diff hunks**, not the agent-note's narrative — including item 6's specific ask (traced the full pre-change function, confirmed `info?.clipName?.trimStart()`'s value has no path where it survives to be read) and item 8 (hand-verified both ternary branches produce character-identical output to the old template literal, plus reproduced it live).
- **Item 4's dead-code claim independently re-verified**: ran its own repo-wide grep for `KEY_LEADER_ORDER`/`ATTRACTOR_STATE_CLIP_NAME`, and confirmed via direct read of `PhraseLeaderService.ts` that `findNextPhraseLeader` sorts only by `AbletonAdapter.TRIGGER_ORDER` — genuinely dead code.
- Both scope judgment calls (`sim/server.ts`, `README.md`) reviewed on their actual reasoning, not rejected by rote "allowed-files list is sacred" — agreed both are reasonable, low-risk calls, appropriately flagged.
- No credentials, hardcoded values, CSV/Arduino/mapping touches, new dependencies, or disallowed files.

## Findings

**1. [Major/process, resolved]** All 3 Copilot threads were unresolved at review time, which this repo's process treats as blocking the gate. Two of the three threads' underlying issues were substantive, not style-only (findings 2 and 4 below) — now all fixed and resolved.

**2. [Minor, resolved]** `docs/ABLETON_INTEGRATION.md:18` still described `KEY_LEADER_ORDER` as governing phrase-leader/timing-key reference after this PR deletes it. The reviewer found this independently via its own repo-wide grep _before_ cross-checking Copilot's identical finding — a strong convergent signal. Side observation: the doc's original claim was already inaccurate pre-PR (the real phrase-leader mechanism has only ever used `TRIGGER_ORDER`, confirmed by direct code read). Fixed by correcting the "Trigger order" bullet and adding a dated correction note — a pure code-observation fix, zero behavior change.

**3. [Minor, resolved, new — not in the implementer's first pass]** `.claude/agents/audio-ableton-reviewer.md:21` lists `KEY_LEADER_ORDER` in its own "verify diffs preserve" checklist — stale for the same reason as finding 2, but missed by the implementer's earlier `.ts`/`.tsx`-only grep since this is a `.claude/agents/*.md` profile file. Fixed: reworded to note `TRIGGER_ORDER` also governs phrase-leader selection, dropping the stale mention.

**4. [Minor, resolved]** `sim/server.ts:43`'s updated comment re-pinned a specific line-number range (`AbletonAdapter.ts:29-30`), contradicting this same PR's own stated policy for its other three `sim/server.ts` fixes (dropped line numbers because "pinned line numbers are exactly what went stale here in the first place"). Independently flagged by Copilot too. Fixed by dropping the line-number suffix here as well, for consistency.

**5. [Nit, resolved]** `CurrentlyPlayingListContainer.tsx`'s new comment's quoted example (`"Flashback Drums 10A` / `135"`) wrapped across two comment lines in a way that read like a literal embedded newline. Fixed by swapping to a shorter example that fits on one line.

**6. [Nit, informational, no action]** The "Scope judgment calls" section's claim of a "comprehensive final sweep" undersold how many `sim/core/simulator.ts`/`sim/test/simulator.test.ts` stale-path comments exist beyond the one example cited (`sim/core/music-database.ts:60`) — 7+ instances each. The underlying decision to leave `sim/`'s independent mirror alone is sound (verified via the import-guard test); just a wording overclaim about scope, not a defect. No action taken — flagged for a possible future `sim/`-comments hygiene pass.

**Recommended, not required**: an audio-ableton-reviewer confirming pass on the `AbletonAdapter.ts`/`OutgoingEvents.ts` hunks, since every other ticket in this stacking chain obtained one. Explicitly framed by the reviewer as "cheap, consistent insurance, not a blocking requirement" — its own thorough trace concluded this diff doesn't cross this ticket's own conditional escalation bar ("brushes musical logic"). Declined for the reasons recorded in the implementer's agent-note; the ticket's own safety notes only require escalation conditionally (unlike WOW-014/017/018/020/021/025/027/031's unconditional requirement), and two independent traces (implementation-time and this review) both concluded the bar isn't met.

## Summary

The implementation itself was independently verified excellent — every one of the ten items confirmed a true no-op via direct tracing, not just narrative trust, and the live smoke test was reproduced with identical results. The CHANGES-REQUESTED verdict rested entirely on process (unresolved Copilot threads) plus two small, genuinely valuable documentation-accuracy catches (findings 2 and 3, both involving a now-deleted constant's stale references in musical-logic-adjacent docs) — all now fixed. No blockers, no code-behavior concerns.
