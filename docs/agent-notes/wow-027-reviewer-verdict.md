# WOW-027 PR #28 (throttle slider emissions) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, general review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #28, `fix(wow-027): throttle tempo/volume slider emissions`. Not stacked — base `main`.
- Method: read-only, no edits made. Independently reproduced a Reset/throttle race end-to-end with real timers in a standalone script rather than reasoning about it abstractly. Cross-referenced findings against GitHub's Copilot review (found the same two bugs independently). Ran all validation commands itself.

## Verdict (initial round): **REQUEST-CHANGES**

Resolved in the fix round — see the orchestrator's note at the end of this file.

## Required (initial round)

1. **Reset/pending-throttle race in `VolumeSliderContainer.resetVolume`** (`src/container/VolumeSliderContainer.tsx:36-39`). `resetVolume()` called the raw, un-throttled `changeTrackVolume` directly, but never cleared the throttle wrapper's internal `pendingArgs`. If Reset was clicked while a drag's trailing call was still pending (within the ~100ms cooldown), the stale dragged value fired _after_ the reset and silently overwrote it. Reproduced end-to-end with real timers: drag to 0.1→0.3, click Reset(0.6) at t=40ms, backend-visible emission sequence `0.1 → 0.6 → 0.3` — the reset gets clobbered. Fix direction suggested: give `throttle()` a `cancel()` that clears `pendingArgs`, call it from `resetVolume`.
2. **Ack/broadcast-triggered mid-drag resync stutter** on both sliders. `useEffect(() => setDisplayTempo(tempo), [tempo])` (`TempoSliderContainer.tsx:18-20`) and the volume equivalent re-fire not just on external context changes but also when this same component's own throttled emission gets ACKed or broadcast back. If that ack/broadcast lands mid-drag, the display can visibly snap backward to a stale value before the trailing emission's own round-trip pushes it forward again. Bears directly on the ticket's "slider UI stays responsive during the drag" acceptance criterion.
3. **6 open Copilot review threads** unresolved at time of review (confirmed via GraphQL). Copilot independently found the exact same two bugs above — strong convergent confirmation. Per `AGENTS.md`, the gate fails on unresolved Copilot threads.
4. Recommended also considering hardware-safety-reviewer given finding #1 is a confirmed volume-behavior bug (per this reviewer's own profile's escalation rule for anything touching volume) — noted as a recommendation, not a hard requirement from the ticket text itself.

## Findings

**Scope (clean).** `gh pr diff 28` touches exactly the ticket's allowed files plus the standard agent-note. No dependency, backend, or hardware drift (`package.json`/`yarn.lock`/`backend/`/`Arduino/`/`.env` all untouched). No debouncing crept into unrelated controls.

**Throttle core algorithm — correct in isolation.** Hand-traced single-call, in-window-burst, and multi-window-outlasting-drag scenarios against both the implementation and the tests; they agree. Re the ticket's flagged edge case (a call landing in the exact tick the cooldown timer fires): because `startCooldown()` is called synchronously inside the timer callback before it returns, there is no window where `onCooldown` is false with a call able to sneak in as a spurious extra leading edge. At most one `setTimeout` is ever outstanding (re-armed serially), so no unbounded timer chain. The util's own contract holds — the bug was that it exposed no way for an external, unthrottled caller (Reset) to cancel a pending delivery.

**Container wiring — mostly correct, two real gaps (findings #1, #2).** Local-state/throttled-emission split applied consistently between both containers. `useMemo(() => throttle(fn, 100), [fn])` correctly preserves throttle state across renders — verified `changeTempo`/`changeTrackVolume` are stable `useCallback(..., [socket])` references, and `socket` itself is set once on connect, not recreated per render. The `useEffect` dependency arrays are correctly scoped to not re-fire on local display updates — the problem isn't mis-scoping, it's that legitimate context changes include echoes of this same component's own emission.

`EMIT_THROTTLE_MS = 100` sits at the edge of the ticket's suggested "~75–100ms" range — defensible, conservative choice.

**Tests** — the original 7+4+5 tests are non-vacuous and check real behavior; independently verified the floating-point volume-step values resolve exactly at the asserted endpoints. Gap noted: the original Reset test only exercised a fresh mount with no preceding drag, so it didn't catch finding #1.

**Live-verification claim** (21 events → 2 emissions each) is internally consistent with the implementation and not implausible given the code.

**Validation commands**, run independently: `yarn lint` clean, `npx tsc --noEmit` clean, `yarn test` → 16 files/84 tests passed, `yarn build` clean. CI also green.

## Nits (non-blocking, addressed in the fix round anyway)

- `throttle.ts` used `export function throttle(...)` — the only first-party util using a `function` declaration instead of `export const x = (...) => {...}`, inconsistent with `ColorUtil.ts`/`ClipDatabaseUtil.ts`/`Logger.ts`/`backend/util/*`.
- `contextVolume` hardcoded the `0.7` clamp literal duplicating `MAX_VALUE` two lines above, and used a truthiness check on `trackVolume[pillar]` (pre-existing logic, just renamed from `value`; Copilot flagged it too).
- PR body's live-verification section describes a devtools-JS event-dispatch technique rather than a plain manual drag-and-observe recipe.
- `parseInt(e.target.value)` lacked an explicit radix (Copilot-flagged); pre-existing line, correctly out of the original ticket scope, but the thread still needed resolving.

## Summary (initial round)

The throttle utility itself was well-designed — verified by hand-trace to correctly deliver leading+trailing semantics with no timer leak and no value drop in isolation. Wiring it into `VolumeSliderContainer` introduced a real, reproducible bug where the Reset button's explicit value could be silently overwritten ~100ms later by a stale pending drag value — confirmed not theoretical by replicating the exact logic in a standalone script. Both sliders also carried a subtler risk where their own throttled emission's ack/broadcast could echo back mid-drag and cause a visible stutter, which the PR's sim-only live verification wouldn't have caught. Both issues were independently flagged by Copilot too. Scope discipline, dependency discipline, lint/typecheck/test/build, and the core throttle algorithm were all clean — needed a real fix (not just acknowledgment) before merge.

---

**Orchestrator's note (fix round, post-review):** Both Required items fixed. (1) Added `throttle().cancel()`, called from `resetVolume` before sending the reset value. (2) Added an `isDraggingRef` (set on `onPointerDown`, cleared on `onPointerUp`/`onPointerCancel`/`onBlur`) to both containers, gating the context-sync `useEffect` so it's suppressed while a drag is actively in progress. All 6 Copilot threads resolved (the 2 duplicate/corroborating threads on the same two bugs, plus the `parseInt` radix and `MAX_VALUE`/truthy-check nits, both also fixed). Added 6 new regression tests across `throttle.test.ts` and both container test files, each independently mutation-tested against the exact reviewer-described failure mode and confirmed to fail exactly as predicted before the fix, then pass after. Re-verified live against the real simulator: the core throttling behavior is unregressed (still 21 events → 2 emissions), and the Reset-race scenario was reproduced live against the real sim server and confirmed fixed (no stale value ever fires after a reset, even after a further 2-second wait). Full validation re-run clean: `yarn lint`/`npx tsc --noEmit`/`yarn build` clean, `yarn test` 91/91 (84 + 7 new). Did not additionally escalate to hardware-safety-reviewer — see the implementer agent-note's "Fix round" section for the reasoning (volume is hard-capped at 0.7 regardless of which value won the race, so the failure mode was never an unsafe-loudness one, and the fix removes the failure mode entirely).

---

## Verdict (re-review, fix-round SHA `c1e6a1d`): **APPROVE-WITH-NITS**

- Reviewer: reviewer (fresh instance, fix-verification pass — no memory of the initial-round review above, briefed from scratch on both required fixes)
- Method: read-only. Independently reproduced fix #1 with a throwaway real-timer (not fake-timer) vitest file importing the actual shipped `throttle.ts`, including a control test with `cancel()` omitted to prove the repro methodology genuinely catches the bug (not a false negative), and a reversed-call-order test to empirically settle whether `cancel()`-before-vs-after `changeTrackVolume` in `resetVolume` matters (it doesn't — both are synchronous, no yield point between them). Independently mutation-tested both fixes by disabling each in turn and confirming the corresponding new regression test fails exactly as predicted, then restored via `git checkout --` (working tree confirmed clean afterward).

### Fix #1 (Reset/pending-throttle race) — CONFIRMED CORRECT

Real-timer reproduction against the actual shipped code: emission sequence `[0.1, 0.6]`, `0.3` never fired even 200ms past the original window. Control test (same scenario, `cancel()` omitted) reproduced the original bug's exact `[0.1, 0.6, 0.3]` sequence, proving the repro is valid. Mutation-testing `cancel()`'s body to a no-op failed the Reset-race test exactly as predicted, plus 2 of the 4 new `cancel()` unit tests.

### Fix #2 (mid-drag echo stutter) — CONFIRMED CORRECT, one new non-blocking nit

Traced the async/sync boundary precisely: `isDraggingRef.current = true` is set synchronously inside the native pointerdown event's call stack, while both echo paths (`changeTempo`'s ack callback, `volume_changed`'s broadcast listener) are driven by socket.io network I/O — asynchronous relative to DOM dispatch. Since JS is single-threaded, there is no possible gap where a network-driven echo could land between "pointerdown fires" and "the ref is actually set." Mutation-tested by removing the guard from `VolumeSliderContainer`'s sync effect: the mid-drag-echo test failed exactly as predicted (snapped back to the stale echo), all 6 other tests in that file stayed green, confirming the test is precisely targeted.

**New nit (non-blocking, not part of either original required finding):** if a drag is interrupted in a way that fires none of `pointerup`/`pointercancel`/`blur` (most plausible case: mouse held down on the slider, then OS-level window/focus loss before release — a `blur` doesn't fire from mere OS focus loss, and `pointercancel` isn't guaranteed to reach the page if the release happens while the browser isn't the OS-level capture target), `isDraggingRef.current` can get stuck `true` for that mounted instance. Blast radius is contained: emissions and the Reset fix don't gate on the ref and keep working correctly; only the context-resync effect is suppressed for that one slider until remount/reload (no crash, no safety impact — volume stays hard-capped by the `<input max>` attribute regardless). Worth a defensive follow-up (a `window`-level `pointerup`/`pointercancel` listener, or a max-drag-duration failsafe) given a live installation may run a full show/day without reload, but doesn't block this fix round.

### Everything else re-verified at the fix-round SHA

23/23 pass on the three new/modified test files directly; all 6 Copilot threads confirmed resolved via GraphQL; all 3 trailing nits (parseInt radix, `MAX_VALUE` literal, `export const`) confirmed fixed in code; full suite 91/91, lint/tsc/build clean, `gh pr checks 28` green on the current HEAD SHA (confirmed local/origin HEAD match, `c1e6a1d`); scope diff against `main` touches only the ticket's allowed files plus the 4 standard agent-note docs, no new dependencies; required audio-ableton-reviewer sign-off present and its "not re-run post-fix" reasoning holds up (the fix only changes when the sync effect runs, doesn't touch anything in that reviewer's musical-mapping/timing remit); the decision not to escalate to hardware-safety-reviewer is sound and was left as an open, human-overridable note rather than silently decided.

### Summary

Both originally-required fixes are genuinely correct, confirmed through independent real-timer reproduction (with a control test proving the reproduction methodology itself is valid) and mutation testing, not just re-reading the implementer's claims. One new, narrow, self-healing, non-blocking nit surfaced. No blockers remain.
