# Architecture

Status: **observed** — documented from code reading on 2026-07-09.

> **Scope note (ADR-007, 2026-07-21):** work covers the **full product** — UI, backend, and simulator (ADR-004's frontend-only phase is superseded). The socket.io event contract remains the architectural boundary the UI codes against, now fully ticket-managed rather than frozen: contract changes (additions, renames, removals) ship with doc + simulator parity in the same change (ADR-001/ADR-007 amendment). The Live set itself is still edited by a human per spec; musical-assumption changes are made in-ticket and documented in `docs/ABLETON_INTEGRATION.md` in the same PR (relaxation 2026-07-21, `AGENTS.md` v0.7). The offline simulator (ADR-001) is still the agent-side stand-in for the backend during development.

## Observed architecture

```
 M5Stack RFID readers (x4, Arduino)          Art-Net LED nodes (Arduino + FastLED)
   | OSC /new/tag, /departed/tag                     ^ Art-Net (DMX over WiFi)
   v  (WiFi "wubb-net", UDP :9000)                   |
 +---------------- backend (Node/ts-node) ----------------+     +------------------+
 | index.ts: OSC server :9000, socket.io server :3335     | OSC | Lighting server  |
 | AbletonAdapter.ts: clip queueing, key lock, transposition|---->| (EXTERNAL, :9001)|
 |   phrase leader, timeout/attractor state               |     +------------------+
 | event/: incoming (OSC+WS), outgoing (WS+OSC dispatch)  |
 | adapter/: Ableton (ableton-js), lighting OSC client    |
 | service/: music DB, phrase leader, key transposition   |
 | util/: CSV parse, logger (pino)                        |
 +---------+--------------------------+------------------+
           | ableton-js (local socket) | socket.io :3335
           v                          v
     Ableton Live set          React UI (Vite :5173)
     (4 tracks = 4 pillars)    src/: contexts, components, hooks
```

### Repo layout

- `src/` — React 18 + TS frontend (Vite, Tailwind). Contexts (`src/context/`: `SocketProvider`, `AbletonProvider`), screen `MainScreen`, containers (`src/container/`: CurrentlyPlayingList, RecipeBox, KeyAdjuster, TempoSlider, VolumeSlider, DebugModal), component `ClipButton`, hook `useGrimoire`.
- `backend/` — Node/TS (ts-node + nodemon). Own package.json/lockfile; installed via root `postinstall`.
- `Arduino/` — firmware for RFID readers (OSC sender) and LED nodes (Art-Net receiver). Deployed to hardware; contains committed WiFi credentials.
- Tests are colocated in `test/` folders (`src/screen/test/`, `sim/test/`); shared vitest setup in `src/test/setup-tests.ts`.
- `src/assets/Music Database.csv` — the RFID→clip mapping (production data; read by the **backend** at startup via relative path, and imported by the frontend via `src/util/ClipDatabaseUtil.ts`).

### Runtime components

1. **RFID flow:** reader detects tag → OSC `/new/tag [rfid]` → backend maps sender IP → pillar index (hardcoded map 192.168.0.101–104 in `backend/event/IncomingEvents.ts`) → CSV lookup → `AbletonAdapter.queueClip` → Ableton clip fires quantized. `/departed/tag` stops/dequeues. The debug UI can simulate both events over websocket.
2. **Ableton integration:** `ableton-js` controls a live Ableton set. 4 tracks ≈ 4 pillars. Clip lookup by name match against CSV `Clip Name`. Trigger order `Drums→Melody→Bass→Vox`; key-leader order reversed. Key lock transposes clips to a master key via `backend/service/KeyTranspositionService.ts` (Camelot-style keys, e.g. `4A`). Warp markers/loop handling in `backend/adapter/AbletonAdapter.ts`.
3. **LED flow:** backend emits every event as OSC to an external lighting server (`/:pillar/:eventName`), which presumably renders and sends Art-Net to the LED nodes. The lighting server is **not in this repo** — TBD.
4. **UI:** socket.io client; requests state (`get_playing_clips`, `get_tempo`, volumes, key lock, master key) and receives pushed events (`ingredient_detected`, `ingredient_removed`, `timeout_warning`, …).
5. **Attractor/timeout:** 3-minute inactivity → stop all clips, reset master key; warning event 30s prior. Attractor clip name constant: `Wicked Casting`.

### Data/config model

See `DATA_MODEL.md`. Config via root `.env` (ports, lighting server address).

### Development/test/simulation model

- `yarn dev` runs the UI alone (functions with no backend? — TBD, likely degraded).
- `yarn start-backend` **requires a live Ableton and sends OSC to the lighting address** — not safe as a casual dev command.
- Debug modal simulates tag events, but only through the real backend → real Ableton. **There is no offline simulator.** This is the biggest gap for safe agent-assisted development.
- Tests: vitest + testing-library; one smoke test.

## Unknown architecture (TBD)

- Lighting server internals, Art-Net universe mapping, LED design intent
- How/where the UI is displayed in the installation; touch or not
- Show machine OS and process supervision (nodemon in production?)
- Whether frontend's direct import of `backend/type/` and of the CSV is intentional coupling
- Error/reconnect behavior when Ableton or readers drop
- Multiple simultaneous objects per pillar: supported or one-at-a-time? (code suggests one clip slot per pillar via index — unverified)

## Simulation mode — decided

**Resolved 2026-07-09 (ADR-001):** a standalone mock socket.io backend (option 1) will be built before/alongside the UI rework. The real backend is not modified. Location/port TBD (DECISIONS_NEEDED).
