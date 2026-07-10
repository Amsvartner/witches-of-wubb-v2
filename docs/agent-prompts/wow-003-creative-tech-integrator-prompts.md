# WOW-003 — creative-tech-integrator prompts

Ticket: WOW-003 — Build offline simulator (mock backend) — ADR-001
Role profile: `.claude/agents/creative-tech-integrator.md` (read first, plus `AGENTS.md` in full)

## Prompt 1 — implement the simulator

Goal:

Build the standalone offline simulator per ADR-001 (amended): `sim/core/` (plain TypeScript — fake state, contract handlers, scripted-scenario engine; no socket.io imports) plus `sim/server.ts` (thin socket.io wrapper on port 3335), so the UI can be developed and demoed with no Ableton, hardware, or real backend.

Context files:

- `AGENTS.md` — binding contract (safety rules, git rules, handoff format)
- `docs/adr/001-offline-simulator-mock-backend.md` — the decision this implements, including the shared-core amendment
- `docs/TICKETS_001_INITIAL.md` — WOW-003 definition
- `docs/ARCHITECTURE.md`, `docs/CODING_GUIDELINES.md`, `docs/TECH_STACK.md`
- `backend/events/incoming-events.ts` — authoritative incoming contract (event names, ack-callback signatures, payload shapes)
- `backend/events/outgoing-events.ts`, `backend/ableton-api.ts` — authoritative outgoing events (`ingredient_detected`, `ingredient_removed`, `timeout_warning`) and timeout behavior
- `backend/types.ts` — payload types (`BrowserClipInfo`, `TagDetectionData`, `SetTrackVolumeInputType`, `TrackVolumesType`, `ClipTypes`)
- `src/lib/database-output.ts` + `backend/utils/parse-csv.ts` — how CSV rows become clip metadata (reuse the pattern; CSV stays read-only)

Allowed files:

- `sim/**` (new)
- `package.json` — add the simulator yarn script only (no dependency changes)
- `README.md` — simulator usage section
- `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md` — handoff note

Disallowed files:

- `backend/**`, `Arduino/**`, `src/assets/Music Database.csv` (read-only reference)
- `src/**` app code — the frontend must work against the simulator unchanged
- Any dependency additions/upgrades **except** the one pre-approved for this ticket: the human approved (2026-07-10, PR #2 review round) adding `socket.io@^4.6.x` as a **devDependency** for `sim/server.ts` — the root `package.json` has only `socket.io-client@^4.6.1` and the server package is not installed. Add exactly that package, nothing else; any further dependency need is a stop-and-ask.

Acceptance criteria (verbatim from ticket):

- `yarn dev` + simulator drives the current UI end-to-frontend; all events logged; zero imports of ableton-js/node-osc; `sim/core` has no socket.io imports and is exercised directly by vitest; contract documented deltas = none.

Ticket-specific guidance:

- Location and port are decided (ADR-001): `sim/`, port 3335 — the frontend needs no config change.
- Implement the full observed contract:
  - Ack-style requests (respond via the ack callback): `get_playing_clips`, `get_queued_clips`, `get_tempo`, `set_tempo`, `get_track_volumes`, `get_keylock_state`, `set_keylock_state`, `get_master-key`. Match the real callback payloads: `BrowserClipInfoList` (array of 4, `null` for empty pillars), tempo number, `TrackVolumesType` number array, keylock boolean, master-key string.
  - Fire-and-forget requests (the real backend registers **no** ack callback — do not add one): `set_track_volume` (`SetTrackVolumeInputType`), `set_master-key` (string).
  - Incoming tag events over websocket: `/new/tag` and `/departed/tag` with `TagDetectionData` (`{ rfid, pillar }`).
  - Emitted events: `ingredient_detected` (clip metadata + `rfid`, `pillar`, `requestAddress`), `ingredient_removed` (clip metadata + `pillar`, `requestAddress`), `timeout_warning` (no payload).
- One object per pillar: a `/new/tag` on an occupied pillar replaces per real-backend semantics — check `QueueClip`/`StopOrRemoveClipFromQueue` behavior in `backend/ableton-api.ts` and mirror the observable browser-facing result only.
- Scripted scenarios must use real rows from `Music Database.csv` (read-only) — reuse the existing parse pattern rather than inventing metadata.
- Log every received and emitted event to stdout.
- Add a yarn script (e.g. `yarn sim`) and a README section: how to start it, available scenarios, how to demo with `yarn dev`.

Forbidden scope:

- No changes to frontend components, contexts, or hooks.
- No new/renamed socket events, no contract "improvements" — fidelity to `backend/events/` is the whole point; any observed delta is a finding, not a fix.
- No OSC, MIDI, serial, or network access other than listening on localhost:3335. Zero import paths to `ableton-js` or `node-osc`.

Required tests/checks:

- vitest unit tests importing `sim/core` directly (fake state transitions + scenario engine) — coordinate with the test-engineer prompt; at minimum ship enough tests to prove `sim/core` is importable and exercised by vitest.
- `yarn lint`, `yarn test`, `yarn build` all green.
- `git diff --check`.

Hardware/audio/LED/RFID safety notes:

- The simulator must be **incapable** of emitting OSC or contacting the real backend/hardware — enforced by having no such imports, not by config flags.
- Never run `yarn start-backend`.
- CSV is read-only.

Human-verifiable demo (required in handoff note):

- Exact steps: `yarn sim` (scenario X) + `yarn dev`, then what to observe in the UI (e.g. ingredient appears on pillar 2 with category color, tempo slider round-trips, timeout warning appears). Simulator data only — never live hardware/Ableton.

Stop conditions:

- Contract ambiguity that can't be resolved from reading `backend/events/` (and the types/ableton-api it references) → record a "Decision needed" in `docs/DECISIONS_NEEDED.md` and stop.
- A needed package is not already installed → stop and ask.
- Any test or tool attempts network/Ableton access → stop.

Output:

- Handoff note at `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md` using the standard handoff format from `AGENTS.md`, including the demo steps and a contract-fidelity table (event → source file/line → simulator behavior → delta, expected "none").

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, outcome, note path._
