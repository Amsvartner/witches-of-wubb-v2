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
- Canonical viewport: **1024 × 1280 portrait touch** (a 1280×1024 panel rotated to portrait, ADR-003). This is the single design-first target. The layout must also **scale gracefully / responsively** to other sizes (ADR-003 amended 2026-07-15). This is the only viewport agents design against — ignore any older `1280×1024` landscape phrasing.
- Context files (read all before proposing):
  - `docs/UX_UI_PRINCIPLES.md`, `docs/PRD.md`, `docs/PROJECT_BRIEF.md`, `docs/DECISIONS_NEEDED.md`
  - `docs/UI_AUDIT.md` — the pre-rework baseline audit (WOW-004); the "before" state every proposal must improve on
  - `docs/design/visual-direction.md` — the Hexology visual language + canonical viewport
  - `docs/design/Hex_layout_concept.svg` — the rough layout wireframe
  - `docs/design/hexology-grimoire-concept.png` **and** `docs/design/hexology-grimoire-concept-2.png` — the two grimoire concept images
- Design authority & inputs:
  - **The rough layout wireframe (`Hex_layout_concept.svg`) and the current functional requirements are the source of truth** for component placement, information hierarchy, controls, and the three modes. When an image and the requirements disagree, the requirements win.
  - **The generated concept images are visual-language inspiration only** — mood, colour, atmosphere, ceremonial identity. They are not layout specs or pixel targets.
  - The concept images are **AI-generated and internally inconsistent** (they even disagree on orientation — one landscape, one portrait — and contain AI-generated text/icon/ornament/control artefacts). **Agents must not reproduce these AI-generated inconsistencies literally.** Take the language, discard the artefacts.
- Description: For the canonical 1024×1280 portrait viewport: visitor display with **category icon + category name per pillar** (no song/picture names — PRD F3), **category legend** (F4, colors from `src/util/ColorUtil.ts`: Vox red-700, Bass green-700, Drums blue-700, Melody yellow-700), grimoire-extension background, no recipes/spell names (F5). **Main-screen modes** (ADR-003/006 amended 2026-07-11, supersedes the earlier page-vs-overlay exploration): design all three modes — **normal** (visitor experience; tempo/volume/key controls stay visible), **dj** (extended controls beside each pillar incl. per-pillar clip selection, moved out of the old debug panel), **debug** (small bottom panel: API/socket-event log, versions, connection state — no performance controls).
- Required design outputs (all required before any implementation ticket starts):
  1. A **low-fidelity full-screen layout** at the confirmed 1024×1280 portrait viewport.
  2. A **visual-direction mockup** (applying `docs/design/visual-direction.md`).
  3. **Design tokens** (background surfaces, pillar borders, sample-type accents, typography, buttons, sliders, queue rows, icon medallions, state colours, decorative motifs).
  4. **One completed reusable pillar component** showing its important states (e.g. focus, active, muted, paused, disabled, queued, empty).
  5. A **full-screen composition** built from that reusable pillar component.
  6. **Normal, DJ, and debug mode specifications** (what each mode adds/reveals, entry/close affordances).
  7. **Touch, contrast, typography, motion, and viewing-distance guidance** (WCAG AA for operator-critical text; touch-target sizing; reduced-motion; legibility at installation viewing distance).
- Open approval questions (do **not** decide these — present as clearly-marked options and halt for human/artist sign-off):
  - The **dj-mode and debug-mode gestures** (which themed element hosts each, hold duration/feedback, what distinguishes the two) — propose a pair, human picks.
  - **Typography** (Fondamento kept? decorative + legible pairing) — propose options, do not settle.
  - **Palette details** within the witchy/occult direction — propose 2–3 options, do not settle.
  - **Additional debug-panel features** beyond the confirmed baseline (log filtering, copy/export, etc.) — propose, do not decide.
- Acceptance criteria: `docs/DESIGN_PROPOSAL_001.md` containing all seven required design outputs above, all three modes designed, and every open approval question presented as clearly-marked options for human choice (never pre-decided); consistent with UX_UI_PRINCIPLES and `docs/design/visual-direction.md`; no code.
- Required tests/checks: none.
- Hardware/Ableton/LED/RFID safety notes: none (docs).
- Dependencies: WOW-004.
- Out of scope: implementation; any router dependency (routing is hand-rolled, ADR-005); deciding any of the open approval questions above.
- Suggested agent(s): frontend-ui-designer
- Risk: low
- Stop conditions: Needs visual-identity decisions only the artists can make (typography, palette, gestures, debug extras) → present options, halt.

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
- Summary: Sliced by project-manager after WOW-006 approval (three-mode main screen: normal/dj/debug per ADR-003 amended, theming foundation, recipe removal, contract layer).
- Dependencies: WOW-006 approved; gesture-pair decision (ADR-006 amended).
- Stop conditions: No approved design direction.

---

- ID: WOW-008 (placeholder)
- Title: [Placeholder] New feature tickets
- Summary: Await human's feature list (PRD "Candidate features").
- Dependencies: PRD confirmation.
- Stop conditions: Features not confirmed by human.

---

- ID: WOW-012
- Title: Fix `findIndex` truthiness bug in `ingredient_removed` handler
- Summary: Pre-existing bug surfaced by Copilot review on WOW-011 PR 3 (thread on `src/context/AbletonProvider.tsx` `ingredient_removed`): the `else if (queuedClips.findIndex(...))` branch treats `findIndex`'s return as a boolean — `-1` (not found) is truthy and `0` (found at index 0) is falsy, so the queued-clip cleanup fires/skips incorrectly. Out of scope for WOW-011 (zero-behavior-change constraint); fix is `> -1` like the sibling branch, plus a mocked-socket test covering both edge cases.
- Allowed files: `src/context/AbletonProvider.tsx`, `src/context/test/**`
- Risk: low (isolated conditional; UI state only, no backend/hardware path)
- Dependencies: WOW-011 stack merged.
- Status note: Closed as done, superseded by `docs/TICKETS_002_BUGS.md`'s WOW-026 — the context restructure (commit `0aaa123`, 2026-07-10) already replaced this `findIndex`-truthiness check with `.some(...)` before this ticket was ever picked up, so the specific bug described here (the queued branch's bare truthy `findIndex(...)` check) no longer exists in that form. The any-pillar `.some(...)` scan itself (searching _all_ pillars for a clip-name match instead of the event's own pillar) is a separate, older bug that `0aaa123` did **not** introduce — it was already present, as `findIndex(...) > -1` on the playing branch, since commit `45f9554` (2023-05-19), which is also where the queued branch's truthy-`findIndex` bug this ticket describes originated. `0aaa123` only mechanically converted both branches' `findIndex`-based checks to `.some(...)`, fixing this ticket's bug as a side effect while carrying the pre-existing any-pillar-scan pattern forward unchanged in both branches. WOW-026 fixes that older, still-live any-pillar-scan bug. See `src/context/hook/useAbletonContextProviderState.ts` (WOW-011's later context restructure moved this handler out of `AbletonProvider.tsx`).

---

- ID: WOW-013
- Title: Harden sim import-guard against side-effect imports
- Summary: The import-guard regex in `sim/test/import-guard.test.ts` matches `import ... from '<mod>'` but not bare side-effect imports (`import 'node-osc'`), which today fail the suite only indirectly via module resolution. Extend the regex to catch side-effect imports (and `require(...)`), with a bite-proof documented in the test. Found during WOW-011 PR 3 bite-proofing (`docs/agent-notes/wow-011-test-engineer-enforcement.md`).
- Allowed files: `sim/test/import-guard.test.ts`
- Risk: low (test-only)
- Dependencies: WOW-011 stack merged.
