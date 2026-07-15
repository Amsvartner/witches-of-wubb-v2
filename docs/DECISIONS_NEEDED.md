# Decisions needed

Open questions for the human. Answered decisions live in ADRs (`docs/adr/`) and the owning docs — see "Resolved" below.

## Product / UX

- **Visual art direction (WOW-006, REQUEST-CHANGES 2026-07-15):** the primary visual reference is `docs/design/hexology-grimoire-concept-3.png` (gold-slider variant). Human/artist sign-off still required on: **typography** (3 directions in `DESIGN_PROPOSAL_001.md` §8.2 + `docs/design/typography-specimens.html` — Fondamento rejected), **page palette** (§8.3), **pillar border/frame style** (§8.5 — several options; reference frame is only an example), **mode-access model** (§8.1), and **debug-panel extras** (§8.4). **A human-approved visual-fidelity spike (WOW-007A) gates all further UI implementation.**
- **Category colours:** **Vocals = red** per the original spec — the reference's pink does **not** apply (resolved 2026-07-15, [Requirements over reference]); Bass green / Drums blue align with `ColorUtil`. **Open:** **Melody** — reference leans amber/orange vs today's yellow-700; decide and re-verify vs pillar LEDs (§8.3).
- **ADR-006 amendment needed:** the approved reference + wireframe use a **visible Settings modal** for mode switching, superseding the earlier "hidden gesture, no visible affordance" model (`DESIGN_PROPOSAL_001.md` §6/§8.1). Write up the amendment before WOW-007 slicing. **Conditional:** if §8.1 Option B/C (a covert gesture is retained alongside Settings) is chosen, the earlier "which themed element hosts the gesture" question reopens (see the hidden-gesture asset row in `DESIGN_PROPOSAL_001.md` §3.11).
- **Currently-playing vs PRD F3:** the wireframe shows per-pillar "Currently playing"; F3 bars song/sample **names** from the visitor display. This proposal shows currently-playing **state only** in normal mode and the **name only in dj mode** — confirm, or amend F3 to allow names in normal.
- ~~**Category icon set (new reference concept-3):** reference draws Melody as a sine-wave and Bass as a hexagram vs the clefs in §3.3.~~ **Resolved 2026-07-15 (human): keep the conventional mic / treble-clef / bass-clef / drum-kit set** (`DESIGN_PROPOSAL_001.md` §3.3 / §2); the reference's symbols are art-license, not the icon spec.
- Debug panel content beyond the confirmed baseline (API/socket-event log, versions, connection state) — e.g. log filtering, copy/export — designer proposes (`DESIGN_PROPOSAL_001.md` §8.4).

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

## Software architecture / dependencies

- F1 dependency updates: any libs explicitly off-limits besides keeping socket.io wire-compat with backend 4.6? Proposed approach: audit first (`yarn audit`/`npm audit`), then upgrade in grouped PRs (tooling, React ecosystem, Tailwind) — confirm grouping in WOW-009 review.

## Deployment / show operation

- Browser/kiosk setup on the show machine (which browser, kiosk mode, autostart)? Not blocking.

Decision needed:

- Crash-restart supervision for the backend process (WOW-014). `nodemon`'s default behavior does not restart the process after a crash — it waits for a file change. WOW-014 adds process-level `unhandledRejection`/`uncaughtException` handlers that log via pino then `process.exit(1)`, so a crash now stops the process cleanly with a diagnostic log instead of hanging in a broken state — but nothing currently restarts it automatically afterward.

**Scope note (WOW-034, 2026-07-12):** this entry is about _restart speed_ only — how quickly the backend comes back up after a crash. It's a separate question from _what Ableton does while the backend is down_, which the WOW-014 hardware-safety-reviewer sign-off flagged as a distinct gap: neither WOW-014's handlers nor any prior code path told Ableton to stop before the process died, so a crash left audio playing/looping on all four pillars indefinitely. WOW-034 addressed that narrower gap — both crash handlers now make a bounded (~1.5s), best-effort, parallel `stop_all_clips` attempt before `process.exit(1)`, guarded so it can't itself hang or delay the exit past the bound. This entry remains open for the broader restart-speed question below.

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

**2026-07-12:**

- Backend/Arduino read-only restriction (ADR-004): resolved as **a second, ticket-scoped exception** for the `docs/TICKETS_002_BUGS.md` batch (WOW-014...WOW-032, 19 tickets), alongside WOW-011's existing one — surfaced when a WOW-022 reviewer correctly flagged that `backend/package.json`'s change conflicted with ADR-004's literal "one-time exception, WOW-011 only" text, even though this ticket batch's own text already extensively scopes backend/Arduino work and every prior backend-touching ticket in this batch relied on the same (previously undocumented-in-ADR-004) authorization → ADR-004 (amended), AGENTS.md v0.5

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
