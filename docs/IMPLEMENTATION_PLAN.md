# Implementation plan

Revised 2026-07-09 after scope decisions (ADR-001…004). **Frontend-only**; backend/hardware/Ableton out of scope. Every stage ends with a review gate.

## Stage 0 — Documentation and agent scaffolding ✅ (this branch)

- AGENTS.md, docs suite, `.claude/agents/`, ADRs 001–004, Filterful-pattern workflow files.
- **Gate:** human review + explicit "commit now".

## Stage 1 — Offline simulator (ADR-001)

- Build the standalone mock socket.io backend in `sim/` on port 3335: full `get_*`/`set_*` coverage, scripted tag scenarios from the CSV (read-only), timeout-warning sequence. No ableton-js/OSC imports.
- Document usage in README; add a `yarn` script (name TBD).
- Verify baseline `yarn lint` / `yarn test` while at it (WOW-005).
- Then WOW-009: dependency audit + grouped modernization upgrades (F1, security first).
- **Gate:** reviewer + test-engineer; human runs the demo steps (simulator + `yarn dev`).

## Stage 2 — UI audit and design direction

- WOW-004 UI audit (read-only) against the 1024×1280 portrait viewport.
- frontend-ui-designer produces the grimoire design proposal: visitor page, operator page, theme/background approach, component inventory. Options for palette/typography for the human/artists to pick.
- Resolve open decisions: routing dependency, operator access, spell names.
- **Gate:** human approves design direction + answers decisions.

## Stage 3 — UI rework foundation

- Three-mode main-screen structure (normal / dj / debug, ADR-003 amended 2026-07-11), viewport/kiosk setup, theming foundation (grimoire background system), socket-contract layer hardening, connection/simulator status surfacing, remove recipe section.
- Tests for existing behavior before moving it.
- **Gate:** reviewer + architecture-reviewer; human demo.

## Stage 4 — Visitor display + operator surface implementation

- Visitor display (category icons + names, legend — F3/F4), dj-mode per-pillar extended controls, and debug-mode diagnostic panel (modes + gesture pair per WOW-006 decision — F6) as separate PR-sized tickets sliced by project-manager.
- **Gate:** per ticket — reviewer; human demo against simulator.

## Stage 5 — Additional features

- PRD F1–F6 are absorbed by Stages 1–4; this stage holds anything added to "Candidate features" later.
- **Gate:** each feature individually approved and ticketed first.

## Stage 6 — Show polish

- Final pass on the real rig is done **by the human** (e2e is out of repo scope): kiosk setup, real-backend smoke check. Agents supply a manual checklist, nothing more.
- **Gate:** human sign-off at the venue.

## Standing rules

- Stages 1–2 may run in parallel; others sequential unless human approves overlap.
- Scope discoveries go to DECISIONS_NEEDED, not into code.
