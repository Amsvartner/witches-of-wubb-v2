---
name: sync-docs
description: Documentation-maintainer pass — reconcile docs, tickets, ADRs, DECISIONS_NEEDED, and agent instructions with each other and with recently merged code. Use after merges, answered decisions, or when docs drift is suspected.
argument-hint: [optional focus, e.g. "after WOW-003" or a doc path]
---

# Sync Docs

Run a consistency pass over the documentation system, acting as the **documentation-maintainer** profile (`.claude/agents/documentation-maintainer.md`). Focus: $ARGUMENTS

Invoking this skill is explicit authorisation for docs-only commits on a `docs/…` branch — never `main`, never code/config/CSV/Arduino files.

## Pass

1. **Decisions:** answered items in `docs/DECISIONS_NEEDED.md` → propagate into owning docs + ADRs; new open questions found in notes/tickets → add them.
2. **Reality:** recent commits vs. `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, PRD FRs, and the socket contract description — update docs where merged behavior changed (never the other way around).
3. **Tickets:** statuses in `docs/TICKETS_001_INITIAL.md` (and successors) match `docs/agent-notes/` evidence; done tickets marked; new follow-ups from notes ticketed as drafts for project-manager.
4. **Cross-references:** ADR index complete; README docs index accurate; no dangling references (renumbered ADRs, removed sections); stale TBDs that now have answers.
5. **Agent instructions:** `.claude/agents/` and `.claude/skills/` consistent with AGENTS.md version — bump AGENTS.md `Last updated` if it changed.

## Output

Docs diffs plus a change log: files touched, contradictions found (unresolvable ones go to DECISIONS_NEEDED and stop the relevant claim), decisions propagated, remaining TBDs. Commit on a docs branch with a `docs:` message.
