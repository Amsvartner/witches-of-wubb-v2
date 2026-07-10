---
name: prep-ticket
description: Generate per-role agent prompt files for a WOW ticket from its definition in the tickets doc, then stage them on a docs branch for human review. Use when asked to prep a ticket or generate/scaffold ticket prompts for WOW-XXX.
argument-hint: <WOW-XXX> [roles — default: derived from the ticket's "Suggested agent(s)" line]
---

# Prep Ticket — prompt generation

Generate `docs/agent-prompts/wow-<nnn>-<role>-prompts.md` files for one ticket. Ticket/roles: $ARGUMENTS

Invoking this skill is explicit authorisation to commit the generated docs files **on a `docs/wow-<nnn>-prompts` branch only** — never `main`, never production files. The human reviews before implementation starts. Do not push unless the human has enabled pushing.

## 1. Ground in the ticket

1. Find the ticket in `docs/TICKETS_001_INITIAL.md` (or later tickets doc). Not defined, placeholder, or blocked in `docs/DECISIONS_NEEDED.md` → **stop**; prompts are derived from tickets, never invented.
2. Read the ticket in full plus every doc/ADR it references.
3. Roles: from the ticket's "Suggested agent(s)" line; `reviewer` always gets a prompt; `test-engineer` for anything with code. The roles argument overrides.

## 2. Generate

Each prompt file contains, filled from the ticket (no generic filler):

- Role + profile file to read, and the required context files
- Goal, allowed files, disallowed files (standard task format from `AGENTS.md`)
- Acceptance criteria **verbatim from the ticket** — never weakened or extended
- Ticket-specific guidance, forbidden scope, and stop-and-ask triggers
- Required validations (`yarn lint`, `yarn test`, simulator scenario where relevant)
- Human-verifiable demo requirement (AGENTS.md) for implementation roles
- Output: note path `docs/agent-notes/wow-<nnn>-<role>-<topic>.md`; reviewers end with approve / approve-with-nits / block
- A `### Prompt N — run record` convention: after execution, append date, executor, branch + head SHA, verdict/outcome, note path

Anything genuinely ambiguous about ticket intent is a stop-and-ask, not a guess.

## 3. Hand off

Branch `docs/wow-<nnn>-prompts`; add only the generated files. Validate (files exist, `git diff --check`). Commit with a `docs:` message. Summarize: roles generated, ticket-specific decisions in the payload, anything for the human to double-check. After human review/merge, `/run-ticket WOW-<nnn>` starts the pipeline.
