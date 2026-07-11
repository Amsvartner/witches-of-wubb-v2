# WOW-004 — frontend-ui-designer prompts

Ticket: WOW-004 — UI audit report (read-only)
Role profile: `.claude/agents/frontend-ui-designer.md` (read first, plus `AGENTS.md` in full)

Regenerated 2026-07-11 against the post-WOW-011 tree (folders renamed `components`→`component`, `contexts`→`context`, `hooks`→`hook`, `lib`→`util`; PascalCase files; logic moved into `src/container/` and `src/screen/`; context split into Context/Provider/hook files). Supersedes the 2026-07-10 version, which referenced the pre-migration layout.

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
- `src/context/hook/useAbletonContextProviderState.ts`, `src/context/hook/useSocketContextProviderState.ts` — where socket events are consumed (post-migration, event handling lives in these provider-state hooks, not the provider components)
- `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md` — simulator contract-fidelity table (authoritative list of events the UI can receive)

Allowed files:

- `docs/UI_AUDIT.md` (new — primary deliverable)
- `docs/agent-notes/wow-004-frontend-ui-designer-audit.md` — handoff note

Disallowed files:

- **All of `src/**`\*\* — read everything, change nothing (acceptance: "no fixes made")
- `backend/**`, `Arduino/**`, `src/assets/Music Database.csv`, `.env`
- No design proposals — that is WOW-006; findings state problems, not solutions

Acceptance criteria (verbatim from ticket):

- Every file in `src/components|contexts|hooks` covered; recipe-removal blast radius listed; issues tagged severity; no fixes made.

> Migration note (annotation, not a change of criteria): the ticket predates the WOW-011 migration. The directories it names now correspond to `src/component`, `src/container`, `src/context` (including `context/hook`, `context/type`, `context/util`), `src/hook`, and `src/screen`. "Every file covered" means every non-test file in those directories — the exact inventory below.

Ticket-specific guidance:

- Exact file inventory to cover (19 files — verify against the tree before finishing; every file gets its own section):
  - `src/component/`: `ClipButton.tsx`
  - `src/container/`: `CurrentlyPlayingListContainer.tsx`, `DebugModalContainer.tsx`, `KeyAdjusterContainer.tsx`, `RecipeBoxContainer.tsx`, `TempoSliderContainer.tsx`, `VolumeSliderContainer.tsx`
  - `src/context/`: `AbletonContext.ts`, `AbletonProvider.tsx`, `SocketContext.ts`, `SocketProvider.tsx`
  - `src/context/hook/`: `useAbletonContext.ts`, `useAbletonContextProviderState.ts`, `useSocketContext.ts`, `useSocketContextProviderState.ts`
  - `src/context/type/`: `AbletonContextState.ts`
  - `src/context/util/`: `ContextUtils.ts`
  - `src/hook/`: `useGrimoire.ts`
  - `src/screen/`: `MainScreen.tsx`
  - Reference `src/main.tsx`, `src/util/` (`ClipDatabaseUtil.ts`, `ColorUtil.ts`, `Logger.ts`), and `src/type/SpellRecipeType.ts` where needed for composition/context, but the coverage requirement is the inventory above. Colocated `test/` folders are out of the coverage requirement; cite them as evidence where useful.
- Per file, catalog: rendered states, socket events consumed/emitted (name + payload fields actually used), context dependencies, and failure/disconnect behavior (what renders when the socket is down, acks never resolve, or payloads are partial — trace what `SocketProvider.tsx` provides before connect and what that does downstream in `useSocketContextProviderState.ts` consumers).
- **Display target**: assess the layout at 1024×1280 portrait touch (resize `yarn dev` viewport). Note overflow, scaling, touch-target sizes (WCAG 2.5.5/2.5.8), and anything mouse-only (hover, drag precision on sliders).
- **A11y**: contrast, focus/keyboard access, labels/roles, text scaling, photosensitivity-adjacent animation. Severity-tag every issue (blocker / high / medium / low) with file:line evidence.
- **Visitor vs. operator mapping** (ADR-003): for each component/state, say which page it belongs on, both, or neither (candidate for removal). Flag anything that assumes a single combined page. `DebugModalContainer.tsx` is operator-only surface — note how it is currently reached vs. ADR-006.
- **Recipe-removal blast radius**: everything touched by removing the recipe section — `RecipeBoxContainer.tsx`, `useGrimoire.ts`, their coupling to `CurrentlyPlayingListContainer.tsx`, any context/util code that exists only to serve them (e.g. `recommendedClips` plumbing in `src/util/ClipDatabaseUtil.ts` and `src/type/SpellRecipeType.ts`), plus layout space the removal frees in `MainScreen.tsx`. Note that live `ingredient_detected` payloads carry **no** `recommendedClips` (enrichment disabled in the real backend — see the WOW-003 fidelity table), so document what the grimoire actually does with `undefined` today.
- Drive real states with the offline simulator (WOW-003, merged): `yarn sim full-spell` + `yarn dev` for the happy path; `yarn sim idle` + the debug panel for manual control; kill the sim mid-session to observe disconnect behavior. Say which method (runtime vs. static) you used per finding.
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

- Date: 2026-07-11
- Executor: frontend-ui-designer subagent / claude-sonnet-5 (max reasoning effort)
- Branch: `docs/wow-004-ui-audit`, head SHA at run start: `a4c3a32`
- Outcome: complete. `docs/UI_AUDIT.md` covers all 19 inventoried files (verified no drift against the tree), recipe-removal blast radius, socket-event consumption table, display-target assessment at 1024×1280 (runtime, via `yarn sim full-spell`/`yarn sim idle` + `yarn dev`), visitor/operator mapping, and a 4-item open-questions appendix. `yarn lint` and `yarn test` both green. No `src/**`/`backend/**` files touched.
- Note path: `docs/agent-notes/wow-004-frontend-ui-designer-audit.md`
