# ADR-004 amendment PR #34 — documentation-maintainer review verdict

- Reviewer: documentation-maintainer (Claude Sonnet 5)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote)
- Review target: PR #34, base `main`. Not stacked.
- Method: read-only, isolated `git worktree`.

## Verdict: **APPROVE-WITH-NITS**. No blockers.

## What was independently verified (not just trusted from the PR's own description)

1. **Central factual claim** — read `docs/TICKETS_002_BUGS.md` in full at `origin/main`. Confirmed the intro-paragraph quote ("a full-repo review") is exact. Counted directly: 10/19 tickets name `backend/` paths, 3/19 name `Arduino/` paths, combined 13/19 (68%) name backend and/or Arduino paths in their own "Allowed files" line; 12/19 explicitly require audio-ableton-reviewer and/or hardware-safety-reviewer sign-off. Found the single strongest piece of corroborating evidence, not cited anywhere in the PR: WOW-022's own "Allowed files" line in `docs/TICKETS_002_BUGS.md` already explicitly named `` `backend/package.json` (engines field only) `` — the ticket-planning document itself, independent of any ADR-004 question, already authorized exactly the edit that triggered this whole amendment.
2. **Scope of the amendment** — compared the new exception block against WOW-011's existing one in both `AGENTS.md` and `docs/adr/004-frontend-only-scope.md`. Consistent format/rigor, correctly bounded (ticket-batch-scoped, not a blanket reopen). Found one real gap: the ADR-004 bullet omitted the firmware/Arduino human-flash-only constraint that `AGENTS.md`'s mirror included and the PR body claimed was present.
3. **Internal consistency** — ADR-004's Status line, `AGENTS.md`'s version bump (0.4→0.5) and date, and the new `DECISIONS_NEEDED.md` entry's date all agree (2026-07-12), all describe the same ticket range. Clean.
4. **`DECISIONS_NEEDED.md` placement** — correctly the newest entry, at the top of the reverse-chronological "Resolved" section. Checked the actual formatting convention of neighboring 2026-07-09 through 2026-07-11 entries (not assumed): every one bolds the actual resolved outcome within its sentence. The new entry didn't.
5. **Overreach risk** — low; both files repeatedly and explicitly bound the exception to the named ticket range and restate "outside it, read-only" in the same breath.
6. **Cross-reference to WOW-022 (PR #32)** — read PR #32's diff, its Copilot comment on `backend/package.json:7` (which independently names the exact same conflict), and PR #32's own committed `docs/agent-notes/wow-022-reviewer-verdict.md`, which already explicitly names PR #34 as the accepted resolution mechanism. Confirmed: a reasonable reviewer reading WOW-022's diff after this PR lands would see no conflict.

## Findings (severity, all fixed)

**1. [Moderate, fixed]** The committed agent-note's "11 PRs before WOW-022" list named WOW-025, WOW-026, and WOW-027 as having touched `backend/`/`Arduino/` — verified via `git diff --stat main <branch> -- backend/ Arduino/` against every one of the 14 pre-WOW-022 branches that these three tickets' own diffs are confined to `src/`/`docs/agent-notes/`, matching their own tickets' "Allowed files" lines (which never named backend/Arduino paths). The list should instead have included WOW-015 (adds `backend/service/test/**`/`backend/util/test/**`) and WOW-028 (edits both `Arduino/*.ino` sketches) and WOW-032 (touches `backend/adapter/AbletonAdapter.ts`/`backend/index.ts`, its PR predates WOW-022's). The total of 11 was coincidentally correct; membership was wrong. Notable because the note's own "Validation" section specifically claimed to have cross-checked its claims rather than asserting from memory — true for the ticket-text check, not extended to this specific PR list. Fixed: corrected membership.

**2. [Moderate, fixed]** `docs/adr/004-frontend-only-scope.md`'s new amendment bullet restated 3 of the 4 constraints its `AGENTS.md` mirror includes, omitting the firmware/Arduino human-only-compile-flash-bench-test clause entirely — a real content gap, not a stylistic one, given firmware/hardware safety is the highest-stakes constraint category this repo's whole agent-safety model protects. The PR's own body claimed this constraint was present in both files; it wasn't. Fixed: added the missing clause to the ADR bullet.

**3. [Minor, fixed]** `docs/DECISIONS_NEEDED.md`'s new entry used no bold emphasis on the resolved outcome, breaking with every neighboring entry's established convention (checked specifically, not assumed). Fixed: bolded the actual decided value.

**4. [Nit, fixed]** "Most... name `backend/` files," read strictly as backend-only, is a thin 53% (10/19) majority — a defensible but imprecise phrasing given the confident tone. Fixed: both the ADR bullet and the agent-note now state the precise, verified count (13 of 19, 68%, backend+Arduino combined) instead of "most."

## Informational, not a finding against this PR

Found an orphaned, never-pushed local branch `docs/sync-2026-07-11` (commit `f408e7d`) containing an unlanded change that would mark WOW-011's `AGENTS.md` exception "CONCLUDED"/"spent." No remote ref, no associated PR (open, closed, or merged) — not part of the live PR graph, poses no merge-conflict risk to this PR. Means `main`'s WOW-011 exception text is itself already slightly stale (reads as still-active though that ticket fully merged 2026-07-10), a pre-existing gap unrelated to and not caused by this PR. Not actioned here — passed along as a separate future-cleanup observation only.

## Summary

The amendment's central thesis holds up under direct, independent verification and is properly bounded. All four findings — one genuine content gap (the missing firmware constraint), one factual list error in supplementary rationale (not the operative policy text), and two minor formatting/wording nits — are now fixed. This PR is low-risk (docs-only) and actively unblocks PR #32, which already names it as the accepted resolution for its own blocker finding.
