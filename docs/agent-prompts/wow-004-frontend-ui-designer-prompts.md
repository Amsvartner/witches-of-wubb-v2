# WOW-004 — frontend-ui-designer prompts

Ticket: WOW-004 — UI audit report (read-only)
Role profile: `.claude/agents/frontend-ui-designer.md` (read first, plus `AGENTS.md` in full)

## Prompt 1 — author the UI audit report

Goal:

Produce `docs/UI_AUDIT.md`: a complete, severity-tagged audit of the current UI ahead of the rework — components/states/socket events consumed, failure/disconnect behavior, a11y issues, fitness for the real display target (**1024×1280 portrait touch**), visitor-page vs. operator-page mapping, and the full blast radius of removing the recipe section. Audit only — you change no code.

Context files:

- `AGENTS.md` — binding contract (safety rules, git rules, handoff format)
- `docs/TICKETS_001_INITIAL.md` — WOW-004 definition
- `docs/PRD.md`, `docs/UX_UI_PRINCIPLES.md` — what the rework is aiming at (audit findings should be actionable against these)
- `docs/adr/003-ui-audience-display-two-pages.md` — visitor page vs. operator page split (drives the inventory mapping)
- `docs/adr/006-operator-access-gesture.md` — how the operator surface is reached
- `docs/ARCHITECTURE.md` — system context; socket contract summary
- `src/contexts/ableton-provider.tsx`, `src/contexts/socketio-provider.tsx` — where every socket event is consumed
- `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md` — simulator contract-fidelity table (authoritative list of events the UI can receive)

Allowed files:

- `docs/UI_AUDIT.md` (new — the only deliverable)
- `docs/agent-notes/wow-004-frontend-ui-designer-audit.md` — handoff note

Disallowed files:

- **All of `src/**`** — read everything, change nothing (acceptance: "no fixes made")
- `backend/**`, `Arduino/**`, `src/assets/Music Database.csv`, `.env`
- No design proposals — that is WOW-006; findings state problems, not solutions

Acceptance criteria (verbatim from ticket):

- Every file in `src/components|contexts|hooks` covered; recipe-removal blast radius listed; issues tagged severity; no fixes made.

Ticket-specific guidance:

- Exact file inventory to cover (verify against the tree before finishing — every file gets its own section):
  - `src/components/`: `currently-playing-list.tsx`, `debug.tsx`, `key-adjuster.tsx`, `recipe-box.tsx`, `tempo-slider.tsx`, `volume-slider.tsx`
  - `src/contexts/`: `ableton-provider.tsx`, `logger-provider.tsx`, `socketio-provider.tsx`
  - `src/hooks/`: `use-grimoire.ts`
  - Reference `src/App.tsx` and `src/lib/` where needed for composition/context, but the coverage requirement is the three directories above.
- Per file, catalog: rendered states, socket events consumed/emitted (name + payload fields actually used), context dependencies, and failure/disconnect behavior (what renders when the socket is down, acks never resolve, or payloads are partial — e.g. `socketio-provider.tsx` renders children with an empty `{}` socket before connect; trace what that does downstream).
- **Display target**: assess the layout at 1024×1280 portrait touch (resize `yarn dev` viewport). Note overflow, scaling, touch-target sizes (WCAG 2.5.5/2.5.8), and anything mouse-only (hover, drag precision on sliders).
- **A11y**: contrast, focus/keyboard access, labels/roles, text scaling, photosensitivity-adjacent animation. Severity-tag every issue (blocker / high / medium / low) with file:line evidence.
- **Visitor vs. operator mapping** (ADR-003): for each component/state, say which page it belongs on, both, or neither (candidate for removal). Flag anything that assumes a single combined page. `debug.tsx` is operator-only surface — note how it is currently reached vs. ADR-006.
- **Recipe-removal blast radius**: everything touched by removing the recipe section — `recipe-box.tsx`, `use-grimoire.ts`, their coupling to `currently-playing-list.tsx`, any context/lib code that exists only to serve them (e.g. `recommendedClips` plumbing in `src/lib/database-output.ts` / types), plus layout space the removal frees. Note that live `ingredient_detected` payloads carry **no** `recommendedClips` (enrichment disabled in the real backend — see the WOW-003 fidelity table), so document what the grimoire actually does with `undefined` today.
- Drive real states with the offline simulator (after WOW-003 merges): `yarn sim full-spell` + `yarn dev` for the happy path; `yarn sim idle` + the debug panel for manual control; kill the sim mid-session to observe disconnect behavior. If WOW-003 is not merged yet, audit statically plus `yarn dev` with no backend (the disconnect state is itself a finding) — and say which method you used per finding.
- Structure `docs/UI_AUDIT.md` with: summary table (file × issues × severity), per-file sections, socket-event consumption table, display-target assessment, visitor/operator inventory, recipe-removal blast radius, and an appendix of open questions.

Forbidden scope:

- No code changes, no fixes, no refactors, no design proposals or mockups.
- No new decisions about the rework — unknowns become TBDs, not choices.

Required tests/checks:

- May run `yarn dev` (UI only) and `yarn test`; `yarn lint` before handoff (the audit adds no lintable files, but the tree must stay green).
- `git diff --stat` must show only `docs/UI_AUDIT.md`, `docs/agent-notes/wow-004-frontend-ui-designer-audit.md`, and the run-record append to `docs/agent-prompts/wow-004-frontend-ui-designer-prompts.md`.
Hardware/audio/LED/RFID safety notes:

- **Never run `yarn start-backend`** (connects to live Ableton + lighting). The simulator (`yarn sim`) is the only backend you may run.
- CSV read-only.

Human-verifiable demo (required in handoff note):

- The deliverable is the report itself: point the human at `docs/UI_AUDIT.md`'s summary table. For the top 3 findings, include exact reproduction steps using only `yarn sim <scenario>` + `yarn dev` (or static file:line references where no runtime repro exists).

Stop conditions:

- A question answerable only against the live backend → log it as a TBD in the report, do not attempt to verify live (ticket stop condition).
- Ambiguity about visitor/operator product intent beyond ADR-003 → record in `docs/DECISIONS_NEEDED.md` format inside the report's open-questions appendix; do not invent intent.

Output:

- `docs/UI_AUDIT.md` (the report) and `docs/agent-notes/wow-004-frontend-ui-designer-audit.md` (standard handoff format from `AGENTS.md`: discoveries, files created, assumptions, questions for the human, validation run, suggested next prompt).

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, outcome, note path._
