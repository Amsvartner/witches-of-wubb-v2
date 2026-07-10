# WOW-011 — reviewer verdict (PR 3: tests + enforcement)

Reviewer: Claude Fable 5 (reviewer subagent, read-only)
Date: 2026-07-10
Review target: `git diff feat/wow-011-backend-sweep...feat/wow-011-tests-enforcement` — PR https://github.com/Amsvartner/witches-of-wubb-v2/pull/9, head `d76a06b`, stacked on PR #8 (since merged to `main`; three-dot diff from the merge base remains the correct review target).
Checklist: `docs/agent-prompts/wow-011-reviewer-prompts.md` — Prompt 3.

## Verdict

**Approve-with-nits**, conditional on one process item (should-fix 1) and one specialist spot-check (should-fix 2) before the gate. No blocking findings. Zero behavioral change independently verified.

## What was verified (evidence, not assertion)

1. **Test parity.** Base branch (`feat/wow-011-backend-sweep`): `yarn test` = 48 tests / 6 files. PR branch: 52 / 8 — exactly the sanctioned +4 (`src/util/test/ColorUtil.test.ts`, `src/util/test/ClipDatabaseUtil.test.ts`, the PR 1 test-review Recommended item). All five `spec/sim/*` suites and `setup-tests.ts` accounted for; `git ls-tree` shows zero `spec/` paths remaining. Content diff of every moved suite against `origin/main` originals: **identical except the single `'../../sim/core'` → `'../core'` import line**; `setup-tests.ts` byte-identical. No test skipped, weakened, or deleted. `vite.config.ts` `setupFiles` updated to `src/test/setup-tests.ts`.
2. **Import guard.** `sim/test/import-guard.test.ts` is **byte-identical** to `origin/main:spec/sim/import-guard.spec.ts` (`git diff` exit 0). It scans from `path.join(process.cwd(), 'sim')`, so the new location changes nothing — all of `sim/**` (now including the tests themselves) stays in scope, and the `simFiles.length > coreFiles.length` sanity assertion still holds. The handoff's bite-proof (socket.io-client injected into `sim/core/types.ts` → checks 3 + 4 fire) is credible: check 4 rejects any non-relative specifier and check 3 matches `/socket\.io/`. The documented regex gap (bare side-effect imports like `import 'node-osc';` lack a `from` clause and escape the pattern) is real, pre-existing, and correctly scoped out as follow-up.
3. **Lint rules.** `.eslintrc`: `no-explicit-any` off→error, `consistent-type-definitions: ["error","type"]`, `import/no-default-export: "error"` — config-only, plugins array unchanged (reformatted only), no `package.json`/lockfile changes anywhere in the diff. Single override (`import/no-default-export` off) limited to `vite.config.ts` + `**/*.d.ts`, both genuine tool requirements. Grep of the full diff: **zero new `eslint-disable` comments** (the three hits are pre-existing lines in context / the handoff note's own text). Tree-wide grep on the PR branch: no `any`, no `interface`, no default exports outside the two sanctioned files.
4. **Any-removal is runtime-equivalent — read line-by-line.**
   - All 16 `updateIndex.bind(null, i, v)` → `(current) => updateIndex(i, v, current)` sites in `src/context/AbletonProvider.tsx` (counted: 1+1+1+3+2+3+1+4): React calls the updater with a single argument, and `bind(null, i, v)` prepends exactly those two — identical closures per call, identical semantics.
   - `MusicDatabaseService.ts`: `Papa.parse<CsvRow>()` is a type argument (erased); `forEach(CsvUtil.parseCsv.bind(this, a, b))` → `forEach((row) => CsvUtil.parseCsv(a, b, row))` drops only `forEach`'s index/array extras, which the 3-parameter `parseCsv` never read, and `this` is unused.
   - `OutgoingEvents.ts` `(data?.pillar as number) > -1`, `AbletonProvider` `data.bpm as number | null`, `CsvUtil.enrichRecommendations` `as unknown as number` string-coercion casts, `as ClipMetadataType`: all erased at compile time; emitted JS unchanged. `enrichRecommendations`'s call site additionally remains commented out (unchanged).
   - New `backend/type/CsvRow.ts` + `OutgoingEventData.ts`, `IncomingEventSpec` inline type, `cleanUpPhraseLeaderEventListener: (() => unknown) | undefined` — pure declarations. Backend edits stay within the WOW-011 exception: type annotations + dead-comment removal, zero behavior.
   - Commented-out-code removals verified as genuinely dead in every hunk (disabled JSX, commented alternates, the duplicate `FindAllClipsInLoop`, `onAny`, `stoppingClipsInLoop`, `checkDatabase` blocks).
5. **Docs.** AGENTS.md scope line, ARCHITECTURE repo layout, CODING_GUIDELINES migration note, README sim-suite path, test-engineer profile all updated. Remaining `spec/` mentions are historical ticket/migration text — except one stale line (nit 3).
6. **Green — run by me on `d76a06b`:** `yarn lint` pass (new rules active), `yarn test` 52/52, `yarn build` pass, `yarn coverage` pass (collects from `sim/`, `src/` new paths). Simulator smoke: `yarn sim full-spell` boots, loads 133 clips, emits `ingredient_detected` / `clip_started` / `volume_changed` / `tempo_changed` / `master-key_changed` with correct payloads.
7. **Scope.** Every changed file maps to step 7, step 8, the sanctioned +4 tests, or stale-path docs. Kept `console.log('clips', clips)` (`backend/adapter/AbletonAdapter.ts:144`): rationale is sound — live stdout is observable behavior, out of step-8 scope; correctly deferred. Kept commented `enrichRecommendations` call: verified referenced by `docs/DATA_MODEL.md:34` as documenting intentionally disabled behavior — correctly kept.

## Findings

### Blocking

None.

### Should-fix

1. **Unresolved Copilot review thread** — PR #9, `src/context/AbletonProvider.tsx:79`. Copilot flags the pre-existing `else if (queuedClips.findIndex(...))` truthiness bug (`-1` is truthy) in the `ingredient_removed` handler. The line is **unchanged by this PR** and fixing it here would violate the zero-behavior-change invariant — the correct resolution is a rationale reply + follow-up ticket, then resolve the thread. Per AGENTS.md, the gate fails on unresolved Copilot threads.
2. **Specialist spot-check of the backend hunks** — the diff brushes Ableton/OSC-emission paths (`backend/adapter/AbletonAdapter.ts`, `LightingAdapter.ts`, `event/OutgoingEvents.ts`, `event/IncomingEvents.ts`). I verified all edits are erased-type-level or dead-comment removal, but per the ticket's escalation clause and the reviewer safety-triage rule, an audio-ableton-reviewer sign-off of those four files (quick pass; hardware-safety only if they object) should be recorded before merge.

### Nit

3. `docs/adr/004-frontend-only-scope.md:12` still scopes the phase as "`src/`, `spec/`" — stale after `spec/` retirement. ADRs are point-in-time records, so an annotation ("`spec/` since retired by WOW-011") beats rewriting.
4. `.eslintrc` lost its trailing newline (`\ No newline at end of file`).
5. PR body staleness: says "base = `feat/wow-011-backend-sweep`" while the PR is now based on `main` (correct post-#8-merge, but the text and the "merge after #7 → #8" line no longer match reality); Pipeline-status checkboxes still unticked.
6. The import-guard side-effect-import regex gap is recorded only in the handoff/PR body — worth a durable line in DECISIONS_NEEDED or a ticket so it survives the notes.

## Required follow-up reviewers

audio-ableton-reviewer — spot-check of the four backend files listed in should-fix 2 (type-level equivalence confirmation). No hardware-safety escalation needed unless they find otherwise.

## Acceptance-criteria status (stack-wide items touched by this PR)

- lint/test green after PR: **verified** (52/52, new rules enforced)
- suite migrated to colocated `test/`, `spec/` retired, vitest config updated, import-guard intact: **verified**
- no default exports / `interface` / `any` in migrated code: **verified** (grep, tree-wide)
- ESLint enforcement rules added and passing: **verified**
- zero behavioral change / frozen event names: **verified for this diff** (type-erasure + closure-equivalence reading; sim smoke)
- stale path refs updated in same PR: **verified** modulo nit 3
- `yarn sim` + `yarn dev` demo: sim smoke run here; full browser re-verification recorded in the implementer handoff
