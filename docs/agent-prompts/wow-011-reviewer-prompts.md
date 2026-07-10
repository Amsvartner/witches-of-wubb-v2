# WOW-011 — reviewer prompts

Ticket: WOW-011 — Coding-guidelines conventions migration
Role profile: `.claude/agents/reviewer.md` (read first, plus `AGENTS.md` in full). Read-only — no code edits.
Delivery: one review per PR in the 3-PR stack. Shared ground rules below; per-PR focus in each prompt.

Shared ground rules (all three reviews):

- Ground truth: `docs/CODING_GUIDELINES.md` v1.0, WOW-011 in `docs/TICKETS_001_INITIAL.md`, `AGENTS.md` v0.4 (incl. the conventions-migration exception).
- The ticket's core invariant is **zero behavioral change**. Verify it, don't take the PR body's word: `git diff` review confirming moves are renames not rewrites (`-M` stats), and grep-level checks that emitted event-name strings and payload shapes are unchanged.
- Per the reviewer profile: legacy files not yet migrated are grandfathered — but inside THIS ticket's PRs, unconverted files that the PR claims to cover are findings.
- Scope discipline cuts both ways here: "while we're here" cleanups beyond the 8 migration steps are scope creep; so is piecemeal migration of files assigned to a different PR of the stack.
- Safe checks you may run: `yarn lint`, `yarn test`, `yarn build`, `git diff --check`, `yarn sim` + `yarn dev`. Never `yarn start-backend`.
- Verdict note per review: findings grouped blocking / should-fix / nit with file:line; explicit **approve / approve-with-nits / block**; PR body must fill the template completely and target the fork (`Amsvartner/witches-of-wubb-v2`).

Acceptance criteria to verify (verbatim from ticket, across the stack):

- `yarn lint` and `yarn test` green after each PR in the stack; full test suite migrated to and passing from colocated `test/` folders (top-level `spec/` retired, vitest config updated, import-guard test still enforcing); no default exports, no `interface`, no `any` remaining in migrated code; ESLint rules enforcing the mechanical conventions added and passing; **zero behavioral change** — musical logic, timing, quantization, transposition tables, volume handling, the pillar IP map, and all emitted OSC/MIDI/Art-Net/socket payloads byte-for-byte equivalent; **socket.io event names frozen** (no additions/renames/removals); all stale file-path references in AGENTS.md/docs updated in the same PR as the move; human-verifiable demo without hardware: `yarn sim` + `yarn dev` still drives the UI end-to-end exactly as before.

## Prompt 1 — review PR 1 (frontend sweep)

Goal: strict diff review of the frontend sweep (steps 1, 2, 6 + `App.spec.tsx` move).

Checklist (ticket-specific):

1. **Scope:** only `src/**`, the `App.spec.tsx` move, config tweaks forced by renames, and stale-path doc updates for moved `src/` files. `backend/**`, `.eslintrc` rules, `spec/sim/**` untouched (`git diff --stat` empty on those paths).
2. **Renames, not rewrites:** `git diff main --stat -M` shows high-similarity renames; spot-check the largest components line-by-line for smuggled logic edits.
3. **Conventions:** PascalCase files, singular folders, no default exports remain in `src/`, `const` arrow components with typed `Props`, page/container/component placement matches the guidelines' definitions (presentational components have no context reads/composition).
4. **Zero behavior:** socket event strings, context value shapes, prop semantics, Tailwind classes unchanged; no dependency or `package.json` changes.
5. **Green:** lint/test/build pass; simulator demo steps in the handoff note work.
6. **Docs:** PRD F4/DECISIONS_NEEDED `src/lib/utils.ts` reference updated; handoff note has the rename map.

Output: `docs/agent-notes/wow-011-reviewer-verdict-pr1.md`.

### Prompt 1 — run record

_Append after execution: date, executor, branch + head SHA, verdict, note path._

## Prompt 2 — review PR 2 (backend sweep)

Goal: strict diff review of the backend restructure (steps 3, 4, 5). This is the safety-gated diff — your review runs **in addition to**, not instead of, the mandatory audio-ableton-reviewer and hardware-safety-reviewer sign-offs; verify both are requested/recorded before any approve verdict.

Checklist (ticket-specific):

1. **Authorization:** changes stay within the AGENTS.md v0.4 exception — structure/naming only. Any value/ordering/timing/payload change is a **block**, full stop.
2. **Equivalence, verified independently:** rebuild the emitted event-name + OSC-address inventory yourself (grep old tree vs. new) and compare with the implementer's table; transposition table, pillar IP map, timeout values, volume defaults survive character-for-character.
3. **Frozen contract:** socket.io event names identical set; ack-vs-no-ack semantics untouched.
4. **Layering:** adapters hold ALL ableton-js/OSC/Art-Net/network I/O; services pure; event handlers thin; no logic split/reordered across the moves (ticket stop-condition — if the implementer did it anyway, block).
5. **Type split:** `backend/type/` one type per file incl. `Maybe.ts`; every `backend/types` import site in `src/`/`sim/` updated; no duplicated type definitions.
6. **Naming/exports:** camelCase functions, namespace-object exports per guidelines; `backend/package.json`/lockfiles untouched.
7. **Docs:** AGENTS.md safety-rule paths (`key-transpositions`, `incoming-events`) and project-context paths updated in this same PR.
8. **Green:** lint/test/build; simulator smoke.

Output: `docs/agent-notes/wow-011-reviewer-verdict-pr2.md`. Required follow-up reviewers: audio-ableton-reviewer + hardware-safety-reviewer (mandatory, per ticket).

### Prompt 2 — run record

_Append after execution: date, executor, branch + head SHA, verdict, note path._

## Prompt 3 — review PR 3 (tests + enforcement)

Goal: strict diff review of the test migration and ESLint enforcement (steps 7, 8).

Checklist (ticket-specific):

1. **Test parity:** every `spec/` suite accounted for in a colocated `test/` folder; test count before vs. after matches the handoff note; no skipped/deleted/weakened tests; `spec/` fully retired; vitest config (`setupFiles`, includes, coverage) follows.
2. **Import guard:** the migrated import-guard test still enforces the sim's no-hardware-imports invariant — check the note's bite-proof, and read the test to confirm its glob/paths still cover `sim/**` from the new location.
3. **Lint rules:** `import/no-default-export`, `consistent-type-definitions: type`, `no-explicit-any` re-enabled — config-only, no new plugins/dependencies; no `eslint-disable` sprinkled to force green.
4. **Cleanup scope:** `any`-removal edits are type-level only (annotations, `unknown` + narrowing); flag anything touching runtime expressions.
5. **Docs:** stale `spec/` references gone from AGENTS.md/README/skills.
6. **Green:** lint (with new rules), test, build, coverage all pass; simulator smoke.

Output: `docs/agent-notes/wow-011-reviewer-verdict-pr3.md`.

Stop conditions (all prompts):

- Diff exceeds its PR's slice of the stack or intent can't be matched to WOW-011 → block, ask.
- Any behavioral delta, however small → block with file:line.
- Docs contradict each other on a path/convention → Decision needed rather than guessing.

### Prompt 3 — run record

_Append after execution: date, executor, branch + head SHA, verdict, note path._
