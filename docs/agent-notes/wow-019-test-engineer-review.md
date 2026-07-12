# WOW-019 — test-engineer review (PR #23)

Date: 2026-07-12
Reviewer: test-engineer subagent
Branch: `feat/wow-019-frontend-reconnect-resync` (Amsvartner fork, PR #23 → `main`)
Scope: test-engineer lens — verify the PR's central factual claim about socket.io-client from the library's own source (not just the PR's reasoning), confirm the code matches its own description, form an independent judgment on the API-surface stop condition, scrutinize every new/changed test for vacuousness, and independently re-run the full validation suite.

**Verdict: APPROVE-WITH-NITS**

---

## Required

None.

---

## Verification detail

**1. Does socket.io-client really re-fire `'connect'` on the same `Socket` object after a reconnect?**
Yes — confirmed by reading the installed package itself (`socket.io-client@4.6.1`, `node_modules/socket.io-client/build/esm/{socket,manager}.js`, `@socket.io/component-emitter/index.js`), not by trusting the PR's comments. Traced the actual call chain for a transport-level drop (e.g. backend process restart, not a server-initiated `disconnect`):
`Manager.onclose()` (engine close) → `Manager.reconnect()` (backoff timer, `_reconnection` defaults true) → `Manager.open()` (new engine transport, **same `Manager`**) → `Socket.onopen()` (subscribed exactly once in `subEvents()`, guarded by `if (this.subs) return`, so never re-subscribed) → `_sendConnectPacket()` → server CONNECT ack → `Socket.onpacket()` → `Socket.onconnect()` → `this.emitReserved("connect")` — all on the same `this` (the same `Socket` instance). `Socket.destroy()` (which tears down `subs` and would break this) is only called on server-initiated disconnect or a manual `.disconnect()`, not on an ordinary transport drop/reconnect. `component-emitter`'s `emit()` (index.js:130-148) dispatches listeners via a plain indexed loop over the registered array (FIFO, registration order) — confirms listeners persist and fire repeatedly, nothing "once"-shaped anywhere. The `.d.ts` also types `connect: () => void` as a plain repeatable reserved event. **The PR's central claim is true**, verified from the library, not the PR body.

**2. Does the code match the PR's description?**
Yes, read both files in full on this branch. `useSocketContextProviderState.ts`: effect deps changed `[socket.connected]` → `[]`; new cleanup `sock.offAny(); sock.disconnect();`. `useAbletonContextProviderState.ts`: `socket.on('connect', getTracksAndClips)` added alongside the other per-event listeners, `socket.off('connect', getTracksAndClips)` added to the matching cleanup. Matches the PR body verbatim.

**3. Does this genuinely avoid the "provider/context API surface" stop condition?**
Independent judgment: yes. `git diff main --name-only` touches exactly 5 files (2 hooks, 2 test files, 1 new agent-note) — no `SocketContext.ts`, `useSocketContext.ts`, `AbletonContextState.ts`, `SocketProvider.tsx`, or `AbletonProvider.tsx`. Read `SocketContext.ts`/`useSocketContext.ts` directly (not just trusted the diff): still `createContext<Socket | null>(null)` and `if (!state) throw`, byte-identical to `main`. The `useAbletonContextProviderState()` return shape (the `useMemo`'d object) is untouched by the diff. Given point 1 is true, the fix works purely by adding an event-listener registration to the existing `Socket` object — no reason it would need to touch context typing. No hidden API-surface change found anywhere.

**4. Are the new tests in `useAbletonContextProviderState.test.tsx` meaningful?**
Read all 5. Tests 1-2 (placeholder doesn't throw; initial connect fetches once) are baseline coverage, not reconnect-specific — reasonable since this hook had zero prior coverage. Test 3 (re-fetch on repeated `trigger('connect')`) is the core regression test and is unambiguous. Test 5 (unmount unsubscribes) is real and would fail if the new `off('connect', ...)` cleanup line were dropped.
Test 4 ("does not accumulate duplicate subscriptions") — scrutinized specifically per your request. It is **not vacuous**, but its mechanism is worth understanding precisely: `fake.emit` is a bare `vi.fn()` that never invokes its ack callback, so `trigger('connect')` never causes a React state update or re-render, which means the `useEffect(..., [socket])` body can only physically execute once in this test regardless of how many times `trigger` fires — so the "no re-registration" result is partly guaranteed by how `useEffect` deps work once you know `socket`'s reference never changes in this harness. That said, it is real regression protection, not tautological: it would fail against several plausible wrong implementations, e.g. a handler that re-registers itself inside its own body, or — notably — a naive version of the ticket's own suggested `connectionEpoch`-counter design if implemented by adding `connectionEpoch` to the effect's deps without off-ing prior listeners first (that would make `clip_started`/`master-key_changed` handler counts grow on each trigger; this test would catch it). I verified this isn't just theoretical: reasoning through what `git stash`-reverting `useAbletonContextProviderState.ts` does to this exact test file, tests 3 and 4 are the two that go red (test 4 fails because `handlerCount('connect')` becomes 0, not the expected 1) — consistent with the PR's "2 of 5 failed" claim.

**5. `yarn test src/context/hook/test/`** — ran it myself: **14/14 passed** (4 test files), matching the PR's claim.

**6. `useSocketContextProviderState.test.tsx`'s 2 new tests** — read both. "disconnects and removes onAny listeners on unmount" calls `unmount()` and asserts `offAny`/`disconnect` were each called once — genuinely exercises the new cleanup path via React's real unmount lifecycle, not a stub. "does not disconnect just because the socket becomes connected" fires the fake `'connect'` handler (a real `setSocket` state update via `act()`) and asserts `disconnect` was _not_ called and `ioMock` was only called once — this is a real guard against a plausible bad merge of this fix (adding cleanup without also fixing the deps array back to `[]`, which would reintroduce create/teardown churn, now actively disconnecting the live socket on every connect event — worse than the pre-fix bug). Neither test is trivial.

**7. Full validation, run independently:**

- `yarn test` → **75/75 passed** (14 test files), matches PR claim exactly.
- `yarn lint` → clean (only the pre-existing, unrelated "React version not specified in eslint-plugin-react settings" warning).
- `npx tsc --noEmit` → clean, no output.
- `yarn build` → clean, succeeded (`tsc && vite build`, 160 modules transformed).
- Confirmed no `package.json`/`yarn.lock` diff (no new dependencies), and no files outside the ticket's allowed list touched.

**8. Live-verification log sequence plausibility.**
Traced every `Logger.debug` call site in both files. `useSocketContextProviderState.ts`'s `sock.on('connect', ...)` handler (unconditionally logs `"Connected to socket.io server"`) is registered once at mount and was never the buggy part — it already fired on every reconnect before this PR too. Of `getTracksAndClips`'s six `socket.emit(...)` calls, exactly four have a `Logger.debug` in their ack callback (`get_track_volumes`, `get_playing_clips`, `get_queued_clips`, `get_tempo`); `get_master-key` and `get_keylock_state` do not log — matching the PR's claimed sequence exactly (four named logs, not six). Ordering: `useAbletonContextProviderState`'s `'connect'` listener can only be registered _after_ the first connect has already round-tripped once (it's gated behind `socket.connected` becoming true via context, which itself depends on the first `'connect'` firing), so on any given `'connect'` dispatch `useSocketContextProviderState`'s handler is necessarily earlier in the listener array than `useAbletonContextProviderState`'s — and `component-emitter` dispatches in registration order. So "Connected to socket.io server" logging before the four `get_*` returned lines is not a coincidence the PR got lucky with; it follows from the code's structure. Plausible and internally consistent.

---

## Nits

- **Mock convention.** `CODING_GUIDELINES.md`'s testing section says reusable test doubles with "grown helpers or state" belong in a `mock/` folder as `XxxMock.ts`. The new `createFakeSocket()` in `useAbletonContextProviderState.test.tsx` (multi-listener arrays, `trigger`/`handlerCount` helpers) and the pre-existing inline fake in `useSocketContextProviderState.test.tsx` (single-handler map) are both now past that threshold and structurally divergent. Not blocking — `mock/` wasn't in this ticket's allowed files, and it matches the pre-existing local precedent — but worth consolidating into a shared `SocketMock.ts` on a future ticket. (I independently reached this same conclusion before noticing `docs/agent-notes/wow-019-reviewer-verdict.md` already flagged it too — corroborating, not duplicated effort.)
- Worth being explicit in the record (not a defect): the "no duplicate subscriptions" test's guarantee is partly structural to this test harness (see point 4 above) rather than proof that React would de-duplicate under every possible implementation. It still meaningfully pins the chosen design and would catch realistic regressions.

---

## Summary

Independently confirmed, from the installed `socket.io-client` source itself, that `'connect'` genuinely re-fires on the same persistent `Socket` object after every reconnect — the PR's load-bearing factual claim holds. Read both hook files on the branch and confirmed they match the PR's description exactly. Confirmed via diff scope and direct file reads that `SocketContext`/`useSocketContext` are untouched and no provider API surface changed, so the design legitimately avoids the ticket's stop condition rather than sidestepping it. All new/changed tests were read individually; none are vacuous, though the "no duplicate subscriptions" test's certainty rests partly on this specific harness's mechanics (documented above) rather than pure black-box proof — still real protection. Independently ran `yarn test` (75/75), `yarn lint` (clean), `npx tsc --noEmit` (clean), and `yarn build` (clean) — all match the PR's claims. The live-verification console sequence in the PR body is plausible and explainable directly from the `Logger.debug` call sites and listener registration order. No required changes.
