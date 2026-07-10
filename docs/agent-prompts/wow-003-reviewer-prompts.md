# WOW-003 — reviewer prompts

Ticket: WOW-003 — Build offline simulator (mock backend) — ADR-001
Role profile: `.claude/agents/reviewer.md` (read first, plus `AGENTS.md` in full). Read-only — no code edits.

## Prompt 1 — review the simulator diff

Goal:

Strict diff review of the WOW-003 branch/PR: contract fidelity against `backend/events/`, safety (no path to hardware/OSC), scope discipline, and test adequacy. End with an explicit verdict.

Context files:

- `AGENTS.md` — guardrails, PR-template requirement, fork rules
- `docs/adr/001-offline-simulator-mock-backend.md` — the structure being enforced (`sim/core` transport-free; `sim/server.ts` thin wrapper; port 3335)
- `docs/TICKETS_001_INITIAL.md` — WOW-003 acceptance criteria and out-of-scope list
- `backend/events/incoming-events.ts`, `backend/events/outgoing-events.ts`, `backend/types.ts`, `backend/ableton-api.ts` — ground truth for the contract
- `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md` and `docs/agent-notes/wow-003-test-engineer-sim-tests.md` — handoffs, incl. contract-fidelity table
- The full branch diff vs. `main`

Allowed files:

- `docs/agent-notes/wow-003-reviewer-verdict.md` — verdict note (only file you may write)

Disallowed files:

- Everything else. Reviewer never edits code, tests, or configs.

Acceptance criteria to verify (verbatim from ticket):

- `yarn dev` + simulator drives the current UI end-to-frontend; all events logged; zero imports of ableton-js/node-osc; `sim/core` has no socket.io imports and is exercised directly by vitest; contract documented deltas = none.

Review checklist (ticket-specific):

1. **Safety (blocking):** no import path from `sim/**` to `ableton-js`, `node-osc`, or `backend/` runtime modules; no OSC/MIDI/serial or outbound network capability (a listening socket on port 3335 is the only network surface); `backend/`, `Arduino/`, `Music Database.csv` untouched (`git diff --stat` on those paths must be empty; CSV consumed read-only). Binding to localhost only is the preferred default — a non-localhost bind (e.g. `0.0.0.0` for CI/devcontainers) is a **should-fix** to raise with rationale, not an automatic block (ADR-001 fixes the port, not the interface).
2. **ADR-001 structure:** all logic in `sim/core/` with zero socket.io imports; `sim/server.ts` is only transport glue; vitest exercises `sim/core` directly.
3. **Contract fidelity, event by event:** names, ack-vs-no-ack (`set_track_volume` and `set_master-key` have no callback in the real backend), payload shapes (`BrowserClipInfoList` of length 4 with `null` slots; `TagDetectionData`; `ingredient_detected`/`ingredient_removed` metadata incl. `pillar`/`requestAddress`; bare `timeout_warning`). Any delta must be documented as a delta — "documented deltas = none" is the target; an undocumented delta is blocking.
4. **Scope:** no `src/**` app changes, no new dependencies, no new/renamed events, package.json touched only for the sim script, no drive-by refactors.
5. **One object per pillar** semantics match the real backend's observable behavior.
6. **Scenarios & logging:** scenarios use real CSV rows; every received/emitted event logged.
7. **Tests & checks:** `yarn lint` / `yarn test` / `yarn build` green on the branch; test coverage matches the test-engineer note; no test opens real sockets to nowhere.
8. **Docs & PR hygiene:** README sim section present; yarn script documented; handoff notes complete with a human-verifiable demo (no live hardware needed); PR body fills the template completely and targets the fork (`Amsvartner/witches-of-wubb-v2`), never upstream.

Required tests/checks (safe to run):

- `yarn lint`, `yarn test`, `yarn build`, `git diff --check`. You may run `yarn dev` + the sim script to verify the demo steps. Never `yarn start-backend`.

Stop conditions:

- Any blocking-safety finding → verdict **block**, cite file/line.
- Contract question unanswerable from `backend/events/` reading → flag as Decision needed rather than guessing.

Output:

- `docs/agent-notes/wow-003-reviewer-verdict.md`: findings grouped blocking / should-fix / nit, each with file:line and rationale; explicit final verdict — **approve / approve-with-nits / block**.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, verdict, note path._

- 2026-07-10 — executor: Claude Fable 5 (reviewer subagent, /ship-feature pipeline) — branch `feat/wow-003-offline-simulator`, PR https://github.com/Amsvartner/witches-of-wubb-v2/pull/3 — first pass @ `0ed5360`: **approve-with-nits** (1 should-fix: undocumented missing-clip approximation; 4 nits). Fix round `7765add` (docs the approximation, localhost-only CORS, transformHeader colon-strip parity; vite-node nit rationalized). Re-review @ `7765add`: **approve**. Note: `docs/agent-notes/wow-003-reviewer-verdict.md`.
