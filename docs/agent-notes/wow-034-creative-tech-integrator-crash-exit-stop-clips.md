# WOW-034 — creative-tech-integrator handoff (bounded crash-exit `stop_all_clips`)

Date: 2026-07-12
Executor: Claude Sonnet 5
Branch: `feat/wow-034-crash-exit-stop-clips` (stacked on `feat/wow-014-crash-hardening` @ `c235678`, PR #16 — same file, same handlers; not stacked on `feat/wow-032-startup-timeout`, which is a sibling touching a different call site in the same two files)

## Why this ticket exists

The WOW-014 hardware-safety-reviewer sign-off (`docs/agent-notes/wow-014-hardware-safety-reviewer-signoff.md`, section 2) found that WOW-014's new `unhandledRejection`/`uncaughtException` handlers log then `process.exit(1)`, but neither they nor any prior code path ever tells Ableton to stop. A crash — old-style (already fatal pre-WOW-014) or new-style (via these handlers) — leaves whatever is playing/looping on each pillar audible indefinitely until a human notices and restarts the backend. The reviewer explicitly declined to block WOW-014's merge on this (it's a pre-existing gap, not introduced or worsened by that ticket) but recommended a specific, bounded follow-up: "a bounded (e.g. 1-2s timeout, wrapped in its own try/catch, never delaying `process.exit(1)` beyond that bound) best-effort 'stop all clips on all 4 pillars' attempt inside the two new handlers."

This ticket (WOW-034, self-assigned from that recommendation, added to `docs/TICKETS_002_BUGS.md`) investigates whether that's actually safe to build, and builds it if so.

## Investigation before writing any code

Three questions had to be answered before touching the crash path, since getting any of them wrong risks making crash-exit worse (a hang) rather than better:

1. **Can `ableton-js`'s `sendCommand` hang forever if Ableton is unresponsive or the crash is Ableton-connection-related?** Checked the pinned version (`ableton-js@3.1.5`, resolved via `backend/yarn.lock`) against its upstream source at tag `v3.1.5`. `sendCommand(command, timeout = 2000)` has a built-in 2000ms default timeout implemented via `setTimeout` + `Promise` rejection (`TimeoutError`) — an individual command cannot hang indefinitely even in the worst case. Transport is UDP on localhost (`dgram`, `udp4`), not a protocol that itself blocks on a broken connection.
2. **Is 2000ms per command a tight enough bound on its own?** No — `handleTimeout()` (the existing idle-timeout stop-all-4-tracks routine) awaits each track's `sendCommand` sequentially in a loop, which could cost up to ~4× the per-command timeout (~8s worst case) if reused as-is. That is far outside the reviewer's stated 1-2s target, so the new crash-path function dispatches all 4 `sendCommand` calls **in parallel** (`Promise.all` over `.map(...)`, each individually `.catch()`-guarded so one slow/failed track can't block the others) rather than reusing `handleTimeout`'s sequential loop.
3. **What if the crash happens before Ableton has finished connecting (`tracks` still unpopulated)?** `tracks` is a module-level `let` in `AbletonAdapter.ts`, only assigned inside `getTracksAndClips()` (called from `startAbleton()`, called from `index.ts`'s `main()`). A crash during that window would otherwise throw synchronously indexing into `undefined`. Guarded explicitly: `if (!tracks?.length) return;` — no-op, no delay, just a log line. This is the same class of "not yet connected" case WOW-032 is separately hardening on the startup-timeout path; this ticket's guard only has to not misbehave in that window, not fix it (WOW-032's scope).

Also outside code: since Node terminates the process **synchronously and immediately** on `process.exit()` regardless of pending I/O, the bounded stop attempt has to be `await`-ed (not fired-and-forgotten) before calling `process.exit(1)`, or the UDP packet would likely never actually leave the process. This is the reason the handlers became `async` rather than staying synchronous — the officially-documented, common Node pattern for "bounded cleanup then hard-exit" (the same shape used by graceful-shutdown libraries like `terminus`), not a novel risk.

Conclusion: bounding this is safe and buildable within the reviewer's own stated constraints. No Decision-needed-only outcome was warranted — this doesn't require a product/creative call, just an engineering bound, which the reviewer had already specified.

## Changes — `backend/adapter/AbletonAdapter.ts`

Added `stopAllClipsBestEffort()`, exported alongside `handleTimeout` (not folded into it — see below):

- Guards on `tracks` being populated (see point 3 above).
- Fires `stop_all_clips` on all 4 tracks in parallel, each with its own `.catch()` so no single failing/slow track can prevent the others from being attempted or block the aggregate `Promise.all` from resolving.
- Wrapped in its own outer `try/catch` per the reviewer's explicit ask, even though the per-call `.catch()`s should make the outer catch unreachable in practice — cheap defense-in-depth on the one code path in this repo with zero tolerance for a hang.
- Never reuses or modifies `handleTimeout()`. That function's sequential-await-then-reset-`masterKey` shape is tuned for the idle-timeout UI-reset case, is already relied on/tested-by-usage there, and coupling it to the crash path would mean future idle-timeout changes could silently change crash-exit behavior (or vice versa). `handleTimeout` and the idle-timeout path are byte-for-byte untouched by this diff.

## Changes — `backend/index.ts`

- `CRASH_EXIT_STOP_TIMEOUT_MS = 1500` — the concrete bound (midpoint of the reviewer's suggested 1-2s range).
- `crashExit(err, message)`: logs immediately (unchanged from WOW-014's behavior — same `Logger.error(err, message)` call, same messages, just relocated into a shared function), then `await Promise.race([AbletonAdapter.stopAllClipsBestEffort(), <1500ms timer>])`, then `process.exit(1)`. Because `stopAllClipsBestEffort()` never rejects (see above), the only way this `Promise.race` could ever throw is a scenario that shouldn't be able to happen given that invariant — so there's deliberately no second nested try/catch here. The outer `.catch(() => process.exit(1))` at each `process.on(...)` registration is the one real safety net: if `crashExit` ever does throw for an unforeseen reason, `process.exit(1)` still fires immediately, so a bug in this new code cannot regress the crash path back to "might hang."
- `isCrashExiting` guard: if a second `unhandledRejection`/`uncaughtException` fires while the first is still mid-shutdown (a real scenario — Node keeps calling these listeners for every new occurrence, and a second independent failure within the ~1.5s window is plausible if the underlying cause is cascading), the second call logs its own error (so the reason isn't lost for postmortem) but does not restart the stop attempt or race a second `process.exit()` — it just returns and lets the first invocation's shutdown finish. This keeps the total added delay bounded even under a cascading-failure scenario, not just a single-crash one.
- `main()`'s own `.catch(...)` (startup-failure path) is untouched — it does not call `crashExit` or attempt a stop, because if `main()`'s `await AbletonAdapter.startAbleton()` itself is what rejected, Ableton likely never finished connecting in the first place (the exact case `stopAllClipsBestEffort`'s own guard handles safely if it were reached via the other two handlers instead).

## Changes — `docs/DECISIONS_NEEDED.md`

Amended the existing WOW-014 crash-restart-supervision entry with a scope note distinguishing "how fast do we restart" (still open, unchanged) from "what happens to Ableton audio during the down-window" (now addressed by this ticket) — exactly the clarification the hardware-safety-reviewer's sign-off asked for.

## Changes — `docs/TICKETS_002_BUGS.md`

Added the WOW-034 ticket entry itself (this ticket didn't exist before this session — self-originated from the WOW-014 sign-off's follow-up recommendation) and updated the file's intro/order-of-attack/sign-off-required lines to include it.

## What did NOT change

- No musical/timing logic, event names, payload shapes, the pillar IP map, or any non-crash call site.
- `handleTimeout`, `startTimeoutTimer`, `restartTimeoutTimer` — byte-for-byte unchanged.
- `main()`'s startup-failure handling — unchanged (still logs and exits immediately, no stop attempt, per the reasoning above).
- The `stop_all_clips` command itself is not new — it's the same command `handleTimeout` already sends on every idle timeout, invoked from a new call site with the same argument.

## A scope question flagged, not resolved, by this ticket

`docs/adr/004-frontend-only-scope.md`'s current Exception 2 (in-flight, unmerged PR #34) enumerates the backend-editing authorization as covering "WOW-014–WOW-032." WOW-034 is a new ticket number minted this session, one day after that range was written, from the same lineage (a follow-up explicitly recommended by one of that batch's own required reviewers). This PR's authorization comes directly from the human's own message in this session requesting this exact investigation-and-build — the same kind of direct, out-of-band grant PR #34 itself documents as having unblocked WOW-014 onward before ADR-004 caught up in writing. Flagging for the human / a documentation-maintainer pass: either widen PR #34's range to WOW-014–WOW-034 before or when it merges, or fold WOW-034 into a subsequent amendment. Not blocking this PR — mentioned for traceability, matching how PR #34 itself flagged an orphaned branch as "informational only."

## Verification performed (agent-side, non-hardware)

- `npx tsc --noEmit -p backend/tsconfig.json` — see validation section of the PR.
- `yarn lint` — see validation section of the PR.
- `yarn test` — see validation section of the PR (no backend test harness exists yet; WOW-015 adds the first ones, per WOW-014's own precedent of static verification + human demo steps for this file).
- `git diff` review: confirmed every non-comment line change is inside the two new/modified functions described above, or the three docs files; no line touches an existing non-crash Ableton call site, argument, or ordering.
- **`yarn start-backend` was not run.** It sends live MIDI/OSC to a real Ableton set, which `AGENTS.md`'s non-negotiable physical-installation safety rules forbid for agents outright. No agent has run it against this change.

## How to verify (human demo steps)

This cannot be verified against real Ableton by an agent, and the simulator doesn't model unhandled-rejection crashes, so there's no simulator scenario that exercises it. Honest verification path is human, on real hardware:

1. Review the diff directly: `backend/adapter/AbletonAdapter.ts` gets one new, self-contained, guarded function; `backend/index.ts`'s two handlers gain a bounded `await` before the same `process.exit(1)` they already called. No line changes what gets sent to Ableton on any non-crash path.
2. To exercise it: start the real backend with a tag actively playing on at least one pillar, then trigger a crash (e.g. temporarily reintroduce a known crash trigger, or `kill -SIGTERM` is not equivalent — an actual `uncaughtException`/`unhandledRejection` is needed, e.g. via a debug-only forced throw). Before this PR: audio kept looping after the crash log line. After: the pillar(s) should go silent (Ableton clips stopped) within ~1.5s of the crash log line, before the process exits.
3. To exercise the guard: crash the process (or just kill it) before a tag has ever been placed / before startup finishes connecting — should exit immediately with no added delay and a "tracks not yet loaded" log line, not a hang or a new error.

## Decisions / questions for the human

- The ADR-004 exception-range scope question above (non-blocking, informational).
- `docs/DECISIONS_NEEDED.md`'s WOW-014 entry (restart-speed/supervision choice) remains open and unaffected by this ticket beyond the added scope note.
