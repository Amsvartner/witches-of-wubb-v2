# WOW-011 — test-engineer handoff (PR 3: tests + enforcement)

Executor: Claude Fable 5 (test-engineer role, /ship-feature pipeline)
Branch: `feat/wow-011-tests-enforcement` (stacked on `feat/wow-011-backend-sweep`)
Scope: migration step 7 remainder + step 8. Zero behavioral change.

## Move map (git mv)

| Old                               | New                                                             |
| --------------------------------- | --------------------------------------------------------------- |
| `spec/sim/simulator.spec.ts`      | `sim/test/simulator.test.ts`                                    |
| `spec/sim/scenario.spec.ts`       | `sim/test/scenario.test.ts`                                     |
| `spec/sim/csv.spec.ts`            | `sim/test/csv.test.ts`                                          |
| `spec/sim/music-database.spec.ts` | `sim/test/music-database.test.ts`                               |
| `spec/sim/import-guard.spec.ts`   | `sim/test/import-guard.test.ts`                                 |
| `spec/setup-tests.ts`             | `src/test/setup-tests.ts` (`vite.config.ts` setupFiles updated) |

`spec/` is fully retired. Only in-file change: `from '../../sim/core'` → `from '../core'`.

**Placement rationale — `sim/test/`, not `sim/core/test/`:** the import-guard enforces that `sim/core/**` imports nothing outside `sim/core`; test files import `vitest`, so colocating them inside `core/` would violate the very purity invariant the guard protects. `sim/test/` sits next to `sim/core`, keeps the guard logic **byte-identical**, and the tests themselves are now inside the guard's scan scope (they pass its checks).

**Import-guard bite-proof:** injected `import { io } from 'socket.io-client'` into `sim/core/types.ts` → guard checks 3 and 4 failed exactly as designed; reverted, suite green. (Observed pre-existing limitation: the guard's regex misses bare side-effect imports like `import 'node-osc';` — the suite still fails via module resolution, but the assertion doesn't fire. Flagged as a follow-up task, not introduced by this move.)

## Test-count parity

48 tests before this PR (6 files) → all 48 pass from new locations, **plus 4 new** (52 total, 8 files): `src/util/test/ColorUtil.test.ts` (canonical PRD-F4 category colors + fallback) and `src/util/test/ClipDatabaseUtil.test.ts` (CSV-map sanity, read-only) — the Recommended item from the PR 1 test review. No test weakened, skipped, or deleted.

## ESLint enforcement (step 8 — config-only, no new packages)

- `@typescript-eslint/no-explicit-any`: `"off"` → `"error"`
- `@typescript-eslint/consistent-type-definitions`: `["error", "type"]`
- `import/no-default-export`: `"error"`, with an override for `vite.config.ts` and `**/*.d.ts` (Vite requires a default-exported config; `vite-env.d.ts` declares the dsv plugin's default export — tool requirements per guidelines)

## `any` removal (type-level; runtime expressions preserved)

- `updateIndex` / `chooseRandomElementFrom` → generics. The 16 `updateIndex.bind(null, i, v)` call sites became `(current) => updateIndex(i, v, current)` updater arrows — bind and arrow produce identical per-call closures; this is the one mechanical expression change, made because `.bind` defeats generic inference.
- `data.bpm as number | null` cast in `handlePlayingState` — type-only; `undefined` still stored at runtime exactly as before (comment in code).
- CSV rows typed via new `backend/type/CsvRow.ts` (`Record<string, string>`); the string-coercion arithmetic in `enrichRecommendations` kept verbatim under `as unknown as number` casts (erased; comment in code). `reduce` acc typed `Record<string, ClipMetadataType[]>`.
- New `backend/type/OutgoingEventData.ts` replaces `Record<any, any>` payloads; `(data?.pillar as number) > -1` casts keep the exact runtime comparison.
- `incomingEvents` map typed with an inline `IncomingEventSpec`; `cleanUpPhraseLeaderEventListener: (() => unknown) | undefined`.
- `Papa.parse<CsvRow>()` + arrow `forEach` in MusicDatabaseService (bind → arrow, `this` was unused).

## Commented-out code removed

Dead code only: Circle/CircleContainer (page), logger-import remnants (sliders/key/recipe), disabled JSX blocks (CurrentlyPlayingList, DebugModal incl. the multi-pillar loop and openModal button), `'text-sm'` remnant (ClipButton), disabled `orient` attr, `bg-purple-700`/`setLevel(INFO)` alternates, and in the backend: the duplicate commented `FindAllClipsInLoop`, `onAny` logger, `stoppingClipsInLoop` block, `checkDatabase` block, and CSV alternates. **Kept:** explanatory comments, TODO, eslint-disables, and the commented `enrichRecommendations` call in `MusicDatabaseService` — it documents intentionally disabled behavior and is referenced by `docs/DATA_MODEL.md`.

**Deliberately NOT removed:** `console.log('clips', clips)` in `AbletonAdapter.queueClip` — live runtime output, and step 8 covers `any` + commented-out code only; removing observable stdout is out of ticket scope. Candidate for a future cleanup ticket.

## Docs updated

`AGENTS.md` scope line (spec/ → colocated test folders), `docs/ARCHITECTURE.md` repo layout, `docs/CODING_GUIDELINES.md` migration-note (now "migration completed"), `README.md` sim-suite path, `.claude/agents/test-engineer.md` context/output paths.

## Validation

- `yarn lint` ✓ (new rules active), `yarn test` ✓ 52/52, `yarn build` ✓, `yarn coverage` ✓ (collects from new paths)
- Import-guard bite-proof performed and reverted (above)
- Simulator demo re-verified in browser: `yarn sim full-spell` + `yarn dev`, UI identical, no console errors

## Human-verifiable demo

1. `yarn test` — 52 tests green, all from colocated `test/` folders; `ls spec` fails (retired).
2. `yarn lint` — green with `no-explicit-any`, `consistent-type-definitions`, `import/no-default-export` enforced.
3. `yarn sim full-spell` + `yarn dev` — UI unchanged.
