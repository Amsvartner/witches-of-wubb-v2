# Tickets 001 — Initial

Updated 2026-07-09 after scope decisions (ADR-001…004). Agent output notes go to `docs/agent-notes/wow-XXX-<role>-<topic>.md`.

---

- ID: WOW-001 ✅ done (pending commit)
- Title: Docs + agent scaffolding bootstrap
- Summary: AGENTS.md, docs suite, agent profiles, ADRs, Filterful-pattern workflow files.
- Status note: Completed on branch `docs/agent-scaffolding`; awaiting human review + commit approval.

---

- ID: WOW-002 ✅ done
- Title: Verify TBDs with human
- Status note: Human answered 2026-07-09; decisions propagated to ADRs 001–004, PRD, and docs. Remaining opens tracked in DECISIONS_NEEDED.

---

- ID: WOW-003
- Title: Build offline simulator (mock backend) — ADR-001
- Summary: Standalone mock socket.io server so UI development never needs Ableton/hardware.
- Description: Implement per ADR-001 (amended): `sim/core/` — plain TS module with fake state, contract handlers, and scenario engine (no socket.io imports, unit-testable, importable by vitest); `sim/server.ts` — thin socket.io wrapper on port 3335. Full observed contract: responds to `get_playing_clips`, `get_queued_clips`, `get_tempo`, `set_tempo`, `get_track_volumes`, `set_track_volume`, `get_keylock_state`, `set_keylock_state`, `get_master-key`, `set_master-key`; accepts `/new/tag`, `/departed/tag`; emits `ingredient_detected`, `ingredient_removed`, `timeout_warning`. Scripted scenarios use real rows from `Music Database.csv` (read-only). One object per pillar. Add yarn script + README section.
- Acceptance criteria: `yarn dev` + simulator drives the current UI end-to-frontend; all events logged; zero imports of ableton-js/node-osc; `sim/core` has no socket.io imports and is exercised directly by vitest; contract documented deltas = none.
- Required tests/checks: vitest unit tests importing `sim/core` (state + scenario engine); `yarn lint`; manual demo steps for the human.
- Hardware/Ableton/LED/RFID safety notes: Must be incapable of emitting OSC or contacting the real backend/hardware. CSV read-only.
- Dependencies: none — location/port decided (`sim/`, port 3335 → ADR-001); `socket.io@^4.6.x` devDependency approved 2026-07-10 (root only had `socket.io-client`; see DECISIONS_NEEDED "Resolved").
- Out of scope: modifying `backend/`; new **runtime** dependencies beyond the approved `socket.io` devDependency.
- Suggested agent(s): creative-tech-integrator (build), test-engineer, reviewer
- Risk: low-medium (contract fidelity)
- Stop conditions: Contract ambiguity that can't be resolved from `backend/events/` reading → Decision needed.

---

- ID: WOW-004
- Title: UI audit report (read-only)
- Summary: Audit current UI ahead of the rework, against the real display target.
- Description: Catalog components/states/socket events consumed, failure/disconnect behavior, a11y issues; assess current layout at **1024×1280 portrait touch**; inventory what maps to visitor page vs. operator page; list everything the recipe-section removal touches (recipe-box, use-grimoire, currently-playing coupling). Output `docs/UI_AUDIT.md`.
- Acceptance criteria: Every file in `src/components|contexts|hooks` covered; recipe-removal blast radius listed; issues tagged severity; no fixes made.
- Required tests/checks: may run `yarn dev` (UI only) and `yarn test`.
- Hardware/Ableton/LED/RFID safety notes: Do not run the real backend.
- Dependencies: none (WOW-003 helps but isn't required)
- Out of scope: code changes, design proposals.
- Suggested agent(s): frontend-ui-designer, architecture-reviewer
- Risk: low
- Stop conditions: Question answerable only against live backend → log as TBD.

---

- ID: WOW-005
- Title: Baseline test/lint pass verification
- Summary: Confirm `yarn lint` and `yarn test` pass; document actual state; fix nothing.
- Acceptance criteria: Results recorded in `docs/agent-notes/wow-005-test-engineer-baseline.md`; failures ticketed, not fixed.
- Required tests/checks: `yarn lint`, `yarn test`.
- Hardware/Ableton/LED/RFID safety notes: jsdom only; do NOT run `yarn start-backend`.
- Dependencies: none
- Out of scope: installs, fixes.
- Suggested agent(s): test-engineer
- Risk: low
- Stop conditions: Tests attempt network/Ableton access.

---

- ID: WOW-006
- Title: Grimoire design proposal (visitor display + operator surface)
- Summary: Design direction doc for the overhaul — no implementation.
- Description: For 1024×1280 portrait touch: visitor display with **category icon + category name per pillar** (no song/picture names — PRD F3), **category legend** (F4, colors from `src/lib/utils.ts`: Vox red-700, Bass green-700, Drums blue-700, Melody yellow-700), grimoire-extension background, no recipes/spell names (F5). Operator surface: present **both** a separate-view and a full-screen-overlay concept (ADR-003 amendment; hand-rolled navigation per ADR-005) with the long-press themed element (ADR-006) — propose the element (wax seal/sigil/bookmark) and hold feedback. 2–3 palette/typography options for the artists.
- Acceptance criteria: `docs/DESIGN_PROPOSAL_001.md` with clearly marked options for human choice (page vs. overlay, palette, gesture element); consistent with UX_UI_PRINCIPLES; no code.
- Required tests/checks: none.
- Hardware/Ableton/LED/RFID safety notes: none (docs).
- Dependencies: WOW-004.
- Out of scope: implementation; any router dependency (routing is hand-rolled, ADR-005).
- Suggested agent(s): frontend-ui-designer
- Risk: low
- Stop conditions: Needs visual-identity decisions only the artists can make → present options, halt.

---

- ID: WOW-009
- Title: Dependency audit + modernization (F1)
- Summary: Update frontend/tooling libs, security-flagged first; Ableton-related and backend deps untouched.
- Description: Run `yarn audit` (or equivalent) on the **root** package only; report findings in `docs/agent-notes/wow-009-audit.md`; then upgrade in grouped PRs (1: security patches, 2: tooling/lint/test, 3: React/Vite/Tailwind ecosystem). Keep `socket.io-client` wire-compatible with backend socket.io 4.6. Split `dependencies` vs `devDependencies` while touching package.json (proposal — confirm in review).
- Acceptance criteria: `yarn build`, `yarn test`, `yarn lint` green after each group; audit report notes remaining known vulns; no backend/ changes; no new features.
- Required tests/checks: build + test + lint per group; UI smoke via `yarn dev` + simulator once WOW-003 lands.
- Hardware/Ableton/LED/RFID safety notes: none directly, but do not touch `backend/` lockfile or deps.
- Dependencies: ideally after WOW-003/WOW-005 (baseline to compare against).
- Out of scope: backend deps, ableton-js, Arduino; major framework swaps (e.g. React 19) without a separate go-ahead if breaking changes are large — stop and ask.
- Suggested agent(s): frontend-implementer, test-engineer, reviewer
- Risk: medium (upgrade breakage)
- Stop conditions: An upgrade requires code changes beyond mechanical API updates, or socket.io compat is at risk → stop and ask.

---

- ID: WOW-007 (placeholder)
- Title: [Placeholder] UI rework foundation tickets
- Summary: Sliced by project-manager after WOW-006 approval (two-page structure, theming foundation, recipe removal, contract layer).
- Dependencies: WOW-006 approved; routing + operator-access decisions.
- Stop conditions: No approved design direction.

---

- ID: WOW-008 (placeholder)
- Title: [Placeholder] New feature tickets
- Summary: Await human's feature list (PRD "Candidate features").
- Dependencies: PRD confirmation.
- Stop conditions: Features not confirmed by human.
