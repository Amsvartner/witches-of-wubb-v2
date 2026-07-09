# 001. Offline simulator as standalone mock backend with shared core module

Date: 2026-07-09
Status: accepted (amended 2026-07-09: shared-module structure added after revisiting)

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
