# WOW-011 PR 1 — general reviewer verdict

Reviewer: Claude Fable 5 (reviewer role, read-only)
Target: `git diff main...HEAD` on `feat/wow-011-frontend-sweep`, head `5b309e1` (PR #7, frontend conventions sweep — migration steps 1, 2, 6 + `App.spec.tsx` move)
Date: 2026-07-10
Checklist: `docs/agent-prompts/wow-011-reviewer-prompts.md` Prompt 1

## Verdict

**approve-with-nits.** The diff is a faithful, behavior-free conventions sweep. Scope boundaries hold, renames are renames, event strings and payload handling are byte-identical, lint/test/build are green (verified independently). All findings are docs-staleness or process items — no code change required. The should-fix items below must be cleared in the fix phase before the gate (two stale doc paths violate the ticket's "stale paths updated in the same PR" AC verbatim; one unresolved Copilot thread fails the gate by policy).

Required follow-up specialist reviewers: **none for PR 1** — no backend/, no volume/light/OSC/timing/mapping code touched (audio-ableton-reviewer + hardware-safety-reviewer are mandatory for PR 2 only). Volume constants in `VolumeSliderContainer` (`MIN 0` / `MAX 0.7` / `RESET 0.6`) and tempo bounds (`75–155`) survive unchanged in the diff.

## What I verified (commands + results)

| Check                                                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope: `git diff main...HEAD --stat -- backend/ spec/sim .eslintrc* package.json yarn.lock` | Empty. Only `src/**`, `spec/App.spec.tsx` (delete side of the move), and docs touched. No config tweaks were needed (vitest default include already covers `.test.tsx`).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Renames: `git diff main...HEAD -M --name-status`                                            | All 11 moves detected as renames (R066–R093). The three A/D pairs (`App.spec.tsx`→`InstallationPage.test.tsx`, `database-output.ts`→`ClipDatabaseUtil.ts`, `ClipButton` extraction) fall below rename similarity because of the export regrouping; each read line-by-line — content 1:1.                                                                                                                                                                                                                                                                                                                      |
| Rewrite spot-check                                                                          | Full diff read hunk-by-hunk, including the lowest-similarity files (`InstallationPage` R066, `AbletonProvider` R077, `useGrimoire` R076, `DebugModalContainer` R079). Only imports, names, export style, and `function`→`const` arrow conversions changed; every function body, hook order, Tailwind class, and JSX structure is identical. The one textual delta beyond renames: a trailing space inside `ClipButton`'s template-literal className vanished — DOM collapses className whitespace, no rendered change.                                                                                        |
| Event strings                                                                               | `git grep` of `socket.on/emit(...)` string literals in `src/` on main vs HEAD: identical sets and counts (18 distinct names incl. `/new/tag`, `/departed/tag`, all `get_*`/`*_changed`). Socket.io event names frozen — AC met.                                                                                                                                                                                                                                                                                                                                                                               |
| Behavior invariants                                                                         | `updateIndex` / `chooseRandomElementFrom` bodies unchanged (module-scope `const` defined before use — no hoisting hazard); `ClipDatabaseUtil` keeps the same module-level `ParseCSV`/`EnrichRecommendations` side effects and bind targets; `ColorUtil` switch body unchanged (only an added `: string` annotation); `SpellRecipeType` move is type-only (erased at runtime); `main.tsx` `React.StrictMode`→named `StrictMode` is runtime-identical.                                                                                                                                                          |
| Conventions                                                                                 | PascalCase files, singular folders (`page`/`container`/`component`/`context`/`hook`/`util`/`type`), no default exports in `src/` (`grep`: only the pre-existing `src/vite-env.d.ts` ambient CSV module declaration, untouched and required by the vite CSV plugin — not a finding), `const` arrow components with `Props` types, containers correctly hold all context-reading components, `ClipButton` is the sole presentational `component/` (props in, markup out). Placement matches guidelines; `InstallationPage` keeping modal state + contextmenu suppression is acceptable page-level coordination. |
| Green                                                                                       | `yarn lint` clean (pre-existing React-version warning only); `yarn test` 48/48 across 6 files incl. the moved page test; `yarn build` succeeds (153 modules). Note: run against a working tree containing one uncommitted **human** edit to `CurrentlyPlayingListContainer.tsx` (comment/blank-line removal only — runtime-inert), so results hold for HEAD. Per AGENTS.md I did not stash or touch it.                                                                                                                                                                                                       |
| Docs                                                                                        | PRD F4 (`src/util/ColorUtil.ts`), F5/FR5, DECISIONS_NEEDED, UX_UI_PRINCIPLES, DATA_MODEL, ARCHITECTURE src-line, WOW-006 ticket text all updated. Two ARCHITECTURE lines missed — see findings.                                                                                                                                                                                                                                                                                                                                                                                                               |
| Handoff note                                                                                | Rename map in `docs/agent-notes/wow-011-frontend-implementer-sweep.md` is complete — all 16 entries reconcile 1:1 against the diff, deviations (assets folder, `any`, commented code) are rationalized and consistent with the PR-stack split.                                                                                                                                                                                                                                                                                                                                                                |
| PR body (`gh pr view 7`)                                                                    | Targets the fork (`Amsvartner/witches-of-wubb-v2`, base `main`), template filled completely: real demo steps, ticked validation + safety checklists, out-of-scope section, no dependency changes.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Simulator demo                                                                              | Not re-run by this review (outside my allowed command list). Implementer ran it in-browser (run record: identical UI, no console errors) and the test-engineer review corroborates behavior-freeness; demo steps in the handoff/PR body are concrete and plausible against the unchanged event contract. Residual: gate runner or human should execute steps 1–4 once.                                                                                                                                                                                                                                        |

## Findings

### Blocking

None.

### Should-fix (before gate; all docs/process, no code)

1. **`docs/ARCHITECTURE.md:32` — stale path `src/lib/database-output.ts`.** The file moved to `src/util/ClipDatabaseUtil.ts` in this PR; ticket AC requires stale references updated in the same PR as the move. Fix: update the path (and the sentence still reads correctly).
2. **`docs/ARCHITECTURE.md:29` — stale `spec/` description.** "`spec/` — vitest tests (currently one App smoke test)" — the App smoke test moved to `src/page/test/` in this PR; `spec/` now holds the 5 sim suites + `setup-tests.ts`. Fix: reword (e.g. "sim vitest suites + setup; colocated `test/` folders are the target convention").
3. **`.claude/agents/frontend-ui-designer.md:16` — stale `src/components/`, `src/contexts/`, `src/hooks/`.** Living agent profile (not a historical run record), so it falls under the same-PR stale-path AC, unlike the grandfathered WOW-004 prompt/ticket history. Fix: point at `src/container/`, `src/context/`, `src/hook/`, `src/page/`, `src/component/`.
4. **Unresolved Copilot review thread on PR #7** (`src/page/test/InstallationPage.test.tsx` — stale "renders headline" test name). AGENTS.md: the Copilot round resolves all threads before agent reviews; the gate fails on unresolved threads. Fix: either rename the test to "renders the cauldron" (test-description-only, zero runtime behavior — safe within this PR) or reply deferring to PR 3 and resolve the thread. Same issue as test-engineer nit 3.

### Nit

5. **`src/component/ClipButton.tsx:27` — `key={clipName}` on the component's root div.** List-key idiom belongs at the call-site map; faithfully preserved pre-existing quirk. Clean up in PR 3 (already logged by test-engineer).
6. **`src/hook/useGrimoire.ts:52` — exported hook has no explicit return type.** Guidelines: "prefer explicit return types for exported functions." Acceptable in a zero-change sweep; add in PR 3.
7. **Provider style `FC<PropsWithChildren>`** (`AbletonProvider.tsx:42`, `LoggerProvider.tsx:20`, `SocketioProvider.tsx:7`) diverges from the guidelines' documented `({ children }: Props): JSX.Element` pattern. Human-approved style edit (commit `5b309e1`) — not a finding against the diff; noting only that CODING_GUIDELINES.md does not yet document the `FC` pattern, so a one-line guidelines addendum (or reverting to the documented style in PR 3) would prevent future drift. Behaviorally inert (children typing only).

## Scope / safety notes

- No scope creep found: every hunk maps to migration steps 1, 2, 6, the `App.spec.tsx` move, or same-PR stale-path doc updates. No piecemeal PR 2/3 work smuggled in (commented-out code and `any` correctly left for PR 3; `backend/` byte-untouched).
- No hardcoding introduced; no credentials; no new IPs/ports/clip names; no `package.json`/lockfile/dependency changes.
- `src/assets/` deliberately not renamed (read-only `Music Database.csv` inside) — correct call, safety rule outweighs the folder-naming rule.
- Uncommitted human working-tree edit to `src/container/CurrentlyPlayingListContainer.tsx` exists at review time (comment removal + blank lines). Outside this review's target; left untouched. It will need to be committed or set aside before PR 2 stacks cleanly.

## Verdict

**approve-with-nits** — clear should-fix items 1–4 in the fix phase; nits 5–7 roll into PR 3. No specialist reviews required for this PR.

## Re-review @ a551c9a

Reviewer: Claude Fable 5 (reviewer role, read-only). Date: 2026-07-10. Delta reviewed: `git diff 5b309e1..a551c9a` (single fix commit, 5 files).

### Should-fix resolution (items 1–4)

| #   | Finding                                                         | Status                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `docs/ARCHITECTURE.md:32` stale `src/lib/database-output.ts`    | **Fixed** — now `src/util/ClipDatabaseUtil.ts`; sentence reads correctly.                                                                                                                                                                                  |
| 2   | `docs/ARCHITECTURE.md:29` stale `spec/` description             | **Fixed** — reworded to sim suites / legacy location, page smoke test at `src/page/test/`, remaining moves deferred to the WOW-011 test migration. Accurate.                                                                                               |
| 3   | `.claude/agents/frontend-ui-designer.md:16` stale context paths | **Fixed** — now `src/page/`, `src/container/`, `src/component/`, `src/context/`, `src/hook/`. Matches the tree.                                                                                                                                            |
| 4   | Unresolved Copilot thread (stale test name)                     | **Fixed** — test renamed to `renders the cauldron centerpiece` (description-only, assertion unchanged); thread replied ("Fixed in a551c9a") and resolved. GraphQL check: PR #7 has exactly one review thread, `isResolved: true`. Zero unresolved threads. |

### Delta scope check

Only the claimed fixes plus two acknowledged extras, both clean:

- `src/container/CurrentlyPlayingListContainer.tsx` — the previously noted uncommitted **human** edit, now committed and disclosed in the commit message: removes a commented-out `LoggerContext` import + its commented-out `useContext` line and one blank line; adds two blank lines inside the map callback. Runtime-inert; no scope creep beyond it.
- `docs/agent-notes/wow-011-reviewer-verdict-pr1.md` — this verdict note committed (process artifact, expected).

No code-behavior changes, no `backend/`, no config, no dependency, no event-string changes in the delta.

### Re-verified green (run at a551c9a, clean tree)

- `yarn lint` — clean (pre-existing React-version warning only).
- `yarn test` — 48/48 across 6 files, including the renamed `renders the cauldron centerpiece`.

### Nit deferrals

Nits 5–7 (ClipButton root `key`, `useGrimoire` return type, `FC<PropsWithChildren>` guidelines addendum) deferred to PR 3 with rationale — consistent with the original verdict, which already scoped them to PR 3. Acceptable.

### Final verdict

**approve** — all four should-fixes resolved, delta is exactly the fix round plus the disclosed human comment removal, lint/test green, zero unresolved PR threads. No specialist reviews required for PR 1. Residual carried forward: simulator demo steps 1–4 still unexecuted by a reviewer (gate runner or human should run once); nits 5–7 land in PR 3.
