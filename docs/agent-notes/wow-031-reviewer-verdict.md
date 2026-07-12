# WOW-031 PR #29 (clip-name normalization, partial landing) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, general review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #29 (draft), commit `5c73b4e0a3f77754c90d3bb8dbf9984159d2d023`.
- Method: read-only, no edits. Detected the same shared-checkout race the audio-ableton-reviewer hit, and independently arrived at the same mitigation (created its own isolated `git worktree` pinned to the review SHA for all reads and validation runs, removed when done) — a stronger mitigation than the audio-ableton-reviewer's pinned-`git show` approach, and worth adopting as the standard going forward per its own recommendation.

## Verdict: **APPROVE-WITH-NITS** (for the landed code specifically)

## Important clarifications on this reviewer's two process notes

**1. Shared/concurrently-mutated review environment.** Confirmed, same root cause as the audio-ableton-reviewer's finding (orchestrator foreground branch-switching while background reviewers were still running against the shared checkout). This reviewer's isolated-worktree mitigation is the better fix and is being adopted for future background reviews in this run.

**2. Legitimacy concern about `docs/agent-notes/wow-031-audio-ableton-reviewer-signoff.md`.** This reviewer found this file mid-review, on the local branch but not yet reflected in the `gh pr view 29` snapshot it happened to check at that moment (a timing artifact — the review ran for ~21 minutes in the background, overlapping with the orchestrator's own later fix-round work, and the file was pushed shortly after this reviewer's snapshot was taken, as part of the same push as the WOW-031 doc corrections). It also, correctly and appropriately, flagged that it had no legitimate channel to verify the "Orchestrator's response" paragraph inside that file was genuine rather than fabricated content pretending to speak for the orchestrator.

**Clarification, from the orchestrator (with full context this reviewer didn't have access to)**: the audio-ableton-reviewer review was a real, independently-run subagent call in this same pipeline (not fabricated), whose complete findings were returned via a task-notification and then transcribed **verbatim** into that file, with an "Orchestrator's response" section appended by the orchestrator itself — the same pattern used for every specialist/general review in this entire run (documented repeatedly in the run report), necessary because read-only reviewer subagents cannot commit their own files. This reviewer's skepticism was well-calibrated given what it could actually verify from its own vantage point — flagging an unverifiable authority claim rather than accepting it is the correct default behavior — it just didn't have visibility into the mechanism that makes it legitimate here. The audio-ableton-reviewer sign-off is real and stands; both its verdict and this general reviewer's verdict are recorded independently in this docs directory for anyone to audit.

## Findings

**1. [Major — process]** Shared/concurrently-mutated review environment — see above, not a WOW-031 code defect.

**2. [Major] "All 5 `AbletonAdapter.ts` sites are CSV-vs-CSV" was incorrect for 3 of them** — independently traced operand provenance from `IncomingEvents.ts` through the `playing_slot_index` listener and arrived at the identical conclusion as the audio-ableton-reviewer: `isClipPlaying`, the phrase-leader match, and the `clipNameToInfoMap` lookup all involve `playingClips[pillar].clipName`, itself set from `clip?.raw.name` — Ableton's own raw name, not CSV data. Confirmed via `ClipNameToInfoMapType` explicitly `Omit`-ing `clipName`, so `clipInfo.clipName` can only come from the raw-name local variable. **Does not change code safety** — the change at all 5 sites is textually `X.replace(/[* ]/g, '')` → `ClipNameUtil.normalizeClipName(X)`, a pure substitution regardless of operand provenance — but the write-up's reasoning was wrong for a majority of the sites. _(Fixed in the same round as the audio-ableton-reviewer's identical finding — see `docs/agent-notes/wow-031-creative-tech-integrator-clip-name-normalization.md`.)_

**3–5. Copilot's 3 threads** (double-computed `normalizeClipName` call, misleadingly-named "no-op" test, pre-existing "queing" typo) — independently confirmed all three as real and worth fixing. _(All 3 fixed — see the Copilot-fix commit on this branch.)_

**6. [Minor]** The agent-note's "checked all four" docs claim omitted `docs/ABLETON_INTEGRATION.md` — the single most on-topic doc for this question. Independently checked it (pinned ref): no pre-answered decision, self-described as "observed from code," never mentions asterisks — conclusion holds, but the stated diligence was incomplete. _(Fixed — the agent-note now says "checked all five" and credits this finding.)_

**7. [Nit, genuinely valuable]** No direct test for `CsvUtil.enrichRecommendations`'s normalization site — and, more importantly, **`enrichRecommendations` is currently dead code**: its only call site in `MusicDatabaseService.ts` is commented out. Independently confirmed via `grep` and reading the surrounding context (`MusicDatabaseService.ts:22-24`) — this matches an already-existing, independently-documented fact elsewhere in the codebase (`sim/test/music-database.test.ts`'s "EnrichRecommendations is disabled in the real backend" test title). Strengthens the "inert" argument for the `CsvUtil.ts` fix considerably — half of it isn't just inert against current data, it isn't executed at all today. _(Incorporated into the agent-note.)_

**8. [Nit]** `queueClip`/`stopOrRemoveClipFromQueue` have no direct unit coverage before or after this PR — pre-existing gap, not worsened here; confidence in behavior-preservation rests on hand-tracing plus clean `tsc`, not an automated regression test. Not actionable within this ticket's scope (no test seam exists, matching WOW-021's identical situation on the same file).

**9. [Nit]** PR template's demo section was omitted rather than filled in or marked N/A. _(Fixed — added to the PR body.)_

## Verified / confirmed correct (independently, in an isolated worktree)

- Diff scope: exactly the 6 files GitHub reports, all ticket-allowed or the standard agent-note. No drive-bys, no dependency changes.
- `MemoizedClipIndex`/`FindAllClipsInLoop`: byte-for-byte unchanged — confirmed via diff (never appear in a `+`/`-` line) and a direct `git diff` between pinned base/head SHAs.
- `Music Database.csv`: 154 data rows, zero literal `*` anywhere — verified twice, byte-identical (matching SHA-256) to `main`.
- The `CsvUtil.ts` latent-bug diagnosis is correct and precisely traced.
- All 4 refactored boolean expressions preserve exact original semantics — hand-traced null/empty-string/normal-string cases including "both sides empty string."
- No pre-answered naming-convention decision exists anywhere checked (5 docs, including `ABLETON_INTEGRATION.md`).
- `sim/core/simulator.ts:58` genuinely implements the same strip pattern independently.
- New tests: every assertion hand-verified by manual regex tracing, correct and meaningful.
- Validation, run in an isolated worktree pinned to the review SHA: `yarn lint` clean, both `tsc --noEmit` runs clean, `yarn test` → 95/95 passed (16 files), `yarn build` clean. GitHub's own CI on this commit also reports SUCCESS.
- The decision to block `MemoizedClipIndex`/`FindAllClipsInLoop` and the specific question posed: sound and well-posed. The ticket's own text ("the pervasive `[* ]` stripping strongly suggests real Live set names contain asterisks") is in genuine tension with the asterisk-free CSV — real ambiguity, not manufactured caution.

## Summary

The landed code is correct, behavior-preserving, and safe: all 5 `AbletonAdapter.ts` sites and both `CsvUtil.ts` sites are provably no-ops against current data/behavior, the two genuinely behavior-affecting sites are confirmed untouched, tests are real and correct, and all validation commands are green. The decision to block on the human's answer is sound and, per this reviewer's own analysis, arguably even better-justified than the PR's original framing. The one substantive finding — the PR's "CSV-vs-CSV only" safety narrative was wrong for 3 of 5 sites — independently converges with the audio-ableton-reviewer's identical finding, and has been corrected. All 3 Copilot threads, the incomplete docs-checked claim, and the missing demo-steps section have been fixed in the same round.
