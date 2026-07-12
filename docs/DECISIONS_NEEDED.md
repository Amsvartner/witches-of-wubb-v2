# Decisions needed

Open questions for the human. Answered decisions live in ADRs (`docs/adr/`) and the owning docs — see "Resolved" below.

## Product / UX

- Which themed elements host the dj-mode and debug-mode gestures (wax seal, sigil, bookmark…) and what distinguishes the two gestures — designer proposes the pair, human picks (part of WOW-006 review; ADR-006 amended).
- Debug panel content beyond the confirmed baseline (API/socket-event log, versions, connection state) — e.g. log filtering, copy/export — designer proposes (part of WOW-006 review).

## Software architecture / dependencies

- F1 dependency updates: any libs explicitly off-limits besides keeping socket.io wire-compat with backend 4.6? Proposed approach: audit first (`yarn audit`/`npm audit`), then upgrade in grouped PRs (tooling, React ecosystem, Tailwind) — confirm grouping in WOW-009 review.

## Deployment / show operation

- Browser/kiosk setup on the show machine (which browser, kiosk mode, autostart)? Not blocking.

## Out of scope (parked)

- WiFi credentials committed in `Arduino/` sketches (standing security note).
- Lighting server, audio path, show startup/shutdown procedures.

## Proposed ADRs (future)

- ADR-007: reserved (the operator view-vs-overlay ADR is no longer needed — resolved as three-mode main screen in ADR-003 amendment 2026-07-11)
- ADR-008: Dependency modernization baseline (after WOW-009 audit)

## Resolved → ADRs / owning docs

**2026-07-12:**

- Backend/Arduino read-only restriction (ADR-004): the `docs/TICKETS_002_BUGS.md` batch (WOW-014...WOW-032, 19 tickets) gets a second, ticket-scoped exception alongside WOW-011's — surfaced when a WOW-022 reviewer correctly flagged that `backend/package.json`'s change conflicted with ADR-004's literal "one-time exception, WOW-011 only" text, even though this ticket batch's own text already extensively scopes backend/Arduino work and every prior backend-touching ticket this batch relied on the same (previously undocumented-in-ADR-004) authorization → ADR-004 (amended), AGENTS.md v0.5

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
