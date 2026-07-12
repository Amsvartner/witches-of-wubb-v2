# WOW-032 — creative-tech-integrator handoff (startup timeout + version diagnostics)

Date: 2026-07-12
Executor: Claude Sonnet 5 (creative-tech-integrator role, unattended `/ship-feature` pipeline)
Branch: `feat/wow-032-startup-timeout` (**stacked on `feat/wow-014-crash-hardening`** — same two files, `AbletonAdapter.ts` process-exit semantics; PR base is WOW-014's branch, not `main`)
Scope: three complementary, strictly additive startup diagnostics. **Connected happy-path behavior byte-for-byte unchanged.**

## What changed — `backend/adapter/AbletonAdapter.ts`

1. **Bounded connection timeout.** `ableton.start()` → `ableton.start(ABLETON_START_TIMEOUT_MS)` (default 45000ms, `.env`-overridable via `ABLETON_START_TIMEOUT_MS`). `ableton-js`'s own `start(timeoutMs)` already rejects with a "Connection timed out." error past the deadline (confirmed by reading `backend/node_modules/ableton-js/index.js`'s `start` implementation and its `.d.ts` doc comment) — this PR doesn't reimplement timeout logic, just supplies the parameter and catches the rejection to attach an actionable message (the three known causes + remediation from the ticket, verbatim) before re-throwing. The re-thrown error propagates to WOW-014's existing `main().catch((err) => { Logger.error(...); process.exit(1); })` in `index.ts` — **no new exit path was added**; this ticket's error just makes the one WOW-014 already built more actionable. That's the "coordinate with WOW-014, same file, process-exit semantics" dependency note satisfied by reuse rather than a second exit mechanism.
2. **Pre-flight version cross-check** (`checkRemoteScriptVersionPreflight`, called before `ableton.start()`): reads the npm-shipped `midi-script/version.py` (resolved via `require.resolve('ableton-js/package.json')` + relative join, robust regardless of hoisting) and the installed script's `version.py` (default `~/Music/Ableton/User Library/Remote Scripts/AbletonJS/version.py`, `.env`-overridable via `ABLETON_REMOTE_SCRIPT_VERSION_PATH`). Warns on mismatch naming both versions; **info-level, non-fatal** if either file is missing (a missing installed script just means "not installed yet," per the ticket).
3. **Post-connect exact-version log** (`logConnectedRemoteScriptVersion`, called immediately after a successful `ableton.start()`): calls `ableton.internal.get('version')` (confirmed via `ableton-js/ns/internal.d.ts` — `Internal.get('version'): Promise<string>`, the live remote script's actual running version) and logs it against the npm-shipped version at info level, warning on any inequality. Deliberately does **not** reuse `ableton-js`'s own `Internal.isPluginUpToDate()` — that helper only warns when the plugin is _older_ than the npm package (one-directional `semver.lt` check) and, more importantly, never runs at all in the observed failure mode (the handshake itself is what's broken, so a successful connection was never reached to call it from). This check logs unconditionally, in both directions, exactly matching the ticket's "log both versions... warning on any inequality." Wrapped in try/catch — a failure here is diagnostic-only and must not crash an otherwise-successful connection.
4. **New pure function**: `parseRemoteScriptVersion(filePath): string | undefined` — reads a `version.py`-style file, regex-extracts `version = "X.Y.Z"` (tolerant of single/double quotes and extra whitespace), returns `undefined` (never throws) on any read/parse failure. Exported via the `AbletonAdapter` object (matching `calculateBpmFromWarpMarkers`'s existing precedent as an exported pure utility) so it's independently testable.

## Why the pure function lives inside `AbletonAdapter.ts` instead of a new `backend/util/` module

The ticket's allowed-files list names exactly two non-test source files (`AbletonAdapter.ts`, `index.ts`) and two _test_ directory options (`backend/adapter/test/**` or `backend/util/test/**`) — no new non-test source file is listed. Putting `parseRemoteScriptVersion` in a new `backend/util/VersionCheckUtil.ts` would have been outside that boundary. Before accepting the resulting testability cost, I checked whether importing `AbletonAdapter.ts` (which does `new Ableton({ logger: Logger })` at module eval) is actually safe in a test: read `ableton-js`'s `Ableton` constructor directly (`backend/node_modules/ableton-js/index.js`) and confirmed it only sets instance fields and computes `os.tmpdir()`-based file paths — no socket opens, no I/O, nothing until `.start()` is explicitly called, which no test here does. Safe to import.

## What changed — `.env`

Two new commented-out (i.e. inactive-by-default) optional vars, both with working code defaults: `ABLETON_START_TIMEOUT_MS`, `ABLETON_REMOTE_SCRIPT_VERSION_PATH`. Pre-approved per this run's "Pre-answered decisions."

## What changed — `README.md`

New "Troubleshooting: backend hangs or exits at startup" subsection under "Starting the backend," listing the three known causes and the two override vars — the human-facing mirror of the in-code actionable error message.

## What did NOT change

- `backend/index.ts` — not touched. WOW-014 already built the `main().catch()` exit path this ticket's timeout error flows through; no second exit mechanism was added.
- No change to any Ableton command, event name, payload, or timing once connected — every addition is either a file read (pre-flight, before any connection attempt) or an extra read-only RPC (`internal.get('version')`, post-connect, before `getTracksAndClips()`/`getTrackVolumes()` — adds one round-trip of latency to startup, not to any per-clip hot-path operation).
- No dependency changes — `ableton-js`'s `start(timeoutMs)` and `internal.get('version')` are both already-existing library surface, not new APIs.
- Upgrading `ableton-js` itself, auto-installing/copying the remote script, or protocol-level version negotiation — all explicitly out of scope per the ticket.

## A pre-existing bug this ticket's test surfaced (not fixed here, flagged separately)

Running the new test file triggers `AbletonAdapter.ts`'s full import chain for the first time under root-level `yarn test` (no prior test imported it). This exposed that `backend/service/MusicDatabaseService.ts:16` resolves the CSV path via `path.join(process.cwd(), '../src/assets/', 'Music Database.csv')` — correct only when `process.cwd()` is `backend/` (the real `yarn start-backend` context), and one directory too high under root-level `yarn test`. The read fails with `ENOENT`, but it's caught (existing try/catch, logs and continues) so no test fails — `rfidToClipMap`/`clipNameToInfoMap` just end up silently empty in that code path. Pre-existing, not introduced or worsened by this PR, not in this ticket's allowed-files list to fix. Filed as a separate follow-up task rather than fixed here.

## Verification performed (agent-side, non-hardware)

- `npx tsc --noEmit -p backend/tsconfig.json` — clean.
- `yarn lint` — clean.
- `yarn test` — 75/75 passed (68 pre-existing + 7 new: `parseRemoteScriptVersion` against double-quoted, single-quoted, extra-whitespace, missing-file, no-version-line, empty-file fixtures, and a regression check against the real installed `ableton-js/midi-script/version.py`).
- `yarn build` — clean, 160 modules.
- `git diff feat/wow-014-crash-hardening --stat` — confirms exactly `.env`, `README.md`, `backend/adapter/AbletonAdapter.ts` changed, plus the new test file — all within WOW-032's allowed-files list.
- **No agent ran `yarn start-backend`** — same non-negotiable rule as every other backend ticket in this run. The timeout path (acceptance criterion: "with no Ableton running, `yarn start-backend` exits within the timeout with the actionable error instead of hanging") is a human verification step.

## How to verify (human demo steps)

1. **Timeout path** (no Ableton needed — this is the scenario): with Live not running, `yarn start-backend`. Before this PR: hangs indefinitely at "Checking connection...". After: exits within `ABLETON_START_TIMEOUT_MS` (default 45s) with an error naming the three causes and the remediation steps.
2. **Version-mismatch pre-flight warning**: temporarily edit the installed remote script's `version.py` (or point `ABLETON_REMOTE_SCRIPT_VERSION_PATH` at a fixture file with a different version string) and start the backend — expect a warning naming both versions logged before any connection attempt.
3. **Healthy startup**: with Live running and the AbletonJS control surface enabled, `yarn start-backend` — expect an info-level "AbletonJS remote-script version OK" pre-flight line and, after connecting, an info-level "Connected to AbletonJS remote script version ... (npm package ...)" line. Confirm musical/UI behavior is otherwise identical to before this PR (unchanged clip triggering, tempo, volume — this PR touches nothing in that path).
