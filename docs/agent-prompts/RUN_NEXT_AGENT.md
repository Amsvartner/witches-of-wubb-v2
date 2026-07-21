# RUN_NEXT_AGENT — reusable agent runner instruction

Paste this to start an agent session without copying a full prompt:

```text
Read docs/agent-prompts/RUN_NEXT_AGENT.md and follow it as <AGENT PROFILE>.
```

Replace `<AGENT PROFILE>` with a roster name from `.claude/agents/README.md` (e.g. `frontend-implementer`, `reviewer`, `test-engineer`).

## Protocol

Before acting, read:

1. `/AGENTS.md` (binding contract)
2. Your profile: `.claude/agents/<agent-profile>.md`
3. `docs/IMPLEMENTATION_PLAN.md` (current stage) and `docs/TICKETS_001_INITIAL.md` (or newest tickets file)
4. `docs/DECISIONS_NEEDED.md` (don't work on blocked items)

Then take the first unblocked ticket matching your role (or the ticket the human named). If a per-ticket prompt file exists (`docs/agent-prompts/wow-XXX-<role>-prompts.md`), it overrides this default flow — execute its newest prompt.

## Output rules

- Write your output note to `docs/agent-notes/wow-XXX-<role>-<topic>.md`.
- Use the standard handoff format from `AGENTS.md`, including the human-verifiable demo requirement for implementation work.
- Reviewers: end with an explicit verdict (approve / approve-with-nits / block).

## Safety and scope

- Full-product phase (ADR-007, gates relaxed 2026-07-21). `backend/`, `sim/`, `Music Database.csv`, and `Arduino/` are editable per your ticket's "Allowed files" (a human still flashes firmware; the Live set is edited by a human per spec). Socket-contract changes ship with doc + `sim/` parity in the same PR.
- Allowed commands: `yarn dev`, `yarn test`, `yarn lint`, simulator scripts; `yarn start-backend` / live-connection scripts when the ticket calls for it (care while a real installation is live).
- Do not merge, do not push to `main`, do not commit without explicit human instruction.
- Stop and ask (via `docs/DECISIONS_NEEDED.md`) before: new dependencies, raising volume/brightness ceilings or strobe-like behavior, anything ambiguous in product scope.
