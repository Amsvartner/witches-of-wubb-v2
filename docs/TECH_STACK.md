# Tech stack

> Scope note (ADR-004): backend and Arduino stacks are reference-only this phase; active work uses the frontend stack plus a simulator built on the already-present socket.io.

## Observed stack (from package files and code)

**Frontend (root `package.json`):** React 18.2, TypeScript 5.0.4, Vite 4, Tailwind CSS 3.2 (+ @headlessui/react 1.7, @headlessui/tailwindcss), classnames, socket.io-client 4.6, js-logger, custom font Fondamento. Testing: vitest 0.28, @testing-library/react 14, jsdom, coverage-c8. Tooling: ESLint 8 (+ react, react-hooks, jsx-a11y, import, prettier plugins), Prettier 2.8, husky 8 + lint-staged. Node 21+ per README, yarn classic.

**Backend (`backend/package.json`):** ts-node + nodemon, ableton-js 3.1.5, node-osc 8, socket.io 4.6, papaparse 5.4, pino 8 (+ pino-pretty), dotenv, lodash.memoize/throttle, TypeScript 5.0.2.

**Firmware (`Arduino/`):** Arduino C++; M5Stack UHF RFID unit, OSCMessage, WiFi/WiFiUDP; ArtnetWifi + FastLED (WS2812, 144 LEDs).

Notes: root `package.json` puts dev tooling under `dependencies` (no `devDependencies` split). Frontend imports `backend/type/` directly. TS versions differ slightly between root and backend.

## Approved stack

Everything in "Observed stack" is approved for continued use as-is. No formal approval exists beyond "it is what production runs".

## Unknown / unconfirmed

- Lighting server stack (external, not in repo) — TBD
- Show machine OS/runtime — README covers both macOS and Windows — TBD
- Whether Vite 4 / vitest 0.28 / React 18 should be upgraded as part of "modernizing" — Decision needed

## Do not change without human approval

- `ableton-js` version (tightly coupled to Ableton Live version in use)
- `node-osc`, socket.io versions and any port/protocol/event-name contracts
- Arduino sketches and their libraries
- Node/yarn versions assumed by the show machine
- `Music Database.csv` schema

## Dependency modernization mandate (F1, 2026-07-09)

Frontend/tooling libs **may and should be updated**, security-flagged ones first. Constraints: nothing Ableton-related (backend untouched); `socket.io-client` must remain wire-compatible with the backend's socket.io 4.6. Audit-then-grouped-upgrades via ticket WOW-009.

## Pre-approved dependencies (add only when the ticket needs them)

- ~~`react-router`~~ — was approved in chat 2026-07-09, then superseded by **ADR-005: routing is hand-rolled** (simple state / `location.hash`). Do not add a router.

## Potential dependency — human approval required

(add entries here instead of installing)
