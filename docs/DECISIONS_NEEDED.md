# Decisions needed

Open questions for the human. Answered decisions live in ADRs (`docs/adr/`) and the owning docs — see "Resolved" below.

## Product / UX

```text
Decision needed:
- Operator surface: separate view or redesigned full-screen overlay? (Routing is hand-rolled either way, ADR-005.)

Why this matters:
- Determines back/close behavior and WOW-007 ticket slicing.

Options:
1. Separate view (hand-rolled route state / location.hash).
2. Full-screen overlay/modal.

Recommendation:
- Decide from WOW-006 mockups — both will be presented.

Blocked until human confirms:
yes (blocks operator-surface implementation, not design)
```

- Which themed element hosts the operator long-press (wax seal, sigil, bookmark…) — designer proposes, human picks (part of WOW-006 review).

## Software architecture / dependencies

- F1 dependency updates: any libs explicitly off-limits besides keeping socket.io wire-compat with backend 4.6? Proposed approach: audit first (`yarn audit`/`npm audit`), then upgrade in grouped PRs (tooling, React ecosystem, Tailwind) — confirm grouping in WOW-009 review.

## Deployment / show operation

- Browser/kiosk setup on the show machine (which browser, kiosk mode, autostart)? Not blocking.

## Out of scope (parked)

- WiFi credentials committed in `Arduino/` sketches (standing security note).
- Lighting server, audio path, show startup/shutdown procedures.

## Proposed ADRs (future)

- ADR-007: Operator surface — view vs. overlay (after WOW-006)
- ADR-008: Dependency modernization baseline (after WOW-009 audit)

## Resolved → ADRs / owning docs

**2026-07-09 (third round):**

- Category colors: defined in `src/lib/utils.ts` (`getBackgroundColorFromType`) — Vox = red-700, Bass = green-700, Drums = blue-700, Melody = yellow-700 (Tailwind). Single source of truth for legend/icons; redesign may restyle values only via that function → PRD F4

**2026-07-09 (second round):**

- `backend/` folder **is** the backend code; stays in repo, read-only this phase → ADR-004 (amended)
- Operator access gesture: long-press ~3 s on themed element → ADR-006
- Routing: hand-rolled, no router dependency → ADR-005 (human-authored; supersedes the earlier react-router chat approval)
- Spell names: **removed entirely** (with recipes; `use-grimoire` goes) → ADR-003 (amended), PRD F5
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
