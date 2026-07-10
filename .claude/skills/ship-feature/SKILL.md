---
name: ship-feature
description: Run the full WOW ticket pipeline end to end — implement + PR, Copilot round, test review + fixes, general review + fixes, gate — pausing only at stop conditions. Autopilot over the run-ticket phases. Use when asked to ship, deliver, or run a WOW-XXX ticket end to end.
argument-hint: <WOW-XXX> [checkpoint — pause after each phase for confirmation]
---

# Ship Feature — full pipeline autopilot

Deliver one ticket end to end by running the phases defined in `.claude/skills/run-ticket/SKILL.md` **sequentially in one session**, instead of one phase per invocation. All rules in `AGENTS.md` apply. Ticket: $ARGUMENTS

Invoking this skill is explicit authorisation for the commits each phase requires, on the ticket branch only — never `main`. Merging and pushing to `main` are never done by this skill.

## Before starting

1. Run the `/preflight` checklist. Any ❌ → stop and report. Missing prompt files for a large ticket → suggest `/prep-ticket`.
2. Detect the current phase exactly as run-ticket does, so a partially completed ticket resumes mid-pipeline.

## Execution

Run phases A → G in order — implement + PR, Copilot round, test review, test fixes, general review, review fixes, gate — using run-ticket's specs, mechanics, and stop conditions verbatim. Specialist reviews slot in before E per the ticket's safety notes.

- Do not pause between phases, with two exceptions: any run-ticket stop condition, and **checkpoint mode** (argument includes `checkpoint`) — stop after each phase, summarize, wait for go-ahead.
- Reviews run as fresh read-only subagents; independent reviews may run in parallel per `.claude/skills/review-board/SKILL.md`, with notes committed sequentially.
- A review requiring changes → fix round → **re-run that review** so the final state is a pass at a fresh SHA.

## Done

Gate passed: lint/tests green, CI green, Copilot review clean (no unresolved threads), all verdicts pass at HEAD, demo steps written, docs updated, no disallowed files touched. Final summary: PR link, per-phase outcomes with SHAs and verdicts, fix rounds, residual risks. The PR is left open for the human to review and merge.
