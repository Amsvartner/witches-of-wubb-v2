# WOW-004 — architecture-reviewer prompts

Ticket: WOW-004 — UI audit report (read-only)
Role profile: `.claude/agents/architecture-reviewer.md` (read first, plus `AGENTS.md` in full). Read-only reviewer — never edits code; on this ticket you also do not edit `docs/UI_AUDIT.md` itself.

Regenerated 2026-07-11 against the post-WOW-011 tree (see the frontend-ui-designer prompt file header for the mapping). Supersedes the 2026-07-10 version.

## Prompt 1 — verify the audit's contract and boundary claims

Goal:

Independently verify the architecture-facing claims in `docs/UI_AUDIT.md` (produced by the frontend-ui-designer): the socket-event consumption table against the real contract, the failure/disconnect analysis against how the providers are actually wired, and the visitor/operator inventory against ADR-003/ADR-006. Flag every omission or misstatement; end with a verdict.

Context files:

- `AGENTS.md` — binding contract
- `docs/TICKETS_001_INITIAL.md` — WOW-004 definition
- `docs/UI_AUDIT.md` — the report under review
- `docs/agent-notes/wow-004-frontend-ui-designer-audit.md` — auditor's handoff
- `docs/ARCHITECTURE.md`, `docs/adr/003-ui-audience-display-two-pages.md`, `docs/adr/006-operator-access-gesture.md`, `docs/adr/004-frontend-only-scope.md`
- Ground truth for the event contract: `backend/event/IncomingEvents.ts`, `backend/event/OutgoingEvents.ts`, `backend/type/` (read-only), and the WOW-003 contract-fidelity table in `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md`
- The consumers: `src/context/hook/useAbletonContextProviderState.ts`, `src/context/hook/useSocketContextProviderState.ts`, `src/container/*.tsx`, `src/hook/useGrimoire.ts`, `src/screen/MainScreen.tsx`

Allowed files:

- `docs/agent-notes/wow-004-architecture-reviewer-audit-review.md` — your review note (the only file you may write)

Disallowed files:

- Everything else, including `docs/UI_AUDIT.md` — findings go in your note for the fix round, never edited in place by you.

Acceptance criteria (verbatim from ticket):

- Every file in `src/components|contexts|hooks` covered; recipe-removal blast radius listed; issues tagged severity; no fixes made.

> Migration note (annotation, not a change of criteria): post-WOW-011 these directories correspond to `src/component|container|context|hook|screen`; "every file" = the 19-file non-test inventory listed in the frontend-ui-designer prompt file.

Ticket-specific review checklist:

1. **Event catalog completeness**: every `socket.on`/`.emit` in `src/` (concentrated in `src/context/hook/useAbletonContextProviderState.ts`, `useSocketContextProviderState.ts`, and `src/container/DebugModalContainer.tsx`) appears in the report with correct event name, direction, and the payload fields the UI actually reads. Cross-check against the backend contract — flag any event the UI listens for that the backend never emits (dead listener) and any backend emission the UI ignores (unused contract surface); both are rework-relevant facts.
2. **Boundary discipline (ADR-004)**: confirm the report treats the socket contract as the frontend/backend boundary and proposes no contract changes; any "the backend should…" statement in an audit is drift — flag it.
3. **Disconnect/failure claims**: verify the report's description of pre-connect, disconnect, and never-resolving-ack behavior matches the actual wiring in `src/context/SocketProvider.tsx` + `useSocketContextProviderState.ts` and `src/context/AbletonProvider.tsx` + `useAbletonContextProviderState.ts` (the WOW-011/#10 restructure split each provider into Context/Provider/state-hook files — verify claims against where the logic actually lives now, not the pre-migration shape).
4. **Visitor/operator inventory vs. ADR-003/006**: mapping is complete (every component/state assigned), consistent with the two-page decision, and `DebugModalContainer.tsx` handling matches the operator-access-gesture ADR.
5. **Recipe-removal blast radius**: independently trace `RecipeBoxContainer.tsx` / `useGrimoire.ts` / `CurrentlyPlayingListContainer.tsx` coupling (imports, contexts, `src/util/` helpers such as `ClipDatabaseUtil.ts`, `src/type/SpellRecipeType.ts`, `src/context/type/AbletonContextState.ts`) and confirm the report's list is complete — a missed coupling here becomes a broken rework PR later.
6. **Coverage**: all 19 inventory files (1 component, 6 containers, 10 context files incl. hooks/type/util, 1 hook, 1 screen) have real content, not placeholders; issues carry severity tags and file:line evidence; the report makes no code changes anywhere (`git diff` shows docs only).

Required tests/checks (safe to run):

- `yarn lint`, `yarn test`, `git diff --check`. You may run `yarn dev` + `yarn sim <scenario>` (offline simulator only) to reproduce claims. **Never `yarn start-backend`.**

Stop conditions:

- A contract question answerable only against the live backend → flag as TBD, don't guess.
- The report is missing entirely or covers less than the acceptance list → verdict **block** with the gap list; do not write the missing content yourself.

Output:

- `docs/agent-notes/wow-004-architecture-reviewer-audit-review.md`: findings grouped blocking / should-fix / nit, each with report-section + file:line rationale; explicit final verdict — **approve / approve-with-nits / block**.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, verdict, note path._
