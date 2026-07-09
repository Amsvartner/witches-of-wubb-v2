---
name: preflight
description: Verify every prerequisite for a WOW ticket before work starts — ticket definition, prompt files, agent profiles, required context docs, git state, tooling. Reports exactly what is missing instead of improvising. Use before starting a WOW-XXX ticket or when asked to preflight, verify prerequisites, or check readiness.
argument-hint: <WOW-XXX ticket id>
---

# Preflight

Verify prerequisites for: $ARGUMENTS

The deliverable is an exact report of what is present and what is missing. Never fix a gap by improvising, reconstructing a file from memory, or pulling from an unmerged branch.

## Checks

1. **Ticket definition** — the ticket appears in `docs/TICKETS_001_INITIAL.md` or a later tickets doc, is not a placeholder, and is not blocked by an open item in `docs/DECISIONS_NEEDED.md`.
2. **Prompt files** — if `docs/agent-prompts/wow-<nnn>-*-prompts.md` files exist, list which roles are covered. If none exist, note that `/prep-ticket WOW-<nnn>` can generate them (they are optional for small tickets — the ticket text itself may suffice; say which situation applies).
3. **Agent profiles** — every profile the ticket's "Suggested agent(s)" line names exists in `.claude/agents/`.
4. **Required context docs** — `AGENTS.md`, `docs/PRD.md`, `docs/CODING_GUIDELINES.md`, `docs/ARCHITECTURE.md`; plus `docs/UX_UI_PRINCIPLES.md` and the approved design docs for UI work; plus the relevant ADRs.
5. **Git state** — current branch name; working tree clean (`git status --short`); local branch not behind `origin` (fetch first). Flag stale `.git/*.lock*` files (known sandbox issue) for the human to remove.
6. **Tooling** — `node_modules` present at root (note to run `yarn install` if not — human runs installs); `yarn lint` and `yarn test` runnable. Never `yarn start-backend`.

## Output

A ✅/❌ checklist covering every item. If everything passes: "Preflight clean — ready to start <ticket>."

If anything fails: **STOP**. List exactly what is absent or wrong with a suggested resolution. Do not begin implementation in the same turn.
