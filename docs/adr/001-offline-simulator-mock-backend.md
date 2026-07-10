# 001. Offline simulator as standalone mock backend with shared core module

Date: 2026-07-09
Status: accepted (amended 2026-07-09: shared-module structure added after revisiting; amendment proposed 2026-07-10: hardware-sim tier — pending human approval)

## Context

UI development previously required `yarn start-backend`, which connects to a live Ableton set and emits OSC to the lighting server — unsafe and impractical for agent-assisted frontend work. Options considered:

1. **Standalone mock socket.io backend** — separate process implementing the event contract with fake in-memory state and scripted scenarios. Real websocket transport (exercises reconnect/disconnect for real, works headless/CI, no frontend changes), but a second implementation of the contract that can drift from the real backend.
2. **Env-flag stubbing in the real backend** — one implementation, zero drift, but requires modifying `backend/` (read-only this phase, ADR-004), is invasive (`ableton-api.ts` is tightly wound around live Ableton objects), and a guard bug could emit OSC toward real hardware.
3. **In-browser mock** — fake socket client injected in `socketio-provider.tsx`; nothing extra to run and trivially reusable in vitest, but no real network (reconnect behavior faked) and sim logic bleeds into the app bundle.
4. **No simulator** — every visual check would need live Ableton; contradicts the DoD.

## Decision

Option 1, structured to also capture option 3's test-reuse benefit:

- **`sim/core/`** — plain TypeScript module holding all simulator logic: fake state (tempo, volumes, key lock, 4 pillar slots — one object per pillar), event-contract handlers, and the scripted-scenario engine using real rows from `Music Database.csv` (read-only). No socket.io imports; fully unit-testable and importable by vitest.
- **`sim/server.ts`** — thin socket.io server wrapper binding the core module to port 3335 (frontend needs no config change).
- No import path to `ableton-js` or `node-osc`; the simulator must be incapable of emitting OSC or contacting hardware/backend.

Chosen over option 2 because the backend is out of scope/read-only this phase (ADR-004); revisit option 2 if backend work reopens.

## Consequences

- UI tickets are developed and demoed against the simulator; DoD is "correct API calls sent" (verified against simulator + tests importing `sim/core`).
- Frontend unit tests can drive `sim/core` directly instead of hand-rolled socket mocks, so dev sim and tests share one contract implementation.
- Drift risk vs. the real backend remains; reviewer checks contract fidelity (event names/shapes per ARCHITECTURE.md) on every sim or socket-adjacent diff.
- One extra dev process (`sim/server.ts`) alongside `yarn dev`.

## Amendment (proposed 2026-07-10): hardware-sim tier — real Ableton, simulated tags

Status: **proposed, pending human approval** (see WOW-010 in `docs/TICKETS_001_INITIAL.md`).

### Context

The mock backend approximates exactly the behaviors only a live Ableton set can produce: quantized `clip_started` timing, phrase-leader/loop-end queue triggering, transposition/key-lock, warp-marker BPM. The real backend already accepts simulated hardware: `/new/tag` and `/departed/tag` have first-class **websocket** handlers (`backend/events/incoming-events.ts:42-65`, used today by the hidden debug panel), with the pillar index mapped back through the pillar-IP table. Only tooling, documentation, and guardrails are missing.

### Decision (proposed)

Define two simulation tiers:

- **Tier 1 — mock everything** (existing `yarn sim`): mock socket.io backend, no Ableton, no hardware. The only tier agents and CI may run. Unchanged.
- **Tier 2 — hardware-sim** (new, human-run only): the human runs `yarn start-backend` with a **local** Ableton set; a new thin scenario client `sim/tag-client.ts` (`yarn sim:tags <scenario>`) connects to the real backend on `localhost:3335` as a socket.io client and replays the existing `sim/core` scenario scripts by emitting `/new/tag`/`/departed/tag`. Zero backend changes (ADR-004 holds); the scenario engine, CSV row selection, and scripts are reused unchanged.

### Safety rules for tier 2 (non-negotiable)

- `yarn start-backend` remains a live-hardware command: **agents never run it**; `yarn sim:tags` is inert without it and is itself safe to run (it only emits tag events to localhost:3335).
- Tier 2 sessions use a local Ableton set on a dev machine — never the installation machine; real volume is in play (`SetTrackVolume(pillar, 0.6)` on clip start).
- Precondition: `.env` `LIGHTING_SERVER_ADDRESS` must point at localhost — the backend emits OSC to it unconditionally on every event (`backend/events/outgoing-events.ts:7`).
- Known exposure to note in the runbook: the backend's OSC server binds `0.0.0.0:9000` (`backend/index.ts`), so the dev machine is reachable on its LAN while tier 2 runs.

### Scope carve-out

`sim/tag-client.ts` is a deliberate, file-scoped exception to "the simulator must be incapable of contacting the real backend": it may import socket.io-client and connect to `localhost:3335` **only**. `sim/core/` stays transport-free and backend-incapable; the import-guard test gets a matching carve-out for the client file alone (socket.io-client permitted there; `ableton-js`/`node-osc`/`backend/` imports remain forbidden everywhere in `sim/**`).

### Consequences

- The mock's fidelity table becomes verifiable: tier 2 is the reference for checking tier 1's documented approximations against real Ableton behavior.
- Tier 2 does not replace tier 1 — CI, vitest, and agent-driven UI work still require the mock (no Ableton available there).
- Documentation cost: README gains a tier-2 runbook with the preconditions above.
