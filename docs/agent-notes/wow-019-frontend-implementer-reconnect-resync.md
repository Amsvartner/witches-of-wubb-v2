# WOW-019 — Frontend never re-syncs state after a backend restart or reconnect

## The bug

`useSocketContextProviderState.ts`'s effect depended on `[socket.connected]`
and created a new `io(...)` connection exactly once (guarded by
`if (!socket.connected)`), assigning the resulting `Socket` to state via
`setSocket(sock)` inside a `'connect'` handler. That handler was never
removed, so it fired again on every future reconnect too — but calling
`setSocket(sock)` with the _same_ object reference (socket.io-client reuses
one `Socket` instance across reconnects; it doesn't create a new one) is a
no-op for React (`Object.is` bails out, no re-render). `useAbletonContextProviderState.ts`'s
subscription effect depends on `[socket]`, so it never re-ran either, and its
one-time `getTracksAndClips()` call was never repeated. Net effect: after a
backend restart or any socket.io auto-reconnect, the touchscreen kept
showing whatever tempo/clips/volumes were true _before_ the disconnect,
forever, until someone manually reloaded the page.

## Why this avoids the ticket's own stop condition

Both this ticket and WOW-024 name the same stop condition: "if the fix
requires changing the provider/context API surface consumed by containers →
stop and propose first." The ticket's own suggested shape — a
`connectionEpoch` state counter, and "consider replacing the placeholder
cast with `Socket | null`" — would have required exactly that: `SocketContext`'s
carried value (currently a bare `Socket`, used unchanged by every consumer)
would need to grow an epoch/counter or a nullable type, and `useSocketContext()`'s
existing `if (!state) throw(...)` guard would need to change to tell "outside
a `<SocketProvider>`" apart from "inside one, but not connected yet" — both
genuinely `null`-shaped context states under that design. That's an API
surface change touching every consumer of `useSocketContext()`, not just the
two files this ticket is scoped to.

Implemented differently, avoiding that entirely: `getTracksAndClips` (already
a stable `useCallback` keyed on `socket`, unchanged) is now _also_ registered
as a `'connect'` listener, alongside the existing per-event listeners, inside
the same one-time subscription effect. socket.io-client fires `'connect'`
again on the same persistent `Socket` object after every successful
reconnect (not just the first connection) — so this listener, attached once
and torn down only on unmount, catches every future reconnect without the
effect needing to re-run and without `SocketContext`'s type or
`useSocketContext()`'s behavior changing at all. Zero other consumers
(`DebugModalContainer.tsx` included — relevant for the paired WOW-024 ticket)
need to change anything to keep working.

## Changes

- `useSocketContextProviderState.ts`: the connection-creation effect now runs
  exactly once (`[]` deps, not `[socket.connected]`) — it no longer tears
  down and could-in-theory-recreate the connection just because `.connected`
  flips. Added a cleanup function: `sock.offAny(); sock.disconnect();` on
  unmount (previously: no cleanup at all).
- `useAbletonContextProviderState.ts`: added `socket.on('connect', getTracksAndClips)`
  alongside the existing per-event listeners in the subscription effect, and
  the matching `socket.off('connect', getTracksAndClips)` in its cleanup.

## Tests

- `useSocketContextProviderState.test.tsx`: extended the existing `FakeSocket`
  mock with `offAny`/`disconnect` spies; added two tests — cleanup fires on
  unmount, and connecting does _not_ trigger a disconnect (guards against a
  regression where the empty-deps rewrite accidentally reintroduces
  create/teardown churn).
- `useAbletonContextProviderState.test.tsx` (new file — this hook had zero
  test coverage before this ticket): a hand-rolled `FakeSocket` supporting
  multiple listeners per event (tracked via arrays, not the single-handler
  map `useSocketContextProviderState.test.tsx`'s own mock uses — needed here
  specifically to make "no duplicate subscriptions accumulate" assertable).
  Covers: placeholder socket doesn't crash or fetch; an already-connected
  socket fetches once and subscribes; **the core fix** — calling
  `fake.trigger('connect')` a second and third time (simulating socket.io
  re-firing the event on the same object, no rerender, no new reference)
  re-triggers `getTracksAndClips` each time; repeated reconnects don't
  accumulate duplicate listener registrations (asserted via handler counts,
  matching the ticket's own acceptance criterion almost verbatim); unmount
  tears down every listener including the new `'connect'` one.
  Confirmed the new tests actually catch the regression: temporarily
  reverted both hook files (`git stash`) and reran this file — 2 of 5 tests
  failed exactly as expected, both on the reconnect-specific assertions.

Note on `@testing-library/react` v14: `renderHook`'s `initialProps`/`rerender`
only thread into the render _callback_, never into the `wrapper` component
(confirmed by reading `node_modules/@testing-library/react/dist/pure.js` —
the wrapper is always instantiated with `null` props). So the new test file
can't simulate a placeholder→connected _transition_ via `rerender` the way
an initial draft attempted; each test instead builds its own inline wrapper
closing over the socket it wants in context from the start. This doesn't
weaken coverage of the actual bug (the reconnect tests render directly with
an already-connected fake socket and drive reconnects via `fake.trigger`,
which is the realistic scenario — a real disconnect/reconnect never changes
the object reference either).

## Live verification (manual sim restart smoke, per the ticket's requirement)

Ran `yarn sim full-spell` + `yarn dev` in a real browser. Let the scenario
play for a few seconds (two clips playing, master key `4A` visible), then
**stopped the sim server process** (simulating a backend crash/restart) and
**restarted it**. Console output showed, in order: `"Connected to socket.io
server"` (the reconnect firing) immediately followed by `get_track_volumes
returned`, `get_playing_clips returned`, `get_queued_clips returned`,
`get_tempo returned` — the re-fetch triggering automatically. A follow-up
screenshot confirmed the UI updated (new scenario state, same master key)
with **no page reload**. Zero console errors throughout. This is the exact
acceptance criterion ("killing and restarting the simulator while the UI
runs results in the UI re-fetching and showing correct state without a
reload"), verified live, not just via mocked tests.

## Out of scope / deliberately not done

- **Offline/disconnected UI treatment** (`useAbletonContextProviderState.ts`'s
  `// TODO: Show in UI` comment, left untouched) — explicitly out of scope
  per the ticket; that's WOW-024's concern (operator-facing debug modal
  only) and the general visitor-facing case is a separate, still-open UX
  decision.
- **`Socket | null` / `connectionEpoch` redesign** — considered and
  deliberately not pursued; see "Why this avoids the ticket's own stop
  condition" above.
- **socket.io version changes** — untouched, matching the ticket.
