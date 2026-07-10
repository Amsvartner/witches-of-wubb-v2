---
name: run-ticket
description: Run the next phase of the WOW ticket pipeline, derived from repo state — implement + PR, Copilot round, test review, fixes, general review, fixes, gate. One phase per invocation; the human stays in control between phases. Use when asked to run the next ticket phase, continue a ticket, or run a specific phase.
argument-hint: [WOW-XXX — defaults to the first unblocked in-progress ticket] [optional phase override, e.g. "test-review"]
---

# Run Ticket — pipeline phase runner

Run exactly **one** phase, then stop and summarize. All rules in `AGENTS.md` and `docs/agent-prompts/RUN_NEXT_AGENT.md` apply. Ticket/phase: $ARGUMENTS

Invoking this skill is explicit authorisation for the commits **and branch pushes** the _current phase_ requires, on the ticket branch (`feat/wow-<nnn>-…`) or a docs branch only — never `main`. Reviewer phases commit only notes and run records. Merging and pushing to `main` are never done by this skill.

## Resolve ticket and phase

1. Ticket: from the argument, else the first non-placeholder, unblocked ticket in progress (check `docs/TICKETS_001_INITIAL.md` and `docs/agent-notes/`).
2. Run `/preflight` checks mentally first; a hard gap → stop, suggest the fix (e.g. `/prep-ticket`).
3. Detect the next phase from repo state, top to bottom — first incomplete wins (argument overrides):

| Phase            | Run when                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------- |
| A. implement     | No `feat/wow-<nnn>-*` branch on origin and no open PR for the ticket                      |
| B. copilot-round | PR open, and Copilot review not yet requested, not yet arrived, or has unresolved threads |
| C. test-review   | `docs/agent-notes/wow-<nnn>-test-engineer-review.md` missing                              |
| D. test-fixes    | Test review has Required items without fixes, or Recommended items without fix/rationale  |
| E. review        | `docs/agent-notes/wow-<nnn>-reviewer-review.md` missing or stale (commits after its SHA)  |
| F. review-fixes  | Review has unaddressed Required/Recommended items                                         |
| G. gate          | Everything above complete — verify and declare ready for human review                     |

Specialist reviews slot in before E when the ticket's safety notes name them: architecture-reviewer (socket-contract or structure changes), frontend-ui-designer (visual/a11y tickets), audio-ableton-reviewer / hardware-safety-reviewer (only if the diff touches the event contract, `backend/`, or `Arduino/` — should not happen this phase).

## Common mechanics (every phase)

- **Implementation (A)**: follow the role's profile and the ticket (or its prompt file). Validations: `yarn lint`, `yarn test`, and the simulator demo where relevant. Write the implementation note with human demo steps. Finish by pushing the ticket branch to `origin` and opening a PR **in the fork, never the parent repo** (`gh pr create --repo Amsvartner/witches-of-wubb-v2 --base main` — this repo is a fork and gh defaults to the parent), filling `.github/pull_request_template.md` **completely** — every section, real demo steps, ticked checklists; a sparse PR body is a gate failure — **every PR gets a Copilot review (human policy 2026-07-09)**, so request it immediately (`gh pr edit <n> --add-reviewer Copilot`; if the repo has Copilot auto-review enabled, verify it triggered instead).
- **Copilot round (B)**: wait for/fetch Copilot's review; address every unresolved thread (fix or reasoned reply + resolve); push fixes. Re-request if new commits invalidate it.
- **PR autofill**: resolve PR URL and head SHA with `gh pr view --json url,headRefOid`; never ask the human for the URL.
- **PR checklist**: maintain the `## Pipeline status` section in the PR body (`gh pr edit --body`), one line per phase: `- [x] Copilot round: clean @ <sha>` etc. Update at the end of every phase.
- **Reviews (C, E, specialists)**: run as fresh read-only subagents against `git diff main...HEAD`. Verdict: approve / approve-with-nits / block, written to the note.
- **Run record**: append `### Prompt N — run record` (date, executor, PR URL + head SHA in backticks, verdict/outcome, note path) to the ticket's prompt file if one exists, else to the note itself.
- **Fix rounds (D, F)**: address every Required item; Recommended items get a fix or a documented rationale. After fixes, the corresponding review is re-run so the final state is a pass at a fresh SHA.

## Gate (G)

Confirm: lint + tests green, CI green on the PR, **Copilot review present with no unresolved threads**, all reviews pass at current HEAD, demo steps present, docs updated where behavior changed, no disallowed files touched (`backend/`, `Arduino/`, CSV, `.env`), pipeline checklist ticked. Then summarize per-phase outcomes with SHAs and verdicts. The PR is left open for the human to review and merge.

## Stop conditions

Any AGENTS.md stop-and-ask trigger; a BLOCK verdict; ambiguous branch state; a needed file missing on the branch. Stop, report, do not improvise.
