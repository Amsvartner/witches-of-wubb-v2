# Decisions needed

Open questions for the human. Answered decisions live in ADRs (`docs/adr/`) and the owning docs — see "Resolved" below.

## Product / UX

- Which themed elements host the dj-mode and debug-mode gestures (wax seal, sigil, bookmark…) and what distinguishes the two gestures — designer proposes the pair, human picks (part of WOW-006 review; ADR-006 amended).
- Debug panel content beyond the confirmed baseline (API/socket-event log, versions, connection state) — e.g. log filtering, copy/export — designer proposes (part of WOW-006 review).

## Hardware / firmware

Decision needed:

- What should the LED strip on `ArtnetWifiFastLED.ino` (WOW-029) show during two distinct failure windows: (1) a **mid-show Wi-Fi disconnect** (AP reboot, signal dropout) after the node was already running normally, and (2) a **boot-time Wi-Fi connection failure** (the node powers on but never reaches the AP)?

Why this matters:

- The ticket's own safety note: "reconnect/fallback transitions must not strobe — hardware-safety-reviewer sign-off required on the chosen fallback and transition behavior (visitor-facing light)." The installation runs unattended for hours; whatever the LEDs do during an outage is visible to visitors, potentially for an extended period, and the wrong choice (rapid flashing) is a photosensitivity/safety concern, not just aesthetic.
- The reconnection _logic_ itself (detecting disconnect, retrying with backoff, resuming normal operation automatically once the AP returns) is already implemented per the ticket's own partial-landing instruction ("implement reconnection but stop before changing any visible LED behavior") — this decision blocks only the _visible_ part.

Options for the mid-show disconnect fallback state:

1. Hold last frame — LEDs freeze on whatever Art-Net last told them to show. Zero new code, but visually indistinguishable from "the node itself has crashed"; a visitor or operator can't tell "network blip, reconnecting" from "hardware failure."
2. Fade to a dim, static ambient color after a short grace period (so a sub-second blip doesn't visibly flicker the show). Clearly signals "something's different" without being alarming; requires picking a specific color/brightness and grace-period duration.
3. Blank (off) after a grace period. Simplest "clearly not normal" signal, but a fully dark pillar in a dim installation space may read as "broken" rather than "reconnecting."

Options for the boot-time failure indicator:

1. A distinct, static, low-brightness color (different from any color used in normal show operation, and different from whichever mid-show fallback is chosen) held indefinitely until connectivity succeeds — e.g. dim red.
2. No distinct LED indicator; rely solely on the (already-implemented) serial log output for diagnosis during setup/bench-testing.

Recommendation:

- Mid-show: Option 2 (fade to dim ambient after a short grace period, e.g. 3–5s) — signals a problem without alarming visitors, and gives the operator a clear, distinct-from-normal-show state to look for.
- Boot-time: Option 1 (a distinct dim color, different from the mid-show fallback) — a node that has never connected needs a diagnosable signal, and this occurs during bench-testing before the installation is live to visitors, so a more obvious color than the mid-show fallback is reasonable.
- Both are recommendations only — final color/brightness/timing values are a show-design call for whoever owns the installation's visual language (the same "designer" role referenced elsewhere in this doc for gesture/palette decisions).

Blocked until human confirms:
yes

Decision needed (WOW-030):

- Should pillar identity move from "derived from the RFID reader's source IP" to "carried explicitly in the OSC payload" (e.g. `/new/tag [rfid] [pillarId]`)? This is a **contract change** touching both `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino` and `backend/event/IncomingEvents.ts`'s OSC handler — explicitly out of scope for WOW-030 itself, which only moved the per-device IP into `secrets.h` and documented it; this entry exists so the idea isn't lost, not because it's blocking anything today.

Why this matters:

- The current design has one structural fragility WOW-030 documents but doesn't remove: pillar identity is inferred entirely from which static IP a UDP packet arrives from. If a device is flashed with the wrong `PILLAR_IP`, physically swapped between pillars without reflashing, or a device's IP is ever misconfigured post-deployment, the backend silently can't place that device's tags (once WOW-017 lands, this will be logged as an unknown-IP warning — today it's swallowed by a generic catch-and-log with no IP or unknown-pillar framing), and either way nothing is surfaced visibly to an operator mid-show. Carrying the pillar id explicitly in the payload would make the reader itself the single source of truth for its own identity, removing the IP-matching indirection entirely.
- Not urgent: the current IP-based design already runs the installation successfully, and WOW-030's fix (per-device config file + boot-time serial diagnostic) closes the specific "checked-in default silently maps to no pillar" bug this batch was scoped to fix, without touching the contract.

Options:

1. Keep IP-based identity (status quo, as hardened by WOW-030). Simplest, zero contract change, but identity stays coupled to networking (source IP) rather than being self-declared by the device.
2. Add an explicit pillar id to the RFID reader's OSC payload (e.g. `/new/tag [rfid] [pillarId]`), read directly by the backend instead of matching `requestAddress`. Removes the IP-coupling entirely; requires coordinated firmware + backend changes and a migration window (old firmware would need the IP-matching path kept as a fallback, or all 4 devices reflashed atomically).
3. Keep IP-based routing but add a lightweight backend-side reconciliation check — the reader self-reports its configured pillar id in the payload purely as an assertion; the backend logs a loud warning if it disagrees with the IP-derived pillar, without changing which one actually wins. Cheaper than option 2 and catches "device physically moved but not reflashed" as an ongoing runtime check, not just at flash-time.

Recommendation:

- No action needed now. If this is ever revisited, option 3 is the more attractive middle ground — it extends WOW-030's flash-time boot diagnostic into an ongoing runtime cross-check, without option 2's coordinated-migration cost. Worth prioritizing only if a real incident (a device going silently dark because it was swapped without reflashing) makes the gap worth closing.

Blocked until human confirms:
no (informational; doesn't block WOW-030's own landing or any other work — recorded for future prioritization only)

## Software architecture / dependencies

- F1 dependency updates: any libs explicitly off-limits besides keeping socket.io wire-compat with backend 4.6? Proposed approach: audit first (`yarn audit`/`npm audit`), then upgrade in grouped PRs (tooling, React ecosystem, Tailwind) — confirm grouping in WOW-009 review.

## Deployment / show operation

- Browser/kiosk setup on the show machine (which browser, kiosk mode, autostart)? Not blocking.

Decision needed:

- Crash-restart supervision for the backend process (WOW-014). `nodemon`'s default behavior does not restart the process after a crash — it waits for a file change. WOW-014 adds process-level `unhandledRejection`/`uncaughtException` handlers that log via pino then `process.exit(1)`, so a crash now stops the process cleanly with a diagnostic log instead of hanging in a broken state — but nothing currently restarts it automatically afterward.

Why this matters:

- At the venue, a backend crash currently means silence until a human notices and manually restarts it. The installation runs unattended for stretches; automatic restart would shrink recovery time from "whenever someone notices" to seconds.

Options:

1. `nodemon --exitcrash` (or equivalent flag) — minimal change, stays within the dev-grade tool already in use, but nodemon is a development watcher, not a production process supervisor (no crash-loop backoff protection).
2. pm2 — purpose-built Node process manager with restart policies, crash-loop backoff, and log management; adds a new dependency/tool to the show machine.
3. launchd (macOS) or systemd (Linux) unit — OS-level supervision, no new Node dependency, but needs per-platform setup and a known target OS (per `docs/HARDWARE_INTEGRATION.md` → "Computers", currently TBD).

Recommendation:

- Option 2 (pm2) if the show machine's OS is uncertain or mixed; option 3 if it's fixed and known — either gives real crash-loop protection, which `nodemon --exitcrash` alone does not. Needs the show machine's OS confirmed first.

Blocked until human confirms:
yes

## Out of scope (parked)

- WiFi credentials committed in `Arduino/` sketches (standing security note).
- Lighting server, audio path, show startup/shutdown procedures.

## Proposed ADRs (future)

- ADR-007: reserved (the operator view-vs-overlay ADR is no longer needed — resolved as three-mode main screen in ADR-003 amendment 2026-07-11)
- ADR-008: Dependency modernization baseline (after WOW-009 audit)

## Resolved → ADRs / owning docs

**2026-07-11:**

- Operator surface page-vs-overlay: resolved as **neither** — the main screen gets **three modes** (normal / dj / debug). DJ mode adds per-pillar extended controls incl. clip selection (moved out of the old debug panel); debug mode adds a bottom diagnostic panel only (API/socket-event log, versions, connection state); tempo/volume/key stay visitor-visible in normal mode; each elevated mode has its own hidden gesture → ADR-003 (amended), ADR-006 (amended), PRD F6/FR1, UX_UI_PRINCIPLES, TICKETS_001 (WOW-006/007)

**2026-07-10:**

- Hardware-sim tier (ADR-001 amendment): human **approved as drafted** — tier 2 (real backend + local Ableton, simulated tags, human-run only) with three design decisions: tag client **hard-aborts** unless `LIGHTING_SERVER_ADDRESS` is localhost; **manual keyboard mode** included; **fidelity-validation checklist** included in the runbook → ADR-001 amendment, TICKETS_001_INITIAL (WOW-010)
- Simulator server dependency: root `package.json` only had `socket.io-client` (ticket WOW-003's "use existing socket.io" premise was false). Human approved adding `socket.io@^4.6.x` as a **devDependency** for `sim/server.ts` — that package only, wire-compatible with the 4.6 client → TICKETS_001_INITIAL (WOW-003), wow-003 build prompt

**2026-07-09 (third round):**

- Category colors: defined in `src/util/ColorUtil.ts` (`ColorUtil.getBackgroundColorFromType`) — Vox = red-700, Bass = green-700, Drums = blue-700, Melody = yellow-700 (Tailwind). Single source of truth for legend/icons; redesign may restyle values only via that function → PRD F4

**2026-07-09 (second round):**

- `backend/` folder **is** the backend code; stays in repo, read-only this phase → ADR-004 (amended)
- Operator access gesture: long-press ~3 s on themed element → ADR-006
- Routing: hand-rolled, no router dependency → ADR-005 (human-authored; supersedes the earlier react-router chat approval)
- Spell names: **removed entirely** (with recipes; `useGrimoire` goes) → ADR-003 (amended), PRD F5
- Operator page-vs-overlay: **reopened**, decided from WOW-006 mockups → ADR-003 (amended)
- Simulator location/port: `sim/`, port 3335 → ADR-001
- Feature list F1–F6 confirmed → PRD

**2026-07-09 (first round):**

- Simulation mode: yes, option 1 (standalone mock backend) → ADR-001
- Clip categories: Vox, Melody, Bass, Drums → ADR-002
- Display: single 1024×1280 portrait touch screen in a physical grimoire → ADR-003
- Scope: frontend-only; no e2e from this repo → ADR-004
- Volume: plain slider; max limited on hardware → PRD
- LEDs light in category color, externally driven → HARDWARE_INTEGRATION
- CSV read-only for agents unless explicitly allowed; icons match `Icon / Asset Name`; one object per pillar → AGENTS.md / DATA_MODEL
- Agents may run `yarn dev`/`yarn test`; never merge PRs or push to main; PRs target `origin` → AGENTS.md
- Show operation: visitors + one knowledgeable guide → PROJECT_BRIEF
