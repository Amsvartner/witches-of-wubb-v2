# WOW-011 — creative-tech-integrator prompts

Ticket: WOW-011 — Coding-guidelines conventions migration
Role profile: `.claude/agents/creative-tech-integrator.md` (read first, plus `AGENTS.md` in full)
Delivery: **PR 2 of the 3-PR stack** (backend sweep — migration steps 3, 4, 5). Lands after PR 1. **This PR requires sign-off from BOTH audio-ableton-reviewer AND hardware-safety-reviewer before merge** (AGENTS.md exception terms).

## Prompt 1 — backend structure/naming sweep (PR 2)

Goal:

Restructure `backend/` per `docs/CODING_GUIDELINES.md` v1.0 — camelCase functions, namespace-object exports, `backend/type/` split, and the `event/`/`service/`/`adapter/`/`util/` layering — with **zero behavioral change**: all emitted OSC/MIDI/Art-Net/socket payloads byte-for-byte equivalent, socket.io event names frozen.

Context files:

- `AGENTS.md` — **"Exception — conventions migration (2026-07-10)"** in "Scope of current phase" is the sole authorization for these backend edits; read its constraints verbatim. Physical-installation safety rules apply in full.
- `docs/CODING_GUIDELINES.md` — "Naming conventions", "Exports", "Architecture layers > Backend", "Shared types", "Migration" steps 3, 4, 5
- `docs/TICKETS_001_INITIAL.md` — WOW-011 definition
- `docs/ABLETON_INTEGRATION.md`, `docs/HARDWARE_INTEGRATION.md` — the contracts that must not drift
- `backend/**` — the code being migrated: `index.ts`, `ableton-api.ts`, `key-transpositions.ts`, `types.ts`, `events/incoming-events.ts`, `events/outgoing-events.ts`, `utils/*`
- `src/**`, `sim/**` — import sites of `backend/types` and other backend paths that must be updated

Allowed files:

- `backend/**` — under the AGENTS.md exception only: renames, moves into `event/`/`service/`/`adapter/`/`util/`/`type/`, export grouping. `backend/package.json`/lockfiles are **excluded**.
- `src/**`, `sim/**` — import-path updates only (no other frontend/sim edits)
- `tsconfig.json` path aliases if a move requires it
- `AGENTS.md` + `docs/**` + `README.md` — stale-path updates for files moved in THIS PR (known: `backend/types.ts` in AGENTS.md project context; `backend/key-transpositions.ts` and `backend/events/incoming-events.ts` in the AGENTS.md safety rules; any `backend/events/` references in ARCHITECTURE/skills)
- `docs/agent-notes/wow-011-creative-tech-integrator-backend.md` — handoff note

Disallowed files:

- `src/assets/Music Database.csv`, `Arduino/**`, `.env`, all `package.json` dependency sections, lockfiles
- `.eslintrc` (PR 3), remaining `spec/` moves (PR 3)
- The pillar IP map **values** in the incoming-events module: the map may move with its file, but its contents are untouchable (AGENTS.md safety rule)

Acceptance criteria (verbatim from ticket — this PR's share):

- `yarn lint` and `yarn test` green after each PR in the stack; full test suite migrated to and passing from colocated `test/` folders (top-level `spec/` retired, vitest config updated, import-guard test still enforcing); no default exports, no `interface`, no `any` remaining in migrated code; ESLint rules enforcing the mechanical conventions added and passing; **zero behavioral change** — musical logic, timing, quantization, transposition tables, volume handling, the pillar IP map, and all emitted OSC/MIDI/Art-Net/socket payloads byte-for-byte equivalent; **socket.io event names frozen** (no additions/renames/removals); all stale file-path references in AGENTS.md/docs updated in the same PR as the move; human-verifiable demo without hardware: `yarn sim` + `yarn dev` still drives the UI end-to-end exactly as before.

(PR 2 owns: the zero-behavioral-change/byte-for-byte items, frozen event names, `backend/` structure, `backend/type/` split incl. `Maybe.ts`, and the backend-path docs updates.)

Ticket-specific guidance:

- Step 3: backend PascalCase functions → `camelCase` (`QueueClip`→`queueClip`, `StartAbleton`→`startAbleton`, …); group each module's exports behind a namespace object per guidelines (`AbletonService`, `CsvUtil`, …). Grouped functions become module-private `const`s.
- Step 4: split `backend/types.ts` into `backend/type/` (one exported type per file, file named after the type); add `backend/type/Maybe.ts`. Update every `from 'backend/types'` import in `src/` and `sim/`.
- Step 5: restructure into `backend/event/` (thin socket handlers), `backend/service/` (musical/business rules: clip selection, phrase-leader, key transposition, tempo policy), `backend/adapter/` (ALL ableton-js/OSC/Art-Net/network I/O), `backend/util/` (pure helpers, logger). Moving code between files is allowed; splitting or reordering logic is not — if a file resists clean classification without splitting logic, stop and ask (ticket stop condition).
- Use `git mv`; keep renames detectable. Prefer one commit per step (3, 4, 5) so reviewers can verify each mechanically.
- Equivalence proof is part of the deliverable: for each moved handler, the handoff note carries a table (event name → old file:line → new file:line → payload shape unchanged ✓). Grep the full diff for every emitted event-name string and OSC address; the string set before and after must be identical.

Forbidden scope:

- ANY change to values, ordering, timing, quantization, transposition tables, volume handling, or payload contents — grounds for rejection, not discussion.
- No new/renamed/removed socket.io events or OSC addresses. No dependency changes. No logic "simplifications" while moving code.
- `sim/core` logic changes (import paths only).

Required tests/checks:

- `yarn lint`, `yarn test`, `yarn build` green; `git diff --check`.
- Simulator smoke: `yarn sim` + `yarn dev`, run a scenario.
- Event-name/payload equivalence grep: diff the emitted-string inventory old vs. new (document command + output in the note).
- `git diff main --stat -M` confirming moves register as renames.
- **Never run `yarn start-backend`** — equivalence is proven by reading, grepping, and the test suite, never by contacting Ableton/hardware.

Hardware/audio/LED/RFID safety notes:

- This is the safety-gated PR of the stack. The AGENTS.md physical-installation rules apply in full. Structure and naming only. The transposition table contents, pillar IP map, timeout values, volume defaults, and quantization settings must survive character-for-character.
- Requires **both audio-ableton-reviewer and hardware-safety-reviewer sign-off before merge** — request both reviews in the PR; the gate fails without them.

Human-verifiable demo (required in handoff note):

- `yarn sim` + `yarn dev`, run a scenario, observe identical UI behavior. Plus: point the human at the equivalence table so they can spot-check one event end-to-end without reading the whole diff.

Stop conditions:

- Any step cannot be completed without changing behavior, payloads, or event names → stop and ask.
- A `backend/` file resists clean classification into `event/`/`service/`/`adapter/`/`util/` without splitting logic → stop and ask.
- Anything touching the CSV, pillar IP map values, or Arduino → stop.
- Two docs contradict on a path or convention → Decision needed.

Output:

- Handoff note at `docs/agent-notes/wow-011-creative-tech-integrator-backend.md` (standard format) including: rename map, the per-event equivalence table, the grep inventory command/output, and the docs-path updates made.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, outcome, note path._
