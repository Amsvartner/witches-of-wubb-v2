# Witches of wubb

## Documentation

Project docs live in [`docs/`](docs/). Start with the [project brief](docs/PROJECT_BRIEF.md) and [architecture](docs/ARCHITECTURE.md). AI agents must read [`AGENTS.md`](AGENTS.md) first; agent profiles live in [`.claude/agents/`](.claude/agents/README.md) and pipeline skills in `.claude/skills/`. Open questions for humans are tracked in [decisions needed](docs/DECISIONS_NEEDED.md); current work in [tickets](docs/TICKETS_001_INITIAL.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md).

⚠️ `yarn start-backend` connects to Ableton Live and the lighting server — see safety rules in `AGENTS.md` before running anything.

## Setup

You should have `node` 22 (LTS — see `.nvmrc`/`engines` in `package.json`) installed as well as `yarn` installed. See [yarnpkg.com](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable) for install options.

You'll need to make sure that `ableton-js` is installed. You can find the installation steps here: [leolabs/ableton-js](https://github.com/leolabs/ableton-js#prerequisites).

### Install dependencies

```bash
yarn install
```

### On Windows

```
npm install --global yarn
npm install -g nodemon
```

run powershell as admin

```
Set-ExecutionPolicy RemoteSigned
```

### Run project

This project consists of a backend and frontend that you'll need to start independently. Both feature hot-reloading when files have changed, so you don't need to do anything special during development.

#### 🚨 Check the `.env` for port/address conflicts

This package assumes that your lighting server is `127.0.0.1`. If that's not the case, you'll want to change that in the [.env](https://github.com/jonathan3692bf/witches-of-wubb/blob/main/.env) file.

You can also change the port of the `socket.io` server via `WS_SERVER_PORT` and the exposed port of the `osc` server (for RFID events) via `OSC_SERVER_PORT`.

#### Starting the backend

Once `ableton-js` is installed, run:

```bash
yarn start-backend
```

At which point you will have:

- an OSC server listening on port `9000`, or whatever you've assigned to `OSC_SERVER_PORT`
- a Websocket server listening on port `3335`, or whatever you've assigned to `WS_SERVER_PORT`
- a process listening to the socket exposed by `ableton-js`

##### Troubleshooting: backend hangs or exits at startup

`yarn start-backend` connects to Ableton Live via the `ableton-js` remote script. If it doesn't connect within `ABLETON_START_TIMEOUT_MS` (default 45s), it logs an actionable error and exits instead of hanging forever. Common causes, in order of likelihood:

1. **Live isn't running.** Start Live with your set open.
2. **The AbletonJS control surface isn't enabled.** In Live: Preferences → Link/Tempo/MIDI → Control Surface, select AbletonJS.
3. **The installed remote-script version doesn't match this npm package.** The backend logs a warning naming both versions at startup if they differ (or if it can't find the installed one — see `ABLETON_REMOTE_SCRIPT_VERSION_PATH` below). To fix: copy `backend/node_modules/ableton-js/midi-script/` into Live's Remote Scripts folder as `AbletonJS`, then restart Live.
4. **macOS purged the port file while Live kept running.** The remote script writes `$TMPDIR/ableton-js-server.port` once, at Live startup; macOS periodically cleans old files out of the per-user temp dir, so a Live instance left running for days loses it while the script itself stays alive. The backend then hangs at `Client is bound and listening` until the timeout. Fix without restarting Live:

   ```bash
   yarn fix-ableton-port
   ```

   This finds the remote script's UDP socket in the running Live process and rewrites the file (see `scripts/restore-ableton-port-file.sh`). Then start the backend again. Restarting Live also fixes it, since Live rewrites the file on startup.

Two optional `.env` overrides (both have working defaults — see `.env`):

- `ABLETON_START_TIMEOUT_MS` — how long to wait for Live before giving up.
- `ABLETON_REMOTE_SCRIPT_VERSION_PATH` — where to look for the installed remote script's `version.py`, if it's not at the default macOS path.

#### Offline simulator (no Ableton/hardware needed)

For UI development you don't need the real backend at all: the offline simulator ([ADR-001](docs/adr/001-offline-simulator-mock-backend.md)) implements the same socket.io contract on the same port (`3335`) with fake state and scripted scenarios built from real `Music Database.csv` rows. It cannot reach Ableton, OSC, or hardware — its only network surface is a listening socket on `localhost:3335`.

```bash
yarn sim [scenario]
```

Available scenarios:

- `full-spell` — drums → melody → bass → vox placed on pillars 1–4, held, then removed; loops.
- `replace-ingredient` — demonstrates one-object-per-pillar replacement (a drums object swapped mid-spell).
- `timeout` — one ingredient left alone until the idle timeout fires (`timeout_warning` after 2m30s of inactivity, clips stopped at 3m, like the real backend). Shorten the wait with `SIM_TIMEOUT_MS=20000 SIM_TIMEOUT_WARNING_MS=10000 yarn sim timeout`.
- `idle` (default) — no scripted activity; drive it manually from the UI debug panel or a socket client.

Every received and emitted event is logged to stdout. To demo: run `yarn sim full-spell` in one terminal and `yarn dev` in another, then watch ingredients appear on the pillars. The simulator core (`sim/core/`) is transport-free and exercised directly by the vitest suites in `sim/test/`.

#### Starting the Web UI

To start the web ui run:

```bash
yarn dev
```

then navigate to [http://localhost:5173](http://localhost:5173) -- or whatever the console tells you.
