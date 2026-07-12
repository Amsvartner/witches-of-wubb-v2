# WOW-027 — Tempo/volume sliders flood the backend, Ableton, and the lighting server on every drag pixel

- Role: frontend-implementer (implementer)
- Date: 2026-07-12
- Branch: `feat/wow-027-throttle-slider-emissions`, branched fresh from `origin/main` (no allowed-file overlap with any unmerged branch from this run — confirmed via `git log` against every open PR's branch)

## Ticket

WOW-027 — see `docs/TICKETS_002_BUGS.md`. Both sliders called `changeTempo`/`changeTrackVolume` unthrottled from `onChange`, so a single drag produced one `set_tempo`/`set_track_volume` socket emission per pixel — each triggering an Ableton API call, a broadcast to every client, an OSC message to the lighting server, and a timeout-timer reset.

## Fix

1. **`src/util/throttle.ts`** (new) — a small, dependency-free leading+trailing throttle. Deliberately timer-only (no `Date.now()`): tracks a boolean `onCooldown` flag and the most recent pending call's args, using nested `setTimeout` calls that restart the cooldown after each trailing fire so a continuous drag stays bounded for its whole duration, not just the first window. On the very first call (not on cooldown), fires immediately (leading edge). Calls during cooldown just overwrite `pendingArgs`; when the cooldown timer fires, if there's a pending call it fires with the latest args and immediately restarts the cooldown — this is what guarantees the drag's true released position always lands, even though the timer that delivers it was scheduled before that final value existed.

   Chose this over a `Date.now()`-based implementation specifically because it's simpler to reason about and fully deterministic under `vi.useFakeTimers()`/`vi.advanceTimersByTime()` regardless of whether a given vitest version also fakes `Date` — no assumption needed either way.

2. **`TempoSliderContainer.tsx`** and **`VolumeSliderContainer.tsx`** — both gained a `displayTempo`/`displayVolume` local `useState`, seeded from the context value and re-synced via `useEffect(() => setDisplay(...), [contextValue])` whenever the context value changes externally (another client, a reconnect refetch, etc). The slider's `value` and the label now bind to this local state, updated **immediately and unthrottled** on every `onChange` — only the actual `changeTempo`/`changeTrackVolume` call (wrapped via `useMemo(() => throttle(fn, 100), [fn])`) is throttled.

   This split was necessary, not optional, because of how each context setter actually updates: `changeTempo` only updates context `tempo` once the backend ACKs the `set_tempo` emit (round-trip), and `changeTrackVolume` is fire-and-forget with `trackVolume` only updating once a `volume_changed` broadcast comes back. If the emission itself were throttled without a decoupled local value, the slider's bound `value` would only move once every ~100ms _and_ only after a network round-trip — visibly laggy, exactly the ticket's own stop condition ("Throttling makes the on-screen slider feel laggy... tune or stop and ask").

   `VolumeSliderContainer`'s `resetVolume` also updates `displayVolume` immediately (not throttled - it's a discrete click, not a drag) for the same reason: since local state now exists, leaving it out would make the Reset button itself look laggy, a regression relative to today's direct-context-binding behavior.

## Tests

- `src/util/test/throttle.test.ts` — 7 tests using `vi.useFakeTimers()`: leading-edge immediate first call, suppression of calls inside the window, trailing-edge delivery of the most recent args once the window elapses, no redundant trailing call for a single tap, bounded emission count across a 500ms/50-event simulated drag (with the true final value still landing), a fresh leading edge once the cooldown has fully elapsed, and multi-argument pass-through. **Mutation-tested**: disabled the trailing-fire branch and confirmed exactly the two trailing-edge-dependent tests failed, restored and confirmed 7/7 again.
- `src/container/test/TempoSliderContainer.test.tsx` (new) — 4 tests: immediate visual update on change, throttled emission during a rapid drag (1 call, not N), the trailing/final-value guarantee once the window elapses, and a re-sync test using a mutable-closure wrapper + `rerender()` (not a fresh `render()`, which wouldn't exercise the sync path at all) to prove the `useEffect` actually re-syncs `displayTempo` when context `tempo` changes on an already-mounted instance. **Mutation-tested** the re-sync test by deleting the sync `useEffect` and confirming it failed exactly as predicted (stuck at the old value).
- `src/container/test/VolumeSliderContainer.test.tsx` (new) — 5 tests: same coverage as tempo, plus a dedicated test for the Reset button's immediate local update. **Mutation-tested** by removing `setDisplayVolume(RESET_VALUE)` from `resetVolume` and confirming that specific test failed.

## Live verification against the real simulator (required by the ticket)

Ran `yarn sim full-spell` + `yarn dev`, loaded the UI in a real browser. Dispatched 21 rapid native `input` events (via the React-compatible native-setter + `dispatchEvent` technique, all synchronous in one JS tick, to actually land inside the 100ms throttle window — tool-driven click/drag automation is too slow round-trip to prove this on its own) on both the BPM slider (100→140) and a volume slider (0.05→0.65), then read the sim server's log:

- BPM: 21 input events → exactly 2 `set_tempo` emissions logged (`set_tempo 100`, then `set_tempo 140`) — leading edge plus the true final/released value, nothing in between.
- Volume: 21 input events → exactly 2 `set_track_volume` emissions logged (`{"pillar":0,"volume":0.05}`, then `{"pillar":0,"volume":0.65}`), same pattern.

Zero console errors. This directly matches the ticket's acceptance criterion in its own words: "a bounded stream of `set_tempo`/`set_track_volume` events... with the final value always emitted."

## Out of scope / deliberately not done

- Backend throttling — explicitly out of scope; would change behavior for all callers, not just these two sliders.
- Debouncing any other control (key adjuster, keylock toggle, etc.) — explicitly out of scope.
- New dependencies — none added; `throttle.ts` is a from-scratch ~20-line utility per the ticket's own suggestion (no lodash in the frontend).

## Fix round (post general-reviewer, test-engineer, audio-ableton-reviewer review)

General reviewer returned **REQUEST-CHANGES** with two real, independently-reproduced bugs. Both were also independently caught by GitHub Copilot (6 threads) and by the audio-ableton-reviewer (as a disclosed, non-blocking nit in its own APPROVE-WITH-NITS pass) — strong convergent confirmation neither was a false positive.

1. **Reset/pending-throttle race (`VolumeSliderContainer.tsx`).** `resetVolume()` called the raw `changeTrackVolume` directly but never cancelled the throttle wrapper's own pending trailing call. If Reset was pressed while a drag's trailing call was still waiting inside its ~100ms window, that stale dragged value fired _after_ the reset and silently overwrote it — reviewer reproduced the exact emission sequence `0.1 → 0.6(reset) → 0.3(stale drag)`.

   **Fix**: gave `throttle()` a `cancel()` method (`src/util/throttle.ts`) that drops any pending call and resets the cooldown, so the next interaction after a cancel is treated as a fresh leading edge rather than still artificially throttled. `resetVolume` now calls `throttledChangeTrackVolume.cancel()` before sending the reset value.

2. **Mid-drag echo-stutter (both containers).** `useEffect(() => setDisplay(...), [contextValue])` re-fires not just on genuinely _external_ context changes, but also when this same component's own throttled emission gets acked (tempo) or broadcast back (volume) — `OutgoingEvents.emit` broadcasts to every socket including the sender's own. If that echo landed _while the user was still dragging past the leading-edge value_, the display could visibly snap backward to the stale leading-edge value before the eventual trailing emission's own echo corrected it forward again. Audio-ableton-reviewer additionally confirmed this isn't purely cosmetic for tempo: the backend genuinely calls `ableton.song.set('tempo', ...)` with the leading-edge value first, so the blip is a real (if brief) tempo blip, not just a display glitch.

   **Fix**: both containers now track an `isDraggingRef` (set on `onPointerDown`, cleared on `onPointerUp`/`onPointerCancel`/`onBlur`) and skip the context-sync effect entirely while a drag is active — the local, unthrottled display is already authoritative during a live gesture; the sync resumes normally the instant the pointer is released.

Also addressed while these two files were open (all Copilot nits, cheap and already in the touched lines):

- `TempoSliderContainer.tsx`: `parseInt(e.target.value, 10)` — explicit radix.
- `VolumeSliderContainer.tsx`: `contextVolume` rewritten from a truthy check (`trackVolume[pillar] ? ... : 0`, which duplicated the `MAX_VALUE` literal as a separate `0.7`) to `Math.min(trackVolume[pillar] ?? 0, MAX_VALUE)` — behaviorally identical (both forms already produced `0` for a `0` volume) but no longer relies on that coincidence, and reuses the named constant instead of repeating the literal.
- `throttle.ts`: changed from `export function throttle(...)` to `export const throttle = (...) => ...`, matching every other util in the repo (`ColorUtil.ts`, `ClipDatabaseUtil.ts`, `Logger.ts`) — the only stylistic nit, not a correctness issue.

### New regression tests (all independently mutation-tested)

- `throttle.test.ts`: 4 new tests under a `describe('cancel', ...)` block — drops a pending call so it never fires, doesn't affect an already-delivered call, resets the cooldown so the next call is a fresh leading edge, is a no-op with nothing pending. Mutation-tested by emptying `cancel()`'s body: confirmed exactly the 2 cancel-dependent tests failed, restored, 11/11 pass.
- `VolumeSliderContainer.test.tsx`: new test reproducing the exact Reset-race scenario (drag to a pending value, click Reset, advance timers, assert the stale value never fires and the final state is the reset value). Mutation-tested by removing the `.cancel()` call from `resetVolume`: confirmed 3 emissions instead of 2 (the stale `0.3` firing after the reset), exactly as the reviewer's own reproduction predicted. Restored, 7/7 pass.
- `TempoSliderContainer.test.tsx` and `VolumeSliderContainer.test.tsx`: one new test each reproducing the mid-drag echo scenario (`pointerDown` → change past the leading-edge value → simulate the leading edge's own echo arriving via a context rerender → assert the display does _not_ snap back → `pointerUp` → assert a genuinely new external change still syncs normally afterward). Mutation-tested by deleting the `isDraggingRef.current` guard from each container's sync effect: both failed exactly as predicted (display snapped back to the stale echoed value), restored, both pass.

### Live re-verification against the real simulator (fix round)

Re-ran the same 21-rapid-event burst against the BPM slider post-fix: unchanged, still exactly 2 `set_tempo` emissions (90 → 130), confirming the fix round didn't regress the core throttling behavior.

Additionally reproduced the Reset-race scenario live against the real sim server (not just unit tests): dispatched a leading-edge volume change (0.2) followed by a second change (0.35, which queues as the pending trailing call) via the same native-setter+dispatchEvent technique, then immediately clicked the real Reset button in the same script (before any real-world delay could elapse) - sim log showed exactly `set_track_volume 0.2` then `set_track_volume 0.6` (the reset), with **no third stale `0.35` emission** even after waiting a further 2 seconds. DOM value settled correctly at `0.6`. Zero console errors throughout.

### Reviews not re-run

- **test-engineer** (APPROVE-WITH-NITS, no Required): its review covered the pre-fix-round test files, which are unchanged by this round (only new tests were added, nothing it reviewed was modified) — not re-run, its verdict stands as-is for the tests it evaluated.
- **audio-ableton-reviewer** (APPROVE-WITH-NITS): already signed off before this fix round, with the mid-drag echo/tempo-blip risk explicitly disclosed as a non-blocking nit for human awareness. This fix round removes that exact risk rather than just documenting it — not re-run, since the fix strictly improves on what was already approved and doesn't touch any musical-mapping/timing assumption the sign-off was scoped to guard.
- **General reviewer**: re-run required and requested, since its verdict was REQUEST-CHANGES — see its updated verdict for the fix-round SHA.

Did **not** additionally escalate to hardware-safety-reviewer despite the general reviewer's suggestion (its own profile requires that escalation "for anything touching volume"): the volume range is hard-capped at `MAX_VALUE = 0.7` regardless of which value momentarily won the race, so the failure mode was never "unsafe/too-loud," only "operator's reset gesture temporarily not honored" — and the fix eliminates that failure mode entirely rather than leaving it to be judged safe-enough. Documented here for transparency; happy to add that review if the human disagrees with this scoping call.

## Validation

- [x] `yarn lint` clean
- [x] `npx tsc --noEmit` (root) clean
- [x] `yarn test` — 91/91 (84 + 7 new)
- [x] `yarn build` clean
- [x] Manual sim smoke test — see above (both the original throttling behavior and the fix-round's Reset-race fix, live)

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `Arduino/`, `.env` — N/A
- [x] No new/renamed socket.io event names — `set_tempo`/`set_track_volume` payloads and semantics unchanged, only emission timing changed
- [x] No new dependencies
- [x] Touches tempo adoption path (musical) — **audio-ableton-reviewer sign-off required per this ticket's safety notes** — obtained (APPROVE-WITH-NITS, disclosed risk since fixed in this same round)
- [x] Reduces load on Ableton/lighting/OSC paths, does not change payload or event names, per the ticket's own safety notes
