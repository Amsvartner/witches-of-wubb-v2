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

## Validation

- [x] `yarn lint` clean
- [x] `npx tsc --noEmit` (root) clean
- [x] `yarn test` — 84/84
- [x] `yarn build` clean
- [x] Manual sim smoke test — see above

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `Arduino/`, `.env` — N/A
- [x] No new/renamed socket.io event names — `set_tempo`/`set_track_volume` payloads and semantics unchanged, only emission timing changed
- [x] No new dependencies
- [x] Touches tempo adoption path (musical) — **audio-ableton-reviewer sign-off required per this ticket's safety notes** — requested in PR
- [x] Reduces load on Ableton/lighting/OSC paths, does not change payload or event names, per the ticket's own safety notes
