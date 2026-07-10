# Tickets 001 — Initial

Updated 2026-07-10 (WOW-011 added; earlier scope decisions ADR-001…004 on 2026-07-09). Agent output notes go to `docs/agent-notes/wow-XXX-<role>-<topic>.md`.

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
- Description: For 1024×1280 portrait touch: visitor display with **category icon + category name per pillar** (no song/picture names — PRD F3), **category legend** (F4, colors from `src/util/ColorUtil.ts`: Vox red-700, Bass green-700, Drums blue-700, Melody yellow-700), grimoire-extension background, no recipes/spell names (F5). Operator surface: present **both** a separate-view and a full-screen-overlay concept (ADR-003 amendment; hand-rolled navigation per ADR-005) with the long-press themed element (ADR-006) — propose the element (wax seal/sigil/bookmark) and hold feedback. 2–3 palette/typography options for the artists.
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

- ID: WOW-010
- Title: Hardware-sim tag client (tier 2) — ADR-001 amendment
- Summary: Thin socket.io client that replays `sim/core` scenarios against the **real backend** (`/new/tag`/`/departed/tag` over websocket), so a human with a local Ableton set can exercise real musical behavior with simulated pillars/tags.
- Description: Implement per the ADR-001 amendment ("hardware-sim tier", approved 2026-07-10): `sim/tag-client.ts` connects to `localhost:3335` as a socket.io client and replays the existing scenario scripts (`full-spell`, `replace-ingredient`, `timeout`, `idle`) by emitting `/new/tag`/`/departed/tag` with real CSV rfids; **manual mode** (`yarn sim:tags manual` — keyboard-driven place/remove per pillar); **lighting guardrail** — the client reads `.env` and hard-aborts unless `LIGHTING_SERVER_ADDRESS` is localhost/127.0.0.1; add `yarn sim:tags <scenario|manual>`; README tier-2 runbook covering the preconditions (local Ableton set only, agents never run `yarn start-backend`) plus the **fidelity-validation checklist** (each documented tier-1 approximation checked against real Ableton, recorded next to the WOW-003 fidelity table); extend the import-guard test with the file-scoped carve-out (socket.io-client allowed in `sim/tag-client.ts` only).
- Acceptance criteria: `yarn sim:tags full-spell` against a human-run real backend drives tags end-to-end (verified by the human — agents verify only against the tier-1 mock, where the client's emissions can be asserted); manual mode places/removes tags per keypress; client aborts with a clear message when `LIGHTING_SERVER_ADDRESS` is non-local; `sim/core` untouched and still transport-free; zero imports of `ableton-js`/`node-osc`/`backend/` anywhere in `sim/**`; import-guard test updated and green; README runbook incl. fidelity checklist present; no backend changes.
- Required tests/checks: vitest for the client's scenario→emission mapping against the tier-1 mock server or an in-process socket.io server on an ephemeral localhost port; `yarn lint`; `yarn test`; `yarn build`.
- Hardware/Ableton/LED/RFID safety notes: The client emits only `/new/tag`/`/departed/tag` to `localhost:3335` and is inert without a backend. **Agents never run `yarn start-backend`** — tier-2 end-to-end verification is a human demo step, not an agent validation. CSV read-only.
- Dependencies: WOW-003 merged (reuses `sim/core` scenarios); ADR-001 amendment **approved 2026-07-10** — unblocked.
- Out of scope: `backend/**` changes; new scenarios; any change to `sim/core` beyond exports the client needs.
- Suggested agent(s): creative-tech-integrator (build), test-engineer, reviewer, hardware-safety-reviewer (runbook + safety-rule review)
- Risk: low-medium (safety-rule clarity; carve-out precision in the import guard)
- Stop conditions: Any need to touch `backend/` or add dependencies → stop and ask. Manual-mode keyboard handling requiring a new dependency (e.g. a TUI lib) → stop and ask (prefer raw stdin).

---

- ID: WOW-011
- Title: Coding-guidelines conventions migration
- Summary: One-time sweep bringing the existing codebase in line with `docs/CODING_GUIDELINES.md` v1.0 (adopted 2026-07-10) — pure structure/naming/tooling, **zero behavioral change**.
- Description: Execute the 8-step "Migration" section of `docs/CODING_GUIDELINES.md`: (1) rename component/hook/context files to `PascalCase`, folders to singular (`components`→`component`, `contexts`→`context`, `hooks`→`hook`, `lib`→`util`); (2) named exports replace default exports, `function` components become `const` arrow components; (3) backend PascalCase functions → `camelCase`, module exports grouped behind namespace objects (`AbletonService`, `CsvUtil`, …); (4) split `backend/types.ts` into `backend/type/` (one type per file), add `Maybe.ts`; (5) restructure `backend/` into `event/`/`service/`/`adapter/`/`util/`, isolating all OSC/MIDI/Art-Net/Ableton I/O behind adapters; (6) introduce `src/page/` + `src/container/` and move logic-bearing components accordingly; (7) move `spec/` tests (incl. `spec/sim/` and `setup-tests.ts`) into colocated `test/` folders, update vitest config (`vite.config.ts` `setupFiles`/includes) — the import-guard test must survive the move intact; (8) add ESLint rules enforcing the mechanical conventions (`import/no-default-export`, `@typescript-eslint/consistent-type-definitions` = `type`, re-enable `@typescript-eslint/no-explicit-any`; existing plugins suffice — no new packages expected), remove remaining `any` and commented-out code. **Backend edits are permitted for this ticket only** under the AGENTS.md v0.4 "Exception — conventions migration (2026-07-10)" in "Scope of current phase". When files move, update every stale path reference in AGENTS.md and docs **in the same PR** (known references: `backend/types.ts` and `spec/` in AGENTS.md; `backend/key-transpositions.ts` and `backend/events/incoming-events.ts` in the AGENTS.md safety rules; `src/lib/utils.ts` `getBackgroundColorFromType` in PRD F4/DECISIONS_NEEDED; `spec/` mentions in ARCHITECTURE/README/skills). **Recommended delivery: a stack of 3 PRs under this one ticket** (guidelines allow "one reviewed PR (or a small stack)"): PR 1 frontend sweep (steps 1, 2, 6 + `spec/App.spec.tsx` move); PR 2 backend sweep (steps 3, 4, 5 — the dual-safety-reviewer diff, kept free of frontend noise so the specialists review a focused change); PR 3 tests + enforcement (step 7 remainder + step 8, landing last so the new lint rules validate the fully migrated tree). Rationale: one mega-PR would mix a safety-gated backend diff into thousands of lines of mechanical frontend renames, defeating review. Each PR must be independently green and mergeable in order.
- Allowed files: `src/**`, `backend/**` (exception above), `spec/**` (moves/deletion of emptied folder), `sim/**` (only renames forced by moved imports), `vite.config.ts`, `.eslintrc`, `tsconfig.json` path aliases if required, `AGENTS.md`/`docs/**`/`README.md` stale-path updates.
- Disallowed files: `src/assets/Music Database.csv`, `Arduino/**`, `backend/package.json` + lockfiles, root `package.json` dependencies (script/config edits only if unavoidable — prefer none), `.env`.
- Acceptance criteria: `yarn lint` and `yarn test` green after each PR in the stack; full test suite migrated to and passing from colocated `test/` folders (top-level `spec/` retired, vitest config updated, import-guard test still enforcing); no default exports, no `interface`, no `any` remaining in migrated code; ESLint rules enforcing the mechanical conventions added and passing; **zero behavioral change** — musical logic, timing, quantization, transposition tables, volume handling, the pillar IP map, and all emitted OSC/MIDI/Art-Net/socket payloads byte-for-byte equivalent; **socket.io event names frozen** (no additions/renames/removals); all stale file-path references in AGENTS.md/docs updated in the same PR as the move; human-verifiable demo without hardware: `yarn sim` + `yarn dev` still drives the UI end-to-end exactly as before.
- Required tests/checks: `yarn lint`, `yarn test`, `yarn build` per PR; simulator smoke (`yarn sim` + `yarn dev`, run a scenario) per PR; grep-level verification that emitted event-name strings and payload shapes are unchanged (diff the `backend/event/` handlers against the old `backend/events/` byte-for-byte modulo renames); `git diff` review confirming moves are renames, not rewrites.
- Hardware/Ableton/LED/RFID safety notes: This ticket touches `backend/` — the physical-installation safety rules apply in full. Structure and naming only; any change to values, ordering, timing, or payloads is out of scope and grounds for rejection. Never run `yarn start-backend`. The backend PR (PR 2) requires **both audio-ableton-reviewer and hardware-safety-reviewer sign-off before merge** (AGENTS.md exception terms); PRs 1 and 3 take the standard reviewer gate, escalating to the specialists if they brush any Ableton/hardware path.
- Dependencies: `docs/CODING_GUIDELINES.md` v1.0 adopted 2026-07-10; AGENTS.md v0.4 exception in place — unblocked. Sequence before WOW-007 implementation tickets (avoid migrating code that's about to be rewritten, and vice versa); coordinate with WOW-009 so dependency-upgrade PRs and this stack don't land interleaved (merge-conflict churn).
- Out of scope: any behavioral/logic change, however small; new/renamed socket.io events; new dependencies (expected: none — existing ESLint plugins cover the rules); refactors beyond the 8 listed steps (no "while we're here" cleanups); `sim/core` logic changes; CSV or pillar-IP-map edits; Arduino.
- Suggested agent(s): frontend-implementer (PR 1), creative-tech-integrator (PR 2 — backend structure), test-engineer (PR 3 + test-move verification), reviewer (all PRs), audio-ableton-reviewer + hardware-safety-reviewer (PR 2 sign-off, mandatory)
- Risk: medium (large mechanical diff; payload-equivalence claims must be verified, not assumed)
- Stop conditions: Any step cannot be completed without changing behavior, payloads, or event names → stop and ask. ESLint enforcement turns out to require a new plugin dependency → stop and ask (dependency approval rule). A `backend/` file resists clean classification into `event/`/`service/`/`adapter/`/`util/` without splitting logic → stop and ask rather than restructure logic. Two docs contradict on a path or convention → Decision needed.

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
