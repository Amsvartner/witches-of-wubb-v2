# WOW-011 PR 1 — test-engineer review

Reviewer: Claude Fable 5 (test-engineer role, read-only)
Target: `git diff main...HEAD` on `feat/wow-011-frontend-sweep` (PR #7, frontend conventions sweep)
Date: 2026-07-10

## Verdict

**approve-with-nits** — the diff is behavior-free from a test-strategy perspective, the suite is green with exact test-count parity (48/48), no test was weakened or deleted, and no test touches network/hardware. All findings below are nits or PR 3 follow-ups; none block this PR.

## What I verified (commands + results)

| Command                                        | Result                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `yarn test`                                    | 6 files, **48 passed (48)**, 0 skipped/failed. Includes `src/page/test/InstallationPage.test.tsx`.         |
| `yarn lint`                                    | Clean (pre-existing "React version not specified" warning only).                                           |
| `yarn build`                                   | Succeeds, 153 modules.                                                                                     |
| `git diff main...HEAD -M` (full read)          | All moves detected as renames; every hunk inspected for behavior drift (see below).                        |
| `git diff main...HEAD --name-status -- spec/`  | Only `D spec/App.spec.tsx`. `spec/sim/*.spec.ts` (5 files) byte-untouched — PR 3 scope respected.          |
| `git ls-tree main` vs branch test-file listing | Main: 6 test files (App.spec + 5 sim specs). Branch: same 5 sim specs + moved `InstallationPage.test.tsx`. |

**Test-count parity:** the 5 sim spec files are unchanged and contribute 47 tests on both sides; main's `App.spec.tsx` (1 test) is replaced 1:1 by `InstallationPage.test.tsx` (1 test) → 48 before, 48 after. Matches the implementer handoff claim.

**Moved test correctness:** `src/page/test/InstallationPage.test.tsx` asserts the identical behavior as the old `spec/App.spec.tsx` — `render(<InstallationPage />)` + `getByTestId('cauldron')` — only the import path, component name, and describe label changed. Colocated `test/` folder next to `src/page/`, `.test.tsx` naming: conforms to CODING_GUIDELINES.md Testing section. No vitest config change was needed (default include pattern covers both `.spec` and `.test`); `setupFiles: ['spec/setup-tests.ts']` still resolves — moving it is PR 3 (migration step 7).

**No network/hardware in tests:** the moved test renders `InstallationPage` without `SocketioProvider`, so no `io()` connection is created (default contexts are used) — same as before the move. `spec/setup-tests.ts` contains no network setup. Sim specs run against the mock backend only.

**Behavior-freeness of the diff:** inspected every non-rename hunk:

- `ClipButton` extraction (`src/component/ClipButton.tsx`) — JSX, classNames logic, and Switch markup are line-for-line identical to the private component in old `debug.tsx`. Only difference: a trailing space vanished inside a template-literal className (`'translate-x-1'} ` → `'translate-x-1'}`); className whitespace is collapsed by the DOM, so no rendered change.
- `ClipDatabaseUtil` / `ColorUtil` grouped exports — same module-level CSV parsing side effects (`ParseCSV` + `EnrichRecommendations` binds unchanged), same switch body; only an added explicit `: string` return type.
- `AbletonProvider` `UpdateIndex` → `updateIndex`, `useGrimoire` `ChooseRandomElementFrom` → `chooseRandomElementFrom` — declaration-to-const-arrow conversions at module scope, defined before use; no hoisting hazard, bodies unchanged.
- `main.tsx` `React.StrictMode` → named `StrictMode` — identical runtime.
- `SpellRecipeType` moved to `src/type/` — type-only, erased at runtime.

No behavior change found, so no new coverage is _required_ by this diff.

## Findings

### Required

None.

### Recommended

1. **`src/component/ClipButton.tsx:12` — newly exported component has zero direct test coverage.** Guideline: "New components/containers ship with at least a render test." It was private (and equally untested) before, so this is not a regression and not blocking a moves-only PR — but the extraction makes it a public module. Add a render test covering the playing/queued/stopping class states in PR 3 alongside the spec/ migration. It is not exercised transitively either: the existing page test renders the debug modal closed.
2. **`src/util/ColorUtil.ts` / `src/util/ClipDatabaseUtil.ts` — pure-function/util modules remain untested.** `ColorUtil.getBackgroundColorFromType` is a trivial, ideal vitest target; `ClipDatabaseUtil` map-building is indirectly covered by `spec/sim/music-database.spec.ts` / `csv.spec.ts`. Fold direct `src/util/test/` coverage into PR 3, not here.

### Nit

3. **`src/page/test/InstallationPage.test.tsx:5` — test name "renders headline" is stale**; it asserts the cauldron testid, not a headline. Carried over verbatim from `App.spec.tsx` (correct instinct for a zero-change PR); rename to "renders the cauldron" when tests get touched in PR 3.
4. **`src/page/test/InstallationPage.test.tsx:8` — `getByTestId('cauldron')`** contradicts the guideline preference for user-facing queries, but `data-testid='cauldron'` (`src/container/CurrentlyPlayingListContainer.tsx:109`) is pre-existing on a purely visual div with no accessible role; acceptable as-is, revisit in PR 3.
5. **`src/component/ClipButton.tsx:27` — `key={clipName}` on the component's root div** is a leftover list-key idiom (keys belong at the call-site map). Pre-existing quirk faithfully preserved; clean up in PR 3.

## Scope check

- Remaining `spec/sim/*` suites untouched — correctly left for PR 3.
- No tests skipped (`it.skip`/`describe.skip`/`todo`): none in the diff or the tree.
- No new test dependencies.

## Process note

While verifying, I briefly `git stash`-ed the human's uncommitted `docs/agent-prompts/wow-011-frontend-implementer-prompts.md` edit and immediately `git stash pop`-ed it; `git status` confirms the working-tree change is intact and unmodified.
