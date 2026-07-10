# Custom agents

Agent profiles for Claude Code subagents working on Witches of Wubb. Every agent must read `/AGENTS.md` first — it is the binding contract; these profiles specialize it.

> **Current phase (ADR-004): frontend-only.** `audio-ableton-reviewer` and `hardware-safety-reviewer` are dormant — invoke only if a diff unexpectedly touches the socket event contract, `backend/`, or `Arduino/`. `creative-tech-integrator`'s active duty is the offline simulator (ADR-001).
>
> Runner protocol: `docs/agent-prompts/RUN_NEXT_AGENT.md`. Output notes: `docs/agent-notes/`. Pipeline skills: `.claude/skills/` (`/preflight`, `/prep-ticket`, `/run-ticket`, `/ship-feature`, `/address-reviews`, `/review-board`, `/sync-docs`) — see the skills table in `AGENTS.md`.

## Roster

| Agent                    | Role                                          | Writes code?       |
| ------------------------ | --------------------------------------------- | ------------------ |
| project-manager          | Scope, tickets, PRD/plan upkeep               | no                 |
| architecture-reviewer    | Boundary/drift review                         | no                 |
| frontend-ui-designer     | Design direction, a11y, interaction proposals | no (docs/specs)    |
| frontend-implementer     | Approved UI tickets                           | yes (UI only)      |
| creative-tech-integrator | Ableton/RFID/LED/real-time code               | yes (with reviews) |
| audio-ableton-reviewer   | Musical/timing/mapping review                 | no                 |
| hardware-safety-reviewer | Physical-safety review                        | no                 |
| test-engineer            | Test/simulation strategy and tests            | yes (tests only)   |
| documentation-maintainer | Docs/tickets/ADR alignment                    | no (docs)          |
| reviewer                 | Strict general diff review                    | no                 |

## Conventions

- Frontmatter uses `name` and `description` only. **`model` and `effort` fields are omitted** because the exact model identifiers supported by this environment were not verified at scaffolding time; set them once confirmed.
- Review agents never edit files; they output findings.
- Any agent hitting a stop condition writes a "Decision needed" block to `docs/DECISIONS_NEEDED.md` and halts.
- Git rules from `AGENTS.md` apply to all agents: no commits/pushes without explicit human instruction; never touch `main`.
