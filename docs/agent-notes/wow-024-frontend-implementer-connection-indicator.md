# WOW-024 — Debug modal connection indicator, no emit before connected

## The bug

`useSocketContextProviderState.ts`'s socket context hands out an empty
placeholder object (`{} as Socket`) until the first connection. Before this
ticket, `DebugModalContainer.tsx` called `socket.emit(...)` unguarded in
`toggleSong` — clicking any clip while the placeholder was still in place
threw `socket.emit is not a function` (silent console `TypeError`, no
operator-visible feedback), and there was no visual cue distinguishing
"connected" from "still starting up." Observed live 2026-07-10 per the
ticket: operator clicked samples during the backend's ~1-minute Ableton
startup and got silent failures with no way to tell what was wrong.

## Design: no stacking on WOW-019, stacks on WOW-016 instead

This ticket's allowed files (`useSocketContextProviderState.ts`,
`useAbletonContextProviderState.ts` "only if the context shape change
requires it", `DebugModalContainer.tsx`, `test/**`) overlap WOW-019's
touched files by name only, not by actual need — WOW-019's own design
(documented in its own agent-note) deliberately avoided any context/provider
API surface change, so there's nothing WOW-024 needs FROM that branch. The
`isConnected` signal this ticket needs is derived entirely locally, inside
`DebugModalContainer.tsx`, from the same unchanged `useSocketContext()` this
file already called - `useSocketContextProviderState.ts` and
`useAbletonContextProviderState.ts` are untouched by this PR.

What this branch _does_ stack on: `feat/wow-016-debug-modal-spaced-names`
(PR #18), because that ticket already fixed the exact same file
(`DebugModalContainer.tsx`'s `toggleSong` call site, for the unrelated
spaced-clip-name crash). Branching from `main` would have silently
reintroduced WOW-016's bug once both PRs eventually merge in the wrong
order; branching from WOW-016's tip avoids that risk entirely.

## The fix

`DebugModalContainer.tsx`:

- New `isConnected` state, initialized from `Boolean(socket.connected)`.
- A `useEffect` depending on `[socket]` (mirroring
  `useAbletonContextProviderState.ts`'s identical existing guard) that:
  syncs `isConnected` to the socket's current state whenever the reference
  changes, and - only once the socket is actually connected-capable -
  attaches persistent `'connect'`/`'disconnect'` listeners that flip
  `isConnected` live. These stay attached for the socket's lifetime (torn
  down only on unmount or a reference change), so they correctly track
  future reconnects too, not just the first connection - same underlying
  socket.io-client behavior WOW-019 already verified (against the actual
  library source) for its own reconnect fix.
- `toggleSong` now returns early (logging a warning, never calling
  `socket.emit`) if `!isConnected` - a defense-in-depth backstop.
- UI: a "Connecting to backend…" banner shown only while `!isConnected`,
  and the entire clip-button grid gets `opacity-50 pointer-events-none`
  while disconnected. **`ClipButton.tsx` itself is untouched** (it isn't in
  this ticket's allowed files, and has no `disabled` prop to add one
  without touching it) - the grid-level wrapper achieves both the visual
  dimming and functional inertness without needing one. Confirmed live in a
  real browser: `pointer-events-none` actually prevents a genuine mouse
  click from ever reaching the button (unlike `fireEvent.click()` in a
  jsdom test, which bypasses CSS pointer-events entirely - so the `toggleSong`
  guard is the thing the component tests can exercise, while the CSS layer
  is the thing that actually protects a real operator's real click).

## Tests (`DebugModalContainer.test.tsx`)

- Updated the existing WOW-016 regression test's fake socket to include
  `connected: true, on: vi.fn(), off: vi.fn()` - it was `{ emit }` alone
  before, which is what a _disconnected_ socket now correctly gets treated
  as under this ticket's own new gating logic, and would have made that test
  fail for a reason unrelated to what it actually verifies (the spaced-name
  unqueue behavior, not connection state). This is a necessary update, not
  scope creep - the alternative would be a spuriously broken regression test.
- 4 new tests: pre-connect (indicator shown, click produces no `emit` call),
  already-connected (no indicator, click emits correctly), live disconnect
  (indicator reappears, clicks become inert again), live reconnect (indicator
  clears again, clicks work again). "connect transition" in the ticket's
  required-tests line is interpreted here as the reconnect-after-disconnect
  case specifically, not "mounts mid-connection, then the placeholder swaps
  for the real socket" - that transition is a React context _reference_
  change that (like the `renderHook` limitation WOW-019 already documented)
  isn't cleanly simulatable through `render()`'s wrapper API, and isn't the
  scenario that actually matters for a socket already live in the tree.
- Added a scoped `ResizeObserver` polyfill to this test file. jsdom doesn't
  implement it, and `@headlessui/react`'s `Dialog` uses it internally; the
  gap was pre-existing but never triggered by this file's original
  single-render test - the new tests' extra `act()`-flushed render cycle
  (simulating live connect/disconnect) reaches the code path that needs it.
  Scoped to this file rather than the shared `src/test/setup-tests.ts`,
  which isn't in this ticket's allowed files.

## Live verification (manual smoke, per the ticket's requirement)

Ran `yarn dev` with no backend, opened the debug modal (the hidden
bottom-left button on the main screen) - confirmed the "Connecting to
backend…" banner, the dimmed clip grid, and that a real mouse click on a
clip toggle produced zero console errors and no visible effect (CSS
`pointer-events-none` blocked it at the browser level - stronger than the
component-test's `toggleSong` guard, which is what actually gets exercised
under `fireEvent.click()`). Then started `yarn sim full-spell` - watched the
banner disappear and the grid return to full color within seconds, with the
sim's live scenario state (playing/queued clips) correctly reflected. Used
an element ref (not raw pixel coordinates, which drifted as new rows
appeared) to click a real playing-clip toggle - confirmed it correctly
stopped that clip, replaced on its pillar by the scenario's next scripted
placement. Zero console errors throughout both phases.

## Out of scope / deliberately not done

- **`ClipButton.tsx`** - not in this ticket's allowed files; achieved the
  same disabled/inert requirement via the grid-level wrapper instead.
- **Visitor-facing main-screen disconnected treatment** - explicitly out of
  scope per the ticket; the `// TODO: Show in UI` comment in
  `useAbletonContextProviderState.ts` is untouched (also not this ticket's
  file to edit unless the context shape changed, which it didn't).
- **Reconnect/re-sync data logic** - that's WOW-019, already shipped
  separately; this ticket only adds the connection-status _indicator_.
- **Any event contract change** - zero new socket.io event names; `connect`/
  `disconnect` are the pre-existing socket.io-client lifecycle events, not
  application events.
