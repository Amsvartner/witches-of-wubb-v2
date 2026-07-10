# WOW-011 — test-engineer prompts

Ticket: WOW-011 — Coding-guidelines conventions migration
Role profile: `.claude/agents/test-engineer.md` (read first, plus `AGENTS.md` in full)
Delivery: **PR 3 of the 3-PR stack** (tests + enforcement — migration step 7 remainder + step 8). Lands last, after PRs 1 and 2, so the new lint rules validate the fully migrated tree.

## Prompt 1 — test migration + ESLint enforcement (PR 3)

Goal:

Move the remaining `spec/` suite into colocated `test/` folders, retire `spec/`, and add the ESLint rules that enforce the mechanical conventions — leaving the whole tree green under the new rules with **zero behavioral change**.

Context files:

- `AGENTS.md` — binding contract (this PR does not touch `backend/` logic; test moves for backend-adjacent suites are allowed files-wise per the ticket)
- `docs/CODING_GUIDELINES.md` — "Testing", "Formatting / linting", "Migration" steps 7–8
- `docs/TICKETS_001_INITIAL.md` — WOW-011 definition
- `spec/**` — remaining suites after PR 1 (`spec/sim/*.spec.ts`, `spec/setup-tests.ts`); note `spec/sim/import-guard.spec.ts` **must survive the move intact** — it enforces the sim's no-hardware-imports invariant
- `vite.config.ts` — hardcodes `setupFiles: ['spec/setup-tests.ts']` and test includes; both must follow the move
- `.eslintrc` — currently has `@typescript-eslint/no-explicit-any: "off"`; existing plugins (`eslint-plugin-import`, `@typescript-eslint`) suffice for the new rules — no new packages expected

Allowed files:

- `spec/**` — moves out and deletion of the emptied folder
- New colocated `test/` folders (e.g. `sim/core/test/`, or next to whatever each suite tests)
- `vite.config.ts` — setupFiles/include updates
- `.eslintrc` — enforcement rules
- Migrated source files — ONLY for removing remaining `any` and commented-out code (step 8) and whatever the new lint rules flag
- Docs/README/skills stale-`spec/` references
- `docs/agent-notes/wow-011-test-engineer-enforcement.md` — handoff note

Disallowed files:

- `src/assets/Music Database.csv`, `Arduino/**`, `.env`, `package.json` dependency sections, lockfiles
- Any behavioral edit to `backend/` or `sim/core` logic — if removing an `any` requires changing runtime behavior rather than adding a type, stop and ask

Acceptance criteria (verbatim from ticket — this PR's share):

- `yarn lint` and `yarn test` green after each PR in the stack; full test suite migrated to and passing from colocated `test/` folders (top-level `spec/` retired, vitest config updated, import-guard test still enforcing); no default exports, no `interface`, no `any` remaining in migrated code; ESLint rules enforcing the mechanical conventions added and passing; **zero behavioral change** — musical logic, timing, quantization, transposition tables, volume handling, the pillar IP map, and all emitted OSC/MIDI/Art-Net/socket payloads byte-for-byte equivalent; **socket.io event names frozen** (no additions/renames/removals); all stale file-path references in AGENTS.md/docs updated in the same PR as the move; human-verifiable demo without hardware: `yarn sim` + `yarn dev` still drives the UI end-to-end exactly as before.

(PR 3 owns: the test-migration items, `spec/` retirement, vitest config, ESLint rules, no-`any`/no-commented-out-code cleanup, and stale-`spec/`-path docs updates.)

Ticket-specific guidance:

- Step 7: rename `.spec.ts(x)` → `.test.ts(x)` and colocate per guidelines (tests in a `test/` folder next to the code under test — `sim/core/test/simulator.test.ts` etc.). `setup-tests.ts` moves to wherever vitest config points (keep it one shared setup file). The **import-guard test** must keep guarding the same invariant from its new location — verify it still fails when it should (temporarily break it locally to prove it bites, then restore).
- Step 8 lint rules (config-only, existing plugins): `import/no-default-export`, `@typescript-eslint/consistent-type-definitions: ["error", "type"]`, re-enable `@typescript-eslint/no-explicit-any`. Add others from the guidelines' mechanical set only if they pass on the migrated tree without behavior edits.
- If re-enabling `no-explicit-any` flags an `any` that cannot be typed without changing runtime behavior, use `unknown` + narrowing where safe; otherwise stop and ask — do not sprinkle `eslint-disable`.
- Update every doc/skill that references `spec/` paths (AGENTS.md scope line, README, `.claude/skills/**` if they cite spec paths) in this PR.
- Verify test count parity: same number of tests (48 at ticket-writing time, plus whatever PRs 1–2 added) passing before and after the move.

Forbidden scope:

- No new test dependencies (dependency-approval rule). No weakening/deleting tests to satisfy lint. No `describe.skip`/`it.skip`. No behavioral changes.

Required tests/checks:

- `yarn lint`, `yarn test`, `yarn build`, `yarn coverage` (confirm coverage collection still works from new paths); `git diff --check`.
- Prove the import-guard test still bites (documented in the note).
- Simulator smoke: `yarn sim` + `yarn dev`.

Hardware/audio/LED/RFID safety notes:

- No test may open real network connections, spawn the real backend, or emit OSC/Art-Net. Never `yarn start-backend`. The import-guard invariant is itself a safety control — treat its migration as safety-relevant.

Human-verifiable demo (required in handoff note):

- `yarn test` output showing the full suite green from new locations; `yarn lint` green with the new rules listed; `yarn sim` + `yarn dev` scenario behaving as before.

Stop conditions:

- Existing tests fail for pre-existing reasons → report, don't fix inline.
- A lint rule requires a new plugin dependency → stop and ask.
- An `any` removal requires runtime changes → stop and ask.
- Coverage of a behavior would need live hardware → document, hand to human.

Output:

- Handoff note at `docs/agent-notes/wow-011-test-engineer-enforcement.md` (standard format): move map, test-count parity before/after, lint rules added, import-guard bite-proof, docs updated.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, outcome, note path._
