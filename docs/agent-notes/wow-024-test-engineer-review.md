# WOW-024 — test-engineer review (PR #24)

Date: 2026-07-12
Reviewer: test-engineer subagent (Claude Sonnet 5)
Branch: `feat/wow-024-debug-modal-connection-indicator` (Amsvartner fork, PR #24), stacked on `feat/wow-016-debug-modal-spaced-names` (base, unmerged — intentional). Reviewed at commit `6773681` (confirmed identical to `gh pr view 24`'s `headRefOid`).
Scope: verify the connection-tracking `useEffect` against its stated `useAbletonContextProviderState.ts` precedent; confirm the `toggleSong` guard is real defense-in-depth; confirm the WOW-016 fixture change was necessary; scrutinize all 4 new tests for vacuousness; independently judge the "connect transition" testing claim; verify the `ResizeObserver` polyfill claim and check for pollution; re-run full validation; confirm `ClipButton.tsx` is untouched.

**Verdict: APPROVE-WITH-NITS**

---

## Required (blocking)

None.

---

## Validation (commands I actually ran, against the unmodified branch)

- `yarn test` → **73/73 passed** (14 files). Matches the PR body's claim exactly.
- `yarn test src/container/test/DebugModalContainer.test.tsx` → **5/5 passed**. Matches.
- `yarn lint` → clean (only the pre-existing, unrelated "React version not specified in eslint-plugin-react settings" warning, consistent with WOW-019's independent review).
- `npx tsc --noEmit` → clean, no output.
- `yarn build` → clean (`tsc && vite build`, 160 modules, only pre-existing Browserslist/font-resolution notices).
- `git status --short` / `git diff` clean before and after all experimentation below (see items 3–5).

---

## 1 — Core connection-tracking `useEffect`: correct, matches its stated precedent

Read `DebugModalContainer.tsx`'s new effect side by side with `useAbletonContextProviderState.ts:105-112`. Both gate on the same `if (!socket.connected) return;` check before ever calling `.on`. This is real, not just an asserted similarity.

- **(a) Mount with the disconnected placeholder.** `useSocketContextProviderState.ts:10` confirms the real placeholder is `{} as Socket` — a bare object, no `connected`, no `.on`/`.off`/`.emit`. `Boolean(socket.connected)` → `Boolean(undefined)` → `false`, so `isConnected` initializes `false`. The effect then does `setIsConnected(Boolean(socket.connected))` (redundant no-op) and `if (!socket.connected) return;` — `.on()` is never reached. No crash, confirmed by code reading. **Caveat:** none of the 4 new tests actually use the bare `{}` shape — `createFakeSocket(false)` still defines `.on`/`.off`/`.emit` stubs regardless of `connected`, so the specific `TypeError: socket.on is not a function` crash mode this ticket exists to prevent is verified only by reading the code, not by a test using the true placeholder shape (see Nits — this matches the file's pre-existing convention, so not a regression).
- **(b) Live disconnect/reconnect on an already-connected socket.** Traced `createFakeSocket`'s `trigger()`: mirrors real socket.io-client by flipping `.connected` and invoking registered handlers. Confirmed both directions fire correctly (tests 3 and 4, see item 3).

Because `useSocketContextProviderState.ts` only ever calls `setSocket(sock)` from inside `sock.on('connect', ...)` (line 18-19), the socket reference `DebugModalContainer` receives is either the bare placeholder or an already-`connected: true` object — the same-object "flips from disconnected to connected" case genuinely cannot happen via that provider. This is important context for item 4 below.

## 2 — `toggleSong`'s guard is real defense-in-depth

Confirmed by reading (`if (!isConnected) { Logger.warn(...); return; }` precedes both `socket.emit` branches) and empirically via the experiment in item 3: reverting the WOW-016 test's fixture to `{ emit }` (no `connected`) caused the guard to fire and block `emit` entirely, independent of any CSS — direct proof this guard functions with no dependency on `pointer-events-none`.

## 3 — Fixture change was necessary; new tests are non-vacuous

Empirically confirmed, not just reasoned: temporarily reverted the WOW-016 test's socket fixture to the pre-PR `{ emit } as unknown as Socket` and reran just that test. It failed exactly as predicted — `expect(emit).toHaveBeenCalledWith(...)` received 0 calls, with `"Ignored clip toggle: socket not connected"` logged — because `{ emit }`'s `.connected` is `undefined`, so the new guard trips. Restored the fixture; confirmed `git diff` empty afterward. The change was necessary, not scope creep.

All 4 new tests read individually: each pairs a `getByText`/`queryByText` assertion on the "Connecting to backend…" banner (a real UI-state discriminator) with a click + `emit`/`not.toHaveBeenCalled` assertion carrying actual argument checks, not just "didn't throw." None are vacuous. Tests 3–4 in particular prove the persistent listener wiring itself works (not just the initial `useState` computation) — if `.on('disconnect', ...)` were never attached, or attached under the wrong event name, the banner would not reappear and these would fail.

## 4 — "Connect transition" claim: independently verified false, but not a functional defect

The PR/agent-note claims the true placeholder→connected transition "isn't cleanly testable through `render()`'s wrapper API," citing WOW-019's `renderHook` limitation as precedent. I did not take this on trust. I wrote a throwaway test using a **mutable closure variable** read by the `SocketContext.Provider`'s `value`, mounted with the literal `{} as Socket` placeholder, then reassigned the variable to a live connected fake and called `rerender()`:

```
let currentSocket: unknown = {} as Socket;
const wrapper = ({ children }) => <SocketContext.Provider value={currentSocket as Socket}>...
const { rerender } = render(<DebugModalContainer .../>, { wrapper });
// assert disconnected UI
currentSocket = createFakeSocket(true);
act(() => { rerender(<DebugModalContainer .../>); });
// assert connected UI + working emit
```

**This passed** (ran it: 6/6 including the experiment; then reverted the file, confirmed `git diff` empty). So the literal transition the PR calls untestable is, in fact, testable — and the shipped implementation handles it correctly.

Checking the cited precedent: WOW-019's actual documented limitation (`docs/agent-notes/wow-019-frontend-implementer-reconnect-resync.md`, verified by reading `node_modules/@testing-library/react/dist/pure.js`) is specifically that `renderHook`'s `initialProps`/`rerender(newProps)` never thread into the `wrapper` component. That's a real, correctly-diagnosed, narrow constraint — but it's a `renderHook`-specific convenience-API limitation, not a general limitation of `render()`'s wrapper API. WOW-024's test file uses `render()`, not `renderHook()`, and `render()`'s `rerender()` has no such constraint once the wrapper closes over a mutable variable. The analogy over-generalizes a narrower, correctly-diagnosed finding into a broader claim that doesn't hold.

**Severity call:** not Required. No functional bug exists — my experiment proves the shipped code handles the literal transition correctly too. The 4 shipped tests are real and map defensibly onto the ticket's three named scenarios (pre-connect click, disconnect transition, and "connect transition" read as reconnect — arguably the more operationally relevant case given the ticket's own bug narrative is about a backend-restart window). This is a documentation-accuracy/rigor gap, not a coverage hole with a live bug behind it. Recommending a fix as a Nit.

## 5 — `ResizeObserver` polyfill: claim verified true, no pollution concern

- **jsdom really doesn't implement it**: `grep -ril ResizeObserver node_modules/jsdom/lib/` returns nothing (jsdom 21.1.1 installed). Confirmed from source, not assumed.
- **Tests really need it**: temporarily disabled the polyfill assignment and ran the file. Exactly the 4 new tests failed with `ReferenceError: ResizeObserver is not defined`, thrown from `@headlessui/react/dist/components/dialog/dialog.js`; the pre-existing WOW-016 test still passed (1 passed, 4 failed). Restored the polyfill; confirmed `git diff` empty afterward. Matches the PR's claim precisely.
- **No pollution concern**: `node_modules/vitest/dist/config.js` sets `isolate: true` as Vitest 0.28.5's default, and `vite.config.ts` doesn't override it. Each test file gets an isolated module/global scope under this project's actual (unmodified) configuration, so the unconditional module-scope `global.ResizeObserver ??= ...` cannot leak into other test files. Not a defect.

## 6 — Full suite / lint / tsc / build

All confirmed clean and matching the PR's claims exactly — see Validation above.

## 7 — `ClipButton.tsx` untouched

Confirmed two ways: `git diff --stat` against the base shows only 3 files touched (`docs/agent-notes/wow-024-...md`, `DebugModalContainer.tsx`, `DebugModalContainer.test.tsx`) — `ClipButton.tsx` isn't among them. Read `ClipButton.tsx` directly: `Props` has `clipName`/`stopping`/`playing`/`queued`/`onClick`, no `disabled`. The grid-level `opacity-50 pointer-events-none` wrapper in `DebugModalContainer.tsx` is a legitimate way to achieve inertness without touching a file outside this ticket's allowed list.

---

## Nits

1. **"Connect transition" claim is overstated (see item 4).** Recommend a follow-up: add the literal placeholder→connected `rerender()`-based test (pattern proven above), and correct the agent-note's claim that this is untestable via `render()`'s wrapper API — the real, narrower WOW-019 limitation is specific to `renderHook`'s prop-threading, not `render()` in general. Left uncorrected, this becomes a citable-but-wrong precedent for future tickets.
2. **No test uses the literal bare placeholder shape.** All fakes (`createFakeSocket`) define `.on`/`.off`/`.emit` stubs regardless of `connected`, so the exact crash mode this ticket exists to prevent is proven only by code reading, not by a test against the true `{} as Socket}` shape. Matches this file's pre-existing convention (the old WOW-016 fixture wasn't bare either), so not a regression — worth strengthening if this file is touched again.
3. **Pre-existing, not introduced by this PR**: `act()` console warnings ("An update to ye... not wrapped in act(...)") fire on every test in this file, including the unchanged WOW-016 test — traced to `@headlessui/react`'s `Transition` component's internal lifecycle, unrelated to this ticket's logic. Cosmetic noise, not a failure.

---

## Summary

Read the connection-tracking effect against its stated `useAbletonContextProviderState.ts` precedent and confirmed the pattern is correct: no crash on the disconnected placeholder, correct live disconnect/reconnect handling. Confirmed the `toggleSong` guard is real defense-in-depth, empirically. Confirmed the WOW-016 fixture change was necessary by reverting it and watching the predicted failure. All 4 new tests are genuine, non-vacuous. Independently disproved the PR's central testability claim about the "connect transition" by writing and running a passing counter-example, but found no functional defect behind it — the shipped code handles the literal transition correctly too, so this is a documentation/rigor nit, not a blocker. Verified the `ResizeObserver` polyfill claim empirically in both directions (fails without it, passes with it) and confirmed no cross-file pollution given this project's Vitest defaults. Full suite/lint/tsc/build all clean, matching the PR's claims exactly. `ClipButton.tsx` confirmed untouched. No required changes.
