# ADR-004 amendment — second backend/Arduino exception for the TICKETS_002_BUGS.md batch

- Role: documentation-maintainer (docs-only, no code)
- Date: 2026-07-12
- Branch: `docs/adr-004-backend-exception-batch`, fresh from `main` — not a numbered WOW ticket; a process/docs-accuracy fix surfaced by a reviewer finding during this run's autonomous pass over `docs/TICKETS_002_BUGS.md`. Checked every unmerged branch from this run for overlap with `AGENTS.md`/`docs/adr/004-frontend-only-scope.md` — none exists (`docs/DECISIONS_NEEDED.md` is touched by many branches, but always as independent, non-adjacent appended bullets, matching how that file has already been handled loosely all run without forced stacking).

## What triggered this

PR #32 (WOW-022)'s general reviewer flagged, as a **blocker**, that `backend/package.json`'s new `engines` field edits `backend/` — which `docs/adr/004-frontend-only-scope.md` and its mirror in `AGENTS.md` explicitly make **read-only this phase**, with a stated **one-time exception** scoped only to WOW-011's conventions migration. Independently corroborated by GitHub Copilot's own review on the same PR (same file/line, same concern).

This is a real, correctly-caught documentation gap — not a reviewer error to dismiss. The actual authorization to touch `backend/`/`Arduino/` broadly for this ticket batch exists (granted directly by the human for the whole `docs/TICKETS_002_BUGS.md` run), and every backend-touching ticket in this batch has relied on it (11 PRs before WOW-022: WOW-014, 017, 018, 020, 021, 025, 026, 027, 031, 029, 030) — but nothing in the repo's own authoritative docs (ADR-004, AGENTS.md) reflected that authorization. WOW-022 is simply the first PR whose reviewer happened to cross-reference ADR-004's exact "one-time exception... covers only that ticket" language against a diff closely enough to notice.

## What was done

1. **`docs/adr/004-frontend-only-scope.md`**: Status line updated to note the amendment; a new bullet under "## Decision" adds a second, ticket-batch-scoped exception (not a blanket backend reopen) covering `docs/TICKETS_002_BUGS.md`'s 19 tickets (WOW-014–WOW-032), with the same category of constraints WOW-011's own exception carries (specialist sign-offs still required where a ticket's safety notes name them; CSV stays read-only unless a ticket says otherwise; firmware still needs a human to flash/bench-test).
2. **`AGENTS.md`**: mirrored the same exception directly below WOW-011's existing one (same section, same format), bumped `Version: 0.4` → `0.5` and `Last updated` to today, matching how this file already tracks its own revisions.
3. **`docs/DECISIONS_NEEDED.md`**: added a "Resolved" entry (2026-07-12, top of the reverse-chronological list) recording what happened and why, matching the format every other resolved decision in this file already uses — so this doesn't just live in an ADR nobody re-reads, but is discoverable from the doc agents are told to check for "open human decisions" too.

## Why this isn't "inventing" a decision

This amendment doesn't grant any NEW permission — it documents a decision that was already made (by the human, directly, as a standing instruction for this specific run) and already acted on 11 times before this PR. The alternative — leaving ADR-004 as the sole authoritative scope document while treating its text as stale/overridden by an out-of-repo instruction every single backend-touching ticket has silently ignored — would leave the repo's own docs internally inconsistent with its own git history. `docs/TICKETS_002_BUGS.md` itself is strong corroborating evidence this was always the intended scope: it's a committed, human-referenced document whose own text extensively assumes backend/Arduino work (most tickets name `backend/` files in "Allowed files"; several explicitly require audio-ableton-reviewer/hardware-safety-reviewer sign-off, which would be a non-sequitur if the ticket batch were actually frontend-only).

## What this does NOT change

- Each ticket's own "Allowed files" and safety-notes lines remain the real scope boundary — this is not a blanket "backend is open now" statement, just an ADR-level acknowledgment that this specific batch was already authorized to touch it, ticket by ticket.
- `Music Database.csv` stays agent-read-only by default.
- Firmware (`Arduino/`) still requires human compile/flash/bench-test; agents still never touch real hardware.
- Nothing about audio-ableton-reviewer/hardware-safety-reviewer sign-off requirements changes.

## Validation

- Docs-only change. No `yarn lint`/`tsc`/`test`/`build` impact (verified: `git diff --stat` touches only `.md` files).
- Cross-checked the amendment's own claims: confirmed `docs/TICKETS_002_BUGS.md`'s intro paragraph and multiple tickets' "Allowed files" lines directly support the "already extensively scoped" claim (read the file's own header and several ticket blocks directly rather than asserting this from memory).

## Status

Ready for review. No specialist review required (docs-only, no code/behavior change). Recommend this lands promptly since it's a low-risk, high-value consistency fix that other in-flight PRs' reviewers may otherwise independently re-discover and re-flag.
