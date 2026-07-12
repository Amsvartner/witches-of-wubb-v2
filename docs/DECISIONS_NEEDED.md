# Decisions needed

Open questions for the human. Answered decisions live in ADRs (`docs/adr/`) and the owning docs — see "Resolved" below.

## Security

Decision needed:

- Whether to scrub the leaked Wi-Fi credentials from git history (commit `e4b22c2` and any other commit touching the two Arduino sketches), via BFG Repo-Cleaner or `git filter-repo`, now that WOW-028 removes them from the working tree and rotation invalidates the leaked values.

Why this matters:

- The repo is public on GitHub. Rotating the network password (human action, tracked independently of this PR) makes the leaked value itself worthless, so scrubbing is optional hygiene rather than a security requirement — but a rewritten history invalidates every existing clone/fork/PR branch reference and is worth deciding explicitly rather than leaving ambiguous.

Options:

1. Scrub history now (BFG or `git filter-repo`) — cleanest, but rewrites all commit SHAs after the affected commits; every local clone (incl. this fork's other open branches, if any are based on affected history) needs to be re-cloned or hard-reset.
2. Leave history as-is post-rotation — the leaked value is dead once rotated; accept that it remains readable in `git log`/GitHub history as a permanent (but harmless) record.
3. Scrub history at a planned low-activity point (e.g. after the current ticket batch merges and before the next long-lived branch set) to minimize rebase pain.

Recommendation:

- Option 2 (leave as-is) once rotation is confirmed complete — the credential is dead, and a history rewrite on a shared fork is disruptive relative to the residual risk. Revisit if the repo's threat model changes (e.g. if the leaked value is reused elsewhere).

Blocked until human confirms:
yes

## Product / UX

- Which themed elements host the dj-mode and debug-mode gestures (wax seal, sigil, bookmark…) and what distinguishes the two gestures — designer proposes the pair, human picks (part of WOW-006 review; ADR-006 amended).
- Debug panel content beyond the confirmed baseline (API/socket-event log, versions, connection state) — e.g. log filtering, copy/export — designer proposes (part of WOW-006 review).

## Software architecture / dependencies

- F1 dependency updates: any libs explicitly off-limits besides keeping socket.io wire-compat with backend 4.6? Proposed approach: audit first (`yarn audit`/`npm audit`), then upgrade in grouped PRs (tooling, React ecosystem, Tailwind) — confirm grouping in WOW-009 review.

## Deployment / show operation

- Browser/kiosk setup on the show machine (which browser, kiosk mode, autostart)? Not blocking.

## Out of scope (parked)

- WiFi credential rotation and device reflashing (human action; code-side fix landed via WOW-028 — see "Security" above for the remaining git-history-scrubbing decision).
- Network redesign (VLANs, OSC/Art-Net authentication) — the installation network currently carries unauthenticated show-control traffic; worth a dedicated security discussion (noted in WOW-028).
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
