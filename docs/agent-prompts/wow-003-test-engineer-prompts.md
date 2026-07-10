# WOW-003 — test-engineer prompts

Ticket: WOW-003 — Build offline simulator (mock backend) — ADR-001
Role profile: `.claude/agents/test-engineer.md` (read first, plus `AGENTS.md` in full)

## Prompt 1 — test the simulator core

Goal:

Design and implement vitest coverage that exercises `sim/core` directly (no socket transport), proving the fake state, contract handlers, and scenario engine behave per the observed backend contract — and review the implementer's test strategy for gaps.

Context files:

- `AGENTS.md` — binding contract
- `docs/adr/001-offline-simulator-mock-backend.md` — why `sim/core` must be transport-free and vitest-importable
- `docs/TICKETS_001_INITIAL.md` — WOW-003 definition
- `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md` — implementer handoff (contract-fidelity table)
- `backend/events/incoming-events.ts`, `backend/types.ts`, `backend/ableton-api.ts` — the contract being simulated (expected payload shapes and semantics)
- `spec/App.spec.tsx`, `vite.config.ts` — existing vitest setup (jsdom, verbose reporter) and conventions
- `docs/CODING_GUIDELINES.md`

Allowed files:

- `spec/**` and/or `sim/**` test files (follow the repo's existing test-location convention; if the implementer already placed tests, extend rather than relocate)
- `docs/agent-notes/wow-003-test-engineer-sim-tests.md` — handoff note

Disallowed files:

- `sim/core` production logic beyond what a failing test legitimately exposes — report defects to the pipeline, don't silently fix design issues
- `backend/**`, `Arduino/**`, `src/assets/Music Database.csv` (read-only)
- `src/**` app code
- Dependency changes of any kind

Acceptance criteria (verbatim from ticket):

- `yarn dev` + simulator drives the current UI end-to-frontend; all events logged; zero imports of ableton-js/node-osc; `sim/core` has no socket.io imports and is exercised directly by vitest; contract documented deltas = none.

Ticket-specific guidance — minimum coverage:

- State: initial state (4 pillars, all empty/`null`), tempo get/set round-trip, per-pillar volume get/set, keylock get/set, master-key get/set.
- Tag flow: `/new/tag` with a known CSV rfid → `ingredient_detected` payload shape (clip metadata + `rfid`, `pillar`, `requestAddress`) and pillar occupied; `/departed/tag` → `ingredient_removed` and pillar cleared; unknown rfid → no event, no crash; one-object-per-pillar replacement semantics.
- Playing/queued clip queries return `BrowserClipInfoList`-shaped arrays (length 4, `null` for empty slots, no `clip` object).
- Scenario engine: a scripted scenario steps through its events deterministically (use fake timers if it is time-driven).
- Guards: assert (e.g. via import-graph test or grep-style check) that `sim/core` imports neither `socket.io` nor `ableton-js`/`node-osc`.

Required tests/checks:

- `yarn test` and `yarn lint` green; tests are jsdom/node-local only.
- Confirm tests import `sim/core` directly — any test needing a live socket server is a design smell to report.

Hardware/audio/LED/RFID safety notes:

- Never run `yarn start-backend`. Tests must not open network connections or touch hardware. CSV read-only.

Stop conditions:

- Tests would require contacting Ableton, hardware, or the network → stop.
- `sim/core` turns out not to be importable without socket.io (contract with ADR-001 broken) → report as a blocking finding, don't restructure it yourself.
- Expected behavior underdetermined by `backend/events/` reading → record "Decision needed", stop.

Output:

- Handoff note at `docs/agent-notes/wow-003-test-engineer-sim-tests.md`: coverage map (behavior → test), gaps left open and why, defects found, safe validation run.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, outcome, note path._

- 2026-07-10 — executor: Claude Fable 5 (test-engineer subagent, /ship-feature pipeline) — branch `feat/wow-003-offline-simulator`, reviewed head `e59a13f`, tests committed at `9be53da624a9db310c98879e38de8e4a8c6cb8b1` — outcome: **approve**; 0 defects; 8 coverage-gap tests added (48 total, all green); lint green. Note: `docs/agent-notes/wow-003-test-engineer-sim-tests.md`.
