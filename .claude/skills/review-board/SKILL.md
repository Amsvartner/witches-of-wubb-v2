---
name: review-board
description: Run a parallel multi-agent review board on a WOW branch or PR — general reviewer, architecture, test-coverage, and UI/a11y lenses launched as simultaneous read-only subagents, synthesized into one consolidated verdict note. Use when asked for a review board, parallel review, or a consolidated multi-reviewer verdict.
argument-hint: [PR number or WOW-XXX — defaults to the current branch diff against main]
---

# Review Board

Run the reviewer lenses in parallel and converge on one verdict. All rules in `AGENTS.md` apply. Target: $ARGUMENTS

## 0. Preflight

1. Resolve the diff: `gh pr diff <n>` for a PR, else `git diff main...HEAD`. No diff → stop and ask.
2. Verify the needed profiles exist in `.claude/agents/` — stop and report if any are missing.

## 1. Seats

Always: **reviewer** (scope, tests, hardcoding, docs drift) and **test-engineer** (coverage, hardware-free tests). Add **architecture-reviewer** when the diff touches structure, contexts, or the socket layer; **frontend-ui-designer** (a11y/UX lens) for visual work. **audio-ableton-reviewer** / **hardware-safety-reviewer** only if the diff touches the event contract, `backend/`, or `Arduino/` — that alone is a finding this phase (ADR-004).

Launch all seats as **parallel read-only subagents**, each given the diff, its profile, and the ticket. Subagents return findings; they never edit files.

## 2. Synthesize

Merge findings into `docs/agent-notes/wow-<nnn>-review-board.md`: deduplicate, resolve conflicts between seats (stricter wins unless clearly wrong), group by severity (Blocker/High/Medium/Low), attribute each finding to its seat(s).

Consolidated verdict: **PASS / PASS WITH REQUIRED CHANGES / BLOCKED**, at the reviewed head SHA.

## 3. Close out

- Low-risk, in-scope fixes (typos, obvious nits) may be applied directly if the human asked for fixes; otherwise everything is findings-only.
- Blockers and anything touching disallowed files are escalated to the human, never fixed silently.
- Summary: verdict, findings count by severity and seat, note path, suggested next step (`/address-reviews` if changes are required).
