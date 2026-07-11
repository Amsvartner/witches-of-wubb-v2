# WOW-004 — test-engineer review (PR #13)

Date: 2026-07-11
Reviewer: test-engineer subagent (claude-opus-4-8), high reasoning effort
Branch: `docs/wow-004-ui-audit` (reviewed `git diff main...HEAD`)
Scope: test-engineer lens on a read-only docs ticket — diff purity, validation-claim verification, and a testability assessment of the audit's findings as advisory input to the rework's test strategy. No test-engineer prompt file exists for WOW-004; reviewed per profile + orchestrator scope.

**Verdict: approve.**

---

## Validation (commands I actually ran)

- `yarn lint` → **PASS** (`eslint . --ext .ts,.tsx`, 2.36s, only the pre-existing "React version not specified" warning, no errors). Matches the audit/handoff claim.
- `yarn test` → **PASS**, **13 test files, 68 tests**, 0 failures (1.71s). Exactly matches the "13 files / 68 tests" claim in `docs/UI_AUDIT.md` and `docs/agent-notes/wow-004-frontend-ui-designer-audit.md:46-48`.
- `git diff main...HEAD --check` → clean (no whitespace/conflict markers).
- No `yarn start-backend`, no `yarn dev`/`yarn sim` needed for this review; source spot-checks were sufficient to confirm the runtime/static labels. No network, hardware, or Ableton contacted.

---

## Required (blocking)

None. Diff is pure docs and the validation claims hold.

- **Diff purity — PASS.** `git diff main...HEAD --name-status` shows exactly three paths, all under `docs/`:

  - `A docs/UI_AUDIT.md` (the deliverable)
  - `A docs/agent-notes/wow-004-frontend-ui-designer-audit.md` (handoff note)
  - `M docs/agent-prompts/wow-004-frontend-ui-designer-prompts.md` — append-only (6 lines, a Prompt 1 run record under the existing `### Prompt 1 — run record` header; nothing above it changed). No `src/**`, `backend/**`, `Arduino/**`, `src/assets/Music Database.csv`, or `.env` touched. Consistent with the ticket's "no fixes made / no code changes" acceptance criterion (`docs/TICKETS_001_INITIAL.md:39,43`).

- **Validation claims — VERIFIED.** Re-ran both commands myself (above). Green, and the 13/68 count is exact, not approximate.

---

## Recommended (advisory — testability of the findings for the rework)

The rework tickets (WOW-006/007) will need failing-then-passing vitest coverage (jsdom, mocked sockets). This section grades each material finding on whether it is stated precisely enough to test that way, and — importantly — flags the ones that are **not exercisable in jsdom at all** so nobody on the rework wastes effort trying. This is advisory; it is not a defect in the audit. Overall the report is unusually test-friendly: nearly every finding carries a `file:line`, a concrete observable, and an explicit runtime-vs-static label.

**Well-specified, directly testable in jsdom + mocked socket (write these during the rework):**

- **UI-01 (disconnect blocker)** — `useSocketContextProviderState.ts` / `useAbletonContextProviderState.ts:109-112`. Precise and testable. The existing `useSocketContextProviderState.test.tsx` already mocks socket.io-client, so the harness exists. Failing-then-passing shape: render the provider with a mock socket, fire a `disconnect` (and/or flip `.connected` false), assert a disconnect indicator renders. Today no `socket.on('disconnect'|'connect_error')` exists anywhere (confirmed by reading both hooks) and the `!socket.connected` branch early-returns — so the "before" assertion (nothing renders) is real and reproducible without hardware.
- **UI-02 (fake `{} as Socket` placeholder)** — `useSocketContextProviderState.ts:10` (confirmed verbatim). Testable: render `DebugModalContainer` while the context still holds the placeholder and invoke `toggleSong` — `socket.emit` is `undefined` on `{}`, so it throws today; after a guard is added the test flips to passing. Note for the rework: `toggleSong` (`DebugModalContainer.tsx:25-31`) calls `socket.emit(...)` with no optional-chaining guard, unlike the `useAbletonContext` `change*` callbacks — the audit's claim that this is the one unguarded consumer is accurate.
- **UI-03 (single-tap operator trigger)** — `MainScreen.tsx:33-36` (confirmed verbatim: always-rendered `<button>` with three `&nbsp;`, opens the modal on a plain click). The "before" state tests trivially (`getByRole('button')` → click → modal open). The ADR-006 long-press replacement is testable too, but needs fake timers + pointer events — call that out in the rework's test plan as more involved than a click assertion.
- **UI-04 (no confirm gate before a real trigger)** — `DebugModalContainer.tsx:25-31`. Testable: click a clip button, assert `socket.emit('/new/tag', …)` fires immediately with no intervening confirm step; after the fix, assert the confirm gate intercepts.
- **UI-07 (static `sr-only` label)** — `ClipButton.tsx:40`. Testable via accessible-name assertion in the stop-button reuse path.
- **UI-14 (rotate buttons lack `aria-label`)** — `KeyAdjusterContainer.tsx:49-57`. Testable: render with a truthy `masterKey`, assert accessible names on the `<`/`>` controls.
- **UI-10 (suggested recipe while idle)** — testable by rendering with zero playing clips, but **moot** (F5 deletes `RecipeBoxContainer`/`useGrimoire`); not worth a test.

**Flag — NOT exercisable in jsdom (need a different tool; don't write these as jsdom unit tests):** jsdom has no CSS/layout engine and does not run the Tailwind JIT, so any finding whose symptom is _rendered geometry or a class-name resolving to CSS_ cannot be observed by a vitest DOM assertion. These need a visual/Playwright check or a static/lint rule instead:

- **UI-05 (modal overflow + touch-target pixel sizes at 1024×1280)** — pure layout; jsdom reports no real box sizes. Route to a viewport/visual check or manual step.
- **UI-06 (`max-w-xxl` is a no-op)** — I confirmed `max-w-xxl` is absent from `tailwind.config.cjs` (no `xxl` extension), so the class genuinely generates nothing. But a jsdom test can only assert the literal className string, which is brittle and doesn't prove the CSS effect. Better as a Tailwind safelist/lint check.
- **UI-08 (`col-start-${index}` dynamic class)** and **UI-12 (`absolute2` typo)** — same category; these are JIT/CSS concerns, best caught by a lint rule or a grep-based guard, not a behavioral test.
- **UI-15 (`prefers-reduced-motion`)** — only marginally jsdom-testable via a `matchMedia` mock; realistic verification is visual. Note the dependency in the test plan.
- **UI-16 (contrast ratios)** — the audit already labels this **static/unverified/TBD** and recommends axe-core/Lighthouse against a running build. Correct call; not a jsdom unit test. No action needed beyond honoring that TBD.

**Runtime-vs-static labels — spot-checked, plausible.** I verified three "runtime-confirmed" claims against the source paths (couldn't re-run the live sessions, but the code fully supports each observation):

- UI-01: no `disconnect` handler anywhere + early-return on `!socket.connected` → a killed sim producing "zero visual change" is exactly what this code yields. Consistent.
- UI-03: `MainScreen.tsx:34-36` is verbatim the quoted invisible button; a single click opening the modal is the only possible behavior. Consistent.
- UI-06: `DebugModalContainer.tsx:71` `w-screen max-w-xxl` confirmed, and `max-w-xxl` confirmed absent from config → "no max-width applied" is correct. Consistent.
- Also confirmed the audit's WOW-012 status note: `useAbletonContextProviderState.ts:132,135` uses `.some(...)` on both `ingredient_removed` branches (not `findIndex`-as-boolean), so the audit's "bug not present at the cited location" observation is accurate.

The static labels are appropriately conservative (e.g. UI-02's exact throw is labeled static, not runtime — correct, since it wasn't reproduced in the connect window).

---

## Nit

- The audit note references the `useSocketContextProviderState.test.tsx` coverage as "only asserts the connected path" (`docs/UI_AUDIT.md:160`) — accurate and useful; when the rework adds the UI-01/UI-02 tests, that same file is the natural home, keeping the disconnect/placeholder cases colocated with the existing connect-path test.

---

## Verdict

**approve.** The diff is docs-only (three files, all under `docs/`, the prompt-file change append-only), so no test surface changes and the baseline is untouched. I independently re-ran `yarn lint` (pass) and `yarn test` (**13 files / 68 tests, all green**) — both match the report's claims exactly. Spot-checked runtime/static labels against source: accurate. The findings are, with the layout/CSS exceptions flagged above, specified precisely enough (file:line + observable) to drive failing-then-passing jsdom tests during the rework; the CSS/geometry findings (UI-05/06/08/12/15/16) will need visual or lint tooling instead and should be marked as such in the rework's test plan. No blocking issues from the test-engineer lens.
