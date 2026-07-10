# WOW-011 — frontend-implementer prompts

Ticket: WOW-011 — Coding-guidelines conventions migration
Role profile: `.claude/agents/frontend-implementer.md` (read first, plus `AGENTS.md` in full)
Delivery: **PR 1 of the 3-PR stack** (frontend sweep — migration steps 1, 2, 6 + `spec/App.spec.tsx` move). PRs merge in order; this one lands first.

## Prompt 1 — frontend conventions sweep (PR 1)

Goal:

Bring `src/` in line with `docs/CODING_GUIDELINES.md` v1.0 — file/folder renames, export conversion, and the `page > container > component` restructure — with **zero behavioral change**. The UI must render and behave exactly as before.

Context files:

- `AGENTS.md` — binding contract; note the "Exception — conventions migration (2026-07-10)" scope block (this PR does NOT use the backend exception — `backend/` stays untouched in PR 1)
- `docs/CODING_GUIDELINES.md` — the conventions being applied, especially "Naming conventions", "Exports", "Architecture layers > Frontend", and "Migration" steps 1, 2, 6
- `docs/TICKETS_001_INITIAL.md` — WOW-011 definition (acceptance criteria, PR-stack rationale)
- `docs/UI_AUDIT.md` (if present) — component inventory
- `src/**` — the code being migrated; `spec/App.spec.tsx` — the test that moves with it

Allowed files:

- `src/**` — renames (`components`→`component`, `contexts`→`context`, `hooks`→`hook`, `lib`→`util`; files to `PascalCase.tsx`/hook names), export conversion, `page/`/`container/` introduction
- `spec/App.spec.tsx` → colocated `src/**/test/App.test.tsx` (and its imports)
- `vite.config.ts` / `tsconfig.json` — only if a rename forces a path/include tweak
- Docs stale-path updates for files moved in THIS PR (known: `src/lib/utils.ts` `getBackgroundColorFromType` referenced in PRD F4/DECISIONS_NEEDED; `spec/` mentions that concern `App.spec.tsx`)
- `docs/agent-notes/wow-011-frontend-implementer-sweep.md` — handoff note

Disallowed files:

- `backend/**` (PR 2's job — the AGENTS.md exception is invoked there, not here), `sim/**`, `spec/sim/**`, `spec/setup-tests.ts` (PR 3)
- `.eslintrc` enforcement rules (PR 3)
- `src/assets/Music Database.csv`, `Arduino/**`, `.env`, `package.json` dependencies

Acceptance criteria (verbatim from ticket — this PR's share):

- `yarn lint` and `yarn test` green after each PR in the stack; full test suite migrated to and passing from colocated `test/` folders (top-level `spec/` retired, vitest config updated, import-guard test still enforcing); no default exports, no `interface`, no `any` remaining in migrated code; ESLint rules enforcing the mechanical conventions added and passing; **zero behavioral change** — musical logic, timing, quantization, transposition tables, volume handling, the pillar IP map, and all emitted OSC/MIDI/Art-Net/socket payloads byte-for-byte equivalent; **socket.io event names frozen** (no additions/renames/removals); all stale file-path references in AGENTS.md/docs updated in the same PR as the move; human-verifiable demo without hardware: `yarn sim` + `yarn dev` still drives the UI end-to-end exactly as before.

(PR 1 owns: `src/` renames/exports/hierarchy, `App.spec.tsx` move, no default exports/`interface` in `src/`, stale-path docs updates for moved `src/` files. The backend equivalence items, `spec/sim` moves, and ESLint rules land in PRs 2–3.)

Ticket-specific guidance:

- Steps in scope: (1) rename component/hook/context files to `PascalCase`, folders to singular; (2) named exports replace default exports, `function` components become `const` arrow components with typed `Props`; (6) introduce `src/page/` + `src/container/` and move logic-bearing components accordingly (per guidelines: components that use context/compose others become containers; a thin `InstallationPage`-style page composes them).
- Use `git mv` so history shows renames, not delete+add.
- Every import site updates in the same commit as the rename — the tree must build at every commit if practical, and MUST build at the PR head.
- `export default function TempoSlider()` → `export const TempoSlider = (...): JSX.Element =>`; update `main.tsx`/`App.tsx` imports accordingly.
- Do not rename socket event strings, context value shapes, or prop semantics — renaming FILES and EXPORTS only. If a rename would force a behavior-adjacent edit, stop and ask.
- Do not add `Maybe<T>` usages yet — `Maybe.ts` is created in PR 2 (`backend/type/`); annotate nothing new in this PR.

Forbidden scope:

- Any behavioral/logic change, however small; no "while we're here" cleanups beyond steps 1, 2, 6 (removal of `any`/commented-out code is PR 3).
- No new/renamed socket.io events; no dependency changes; no Tailwind/styling changes.

Required tests/checks:

- `yarn lint`, `yarn test`, `yarn build` green; `git diff --check`.
- Simulator smoke: `yarn sim` + `yarn dev`, run a scenario, confirm the UI behaves identically.
- `git log --stat --find-renames` (or `git diff main --stat -M`) showing moves detected as renames.

Hardware/audio/LED/RFID safety notes:

- Frontend-only PR; still, never run `yarn start-backend`. No changes that affect volume/LED/OSC paths are possible from this file set — keep it that way.

Human-verifiable demo (required in handoff note):

- Exact steps: `yarn sim` (scenario) + `yarn dev`; observe the UI is pixel-identical and interactive as before (tempo slider, volume, key adjuster, ingredient add/remove via scenario).

Stop conditions:

- A rename cannot be completed without changing behavior or payloads → stop and ask.
- A component resists clean page/container/component classification without splitting logic → stop and ask rather than restructure logic.
- Two docs contradict on a path or convention → Decision needed.

Output:

- Handoff note at `docs/agent-notes/wow-011-frontend-implementer-sweep.md` (standard AGENTS.md handoff format) including a rename map (old path → new path), the export-conversion list, and demo steps.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, outcome, note path._

- 2026-07-10 — executor: Claude Fable 5 (frontend-implementer role, /ship-feature pipeline) — branch `feat/wow-011-frontend-sweep`, head `fcf78ccd7ebab499d3ec0a766f0b3d563dece772`, PR https://github.com/Amsvartner/witches-of-wubb-v2/pull/7 — outcome: steps 1/2/6 implemented, 16-file rename map, lint/test/build green (48/48), simulator demo verified in browser (identical UI, no console errors). Note: `docs/agent-notes/wow-011-frontend-implementer-sweep.md`.
