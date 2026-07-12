# ADR-004 amendment — second backend/Arduino exception for the TICKETS_002_BUGS.md batch

- Role: documentation-maintainer (docs-only, no code)
- Date: 2026-07-12
- Branch: `docs/adr-004-backend-exception-batch`, fresh from `main` — not a numbered WOW ticket; a process/docs-accuracy fix surfaced by a reviewer finding during this run's autonomous pass over `docs/TICKETS_002_BUGS.md`. Checked every unmerged branch from this run for overlap with `AGENTS.md`/`docs/adr/004-frontend-only-scope.md` — none exists (`docs/DECISIONS_NEEDED.md` is touched by many branches, but always as independent, non-adjacent appended bullets, matching how that file has already been handled loosely all run without forced stacking).

## What triggered this

PR #32 (WOW-022)'s general reviewer flagged, as a **blocker**, that `backend/package.json`'s new `engines` field edits `backend/` — which `docs/adr/004-frontend-only-scope.md` and its mirror in `AGENTS.md` explicitly make **read-only this phase**, with a stated **one-time exception** scoped only to WOW-011's conventions migration. Independently corroborated by GitHub Copilot's own review on the same PR (same file/line, same concern).

This is a real, correctly-caught documentation gap — not a reviewer error to dismiss. The actual authorization to touch `backend/`/`Arduino/` broadly for this ticket batch exists (granted directly by the human for the whole `docs/TICKETS_002_BUGS.md` run), and every backend/Arduino-touching ticket in this batch has relied on it (11 PRs before WOW-022, verified via `git diff --stat main <branch> -- backend/ Arduino/` against each: WOW-014, 015, 017, 018, 020, 021, 028, 029, 030, 031, 032) — but nothing in the repo's own authoritative docs (ADR-004, AGENTS.md) reflected that authorization. WOW-022 is simply the first PR whose reviewer happened to cross-reference ADR-004's exact "one-time exception... covers only that ticket" language against a diff closely enough to notice.

## What was done

1. **`docs/adr/004-frontend-only-scope.md`**: Status line updated to note the amendment; a new bullet under "## Decision" adds a second, ticket-batch-scoped exception (not a blanket backend reopen) covering `docs/TICKETS_002_BUGS.md`'s 19 tickets (WOW-014–WOW-032), with the same category of constraints WOW-011's own exception carries (specialist sign-offs still required where a ticket's safety notes name them; CSV stays read-only unless a ticket says otherwise; firmware still needs a human to flash/bench-test).
2. **`AGENTS.md`**: mirrored the same exception directly below WOW-011's existing one (same section, same format), bumped `Version: 0.4` → `0.5` and `Last updated` to today, matching how this file already tracks its own revisions.
3. **`docs/DECISIONS_NEEDED.md`**: added a "Resolved" entry (2026-07-12, top of the reverse-chronological list) recording what happened and why, matching the format every other resolved decision in this file already uses — so this doesn't just live in an ADR nobody re-reads, but is discoverable from the doc agents are told to check for "open human decisions" too.

## Why this isn't "inventing" a decision

This amendment doesn't grant any NEW permission — it documents a decision that was already made (by the human, directly, as a standing instruction for this specific run) and already acted on 11 times before this PR. The alternative — leaving ADR-004 as the sole authoritative scope document while treating its text as stale/overridden by an out-of-repo instruction every single backend-touching ticket has silently ignored — would leave the repo's own docs internally inconsistent with its own git history. `docs/TICKETS_002_BUGS.md` itself is strong corroborating evidence this was always the intended scope: it's a committed, human-referenced document whose own text extensively assumes backend/Arduino work — counted directly: 13 of its 19 tickets (68%) name `backend/` and/or `Arduino/` paths in their own "Allowed files" line, and 12 of 19 explicitly require audio-ableton-reviewer/hardware-safety-reviewer sign-off, which would be a non-sequitur if the ticket batch were actually frontend-only. **Strongest single piece of evidence**: WOW-022's own "Allowed files" line in `docs/TICKETS_002_BUGS.md` already explicitly named `` `package.json` + `backend/package.json` (engines field only) `` — the ticket-planning document itself, independent of any ADR-004 question, already authorized exactly the edit that triggered this whole amendment.

## What this does NOT change

- Each ticket's own "Allowed files" and safety-notes lines remain the real scope boundary — this is not a blanket "backend is open now" statement, just an ADR-level acknowledgment that this specific batch was already authorized to touch it, ticket by ticket.
- `Music Database.csv` stays agent-read-only by default.
- Firmware (`Arduino/`) still requires human compile/flash/bench-test; agents still never touch real hardware.
- Nothing about audio-ableton-reviewer/hardware-safety-reviewer sign-off requirements changes.

## Validation

- Docs-only change. No `yarn lint`/`tsc`/`test`/`build` impact (verified: `git diff --stat` touches only `.md` files).
- Cross-checked the amendment's own claims: confirmed `docs/TICKETS_002_BUGS.md`'s intro paragraph and multiple tickets' "Allowed files" lines directly support the "already extensively scoped" claim (read the file's own header and several ticket blocks directly rather than asserting this from memory).

## Fix round (documentation-maintainer review, APPROVE-WITH-NITS)

The reviewer independently verified every quantitative claim in this note against `docs/TICKETS_002_BUGS.md`'s actual text (not trusting the PR's description), confirmed the three edited files stay internally consistent, confirmed the `DECISIONS_NEEDED.md` entry's placement is correct, and confirmed via PR #32's own diff, Copilot comment, and committed reviewer-verdict note that this amendment actually resolves WOW-022's blocker as claimed. Verdict: **APPROVE-WITH-NITS**, no blockers. Findings, all fixed:

1. **[Moderate]** This note's "11 PRs" list named WOW-025/026/027 (which don't touch `backend/`/`Arduino/` at all — verified independently by the reviewer via `git diff --stat` against each branch, and re-verified again here before fixing) instead of the three it actually omitted, WOW-015/028/032 (which do). The total of 11 was coincidentally right; membership was wrong. This matters because this note's own "Validation" section specifically claimed to have cross-checked claims "rather than asserting this from memory" — true for the ticket-text check, not extended to this specific list. Fixed: corrected list above, verified via the same `git diff --stat main <branch> -- backend/ Arduino/` method against all 14 pre-WOW-022 branches.
2. **[Moderate]** `docs/adr/004-frontend-only-scope.md`'s amendment bullet omitted the firmware/Arduino human-flash-only constraint that `AGENTS.md`'s mirror includes and this PR's own body claims is present — a real content gap, not just a wording issue, given firmware/hardware safety is this repo's highest-stakes constraint category. Fixed: added the missing clause to the ADR bullet, matching `AGENTS.md`.
3. **[Minor]** `docs/DECISIONS_NEEDED.md`'s new entry used no bold emphasis on the resolved outcome, unlike every neighboring entry (checked specifically: 2026-07-09 through 2026-07-11 entries all bold the actual decided value). Fixed: bolded "a second, ticket-scoped exception."
4. **[Nit]** "Most... name `backend/` files" is a thin 53% majority if read literally as backend-only (13/19 = 68% including `Arduino/`). Fixed: both this note and the ADR bullet now state the precise, verified count (13 of 19, 68%) instead of the vaguer "most."

**Not fixed, informational only**: the reviewer found an orphaned, never-pushed local branch (`docs/sync-2026-07-11`) containing an unlanded change that would mark WOW-011's exception "concluded"/"spent" in `AGENTS.md`. No remote ref, no associated PR, poses no conflict risk to this PR, and predates this session's own work. Not this PR's responsibility to clean up — noted here in case it's useful context for a future docs pass, but explicitly not actioned.

## Status

Fix round complete, all findings resolved. Ready for gate — docs-only, no specialist review required, no code/behavior change.
