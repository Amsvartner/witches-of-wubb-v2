# WOW-014 — creative-tech-integrator handoff (backend crash-hardening)

Date: 2026-07-12
Executor: Claude Sonnet 5 (creative-tech-integrator role, unattended `/ship-feature` pipeline)
Branch: `feat/wow-014-crash-hardening`
Scope: crash-hardening only — every fire-and-forget promise in the hot path now has an explicit rejection handler; one crash trigger is guarded; process-level safety-net handlers added. **Zero change to musical behavior, event names, payloads, or the ordering/timing of Ableton commands.**

## Why the scope is broader than the ticket's 5 named line numbers

The ticket names 5 concrete sites but its acceptance criterion is a blanket rule: "no async call site in `backend/` discards a promise without a rejection path." I checked `ableton-js`'s actual type declarations (`backend/node_modules/ableton-js/ns/*.d.ts`) rather than assuming: `Clip.fire()`, `Namespace.get()`/`.set()`/`.addListener()`/`.sendCommand()` all return Promises. That surfaced several more unguarded fire-and-forget sites the ticket doesn't cite by line number but which are squarely "throughout the hot path" per its summary. Fixed all of them for a genuinely comprehensive audit rather than a literal reading of the 5 examples.

## Fix strategy: `.catch()`-and-log, not `await`

The ticket's stop condition is explicit: "Any fix that would change ordering or timing of Ableton commands → stop and ask." Every fire-and-forget call listed below was already fire-and-forget before this PR — adding `.catch()` to an already-unawaited call is provably a zero-timing-change fix (the call still fires at exactly the same point, nothing downstream is delayed). Adding `await` instead would have delayed subsequent same-function statements until each Ableton RPC resolved — a real ordering change I did not want to risk without the stop condition firing. `.catch()`-and-log was used uniformly for this reason; no site in this diff was changed to `await` an operation that wasn't already awaited.

## Changes — `backend/adapter/AbletonAdapter.ts`

All `.catch()` handlers log via `Logger.error(err, 'message')` (pino's idiomatic error-first form — gets automatic stack-trace serialization), matching the ticket's "log via pino" instruction. Site by site:

1. **`handleTimeout()` call inside the timeout `setTimeout` callback** (ticket's `:78`) — `.catch()` added.
2. **`phraseLeader` undefined guard** (ticket's concrete crash trigger at `:210`) — `stopOrRemoveClipFromQueue` now checks `if (!phraseLeader)` first (logs at debug level and skips the promotion check) before the `.clipName` access that used to throw when a tag was removed before the first `playing_slot_index` event ever fired.
3. **`addPhraseLeader(promotedClip)` / `triggerQueuedClips()`** inside `stopOrRemoveClipFromQueue`'s phrase-leader-promotion branch (ticket's `:217` names the `triggerQueuedClips` call; its sibling `addPhraseLeader` call in the same branch got the same treatment for consistency) — both `.catch()`.
4. **Two `cleanUpPhraseLeaderEventListener()` calls** inside `addPhraseLeader` (the cleanup function itself resolves `Promise<boolean | undefined>` per `addListener`'s return type — not obvious from the call site, only from the type signature) — both `.catch()`. Also had to widen the module-level `cleanUpPhraseLeaderEventListener` type from `(() => unknown) | undefined` to `(() => Promise<unknown>) | undefined` — the old annotation was simply inaccurate (it never returned bare `unknown`; `ableton-js` always resolves it to a function returning a Promise), which `tsc` caught immediately once `.catch()` was added. Type-only change, no runtime effect.
5. **`triggerQueuedClips()`** inside the throttled `playing_position` listener in `addPhraseLeader` (ticket's `:268`) — `.catch()`.
6. **`clips[0]?.fire()`** in `queueClip`'s silence-branch (not named by the ticket, but `Clip.fire(): Promise<void>` per the type defs — same class of bug, hot path) — `.catch()`.
7. **The `playing_slot_index` listener registration and body** — the largest single change:
   - `track.addListener('playing_slot_index', async (...) => {...})` itself was never awaited or caught — `.catch()` added to the outer call.
   - The listener's `throw new Error(...)` on missing clip metadata (ticket's concrete crash scenario, restated in the summary: "an Ableton error inside a fire-and-forget async call becomes an unhandled promise rejection, which kills the Node process") — since this callback is `async` and nothing awaits its returned promise when Ableton invokes it later, a `throw` here was **always** an unhandled rejection, not a catchable synchronous error. Replaced with `Logger.error(...); return;` — guarded and logged, not crashed, matching the ticket's own phrasing for the `phraseLeader` fix.
   - Wrapped the entire callback body in `try/catch` as defense-in-depth for anything else in that ~70-line block.
   - `setTrackVolume(pillar, 0.6)` and `addPhraseLeader(newPhraseLeader)` calls inside — both `.catch()`.
8. **`setTempo`**'s internal `ableton.song.set('tempo', tempo)` (not named by the ticket; every caller of `setTempo` is fixed for free since the fix lives inside the function) — `.catch()`. `emitEvent('tempo_changed', ...)` still fires unconditionally right after, exactly as before — the emit was never gated on the Ableton-side set succeeding, so this preserves existing behavior precisely.
9. **`transposeClipToNewKey`**'s two internal `clip.set('pitch_coarse', ...)` calls (not named by the ticket; this function runs on nearly every clip trigger/stop/key-change — one of the hottest paths in the file, and every one of its ~10 call sites is fixed for free) — both `.catch()`.

## Changes — `backend/event/IncomingEvents.ts`

1. **`stopOrRemoveClipFromQueue(...)`** call inside `handleDepartedTag` (ticket's `:90`, the named example of "surrounding try/catch is synchronous and cannot catch async errors") — `.catch()`. The existing synchronous `try/catch` in `handleDepartedTag`/`handleNewTag` is untouched (that's WOW-017's scope — it's about the `err` object being dropped from the log call, a separate defect from this ticket's "promise never gets a rejection handler at all").
2. **Three async socket handlers** (`get_tempo`, `get_track_volumes`, `set_track_volume`) — each already used `await` internally but had no `try/catch`, so a rejection became an unhandled rejection at the process level exactly like the OSC handlers (socket.io does not catch async listener rejections either). Wrapped each in `try/catch`; on error, log and skip the callback (matching the pattern of "no callback" being a less severe failure mode than a process crash — the client's ack simply never arrives, same as it effectively never arrived before when the process crashed).

## Changes — `backend/index.ts`

1. **`main()`** was called bare at the bottom of the file — the single biggest startup-crash risk (if `AbletonAdapter.startAbleton()` rejects, e.g. Ableton isn't running, this was previously an unhandled rejection). Now `main().catch((err) => { Logger.error(err, 'Fatal error during backend startup'); process.exit(1); })`.
2. **`process.on('unhandledRejection', ...)`** and **`process.on('uncaughtException', ...)`** — ticket item 3, verbatim: both log via pino then `process.exit(1)`. Registered before `main()` runs so they're active from the very first line of async work. This is a defense-in-depth safety net for anything the per-call-site audit above missed, not a replacement for it — the acceptance criterion ("no async call site... discards a promise without a rejection path") is a separate, already-satisfied requirement.

## Changes — `docs/DECISIONS_NEEDED.md`

Added the ticket-required Decision-needed entry (item 4) under "Deployment / show operation": crash-restart supervision. `process.exit(1)` after logging means a crash now fails loud-and-clean instead of hanging silently — but nothing restarts the process afterward. Laid out three options (`nodemon --exitcrash`, pm2, launchd/systemd) with a recommendation, blocked on the show machine's OS being confirmed (currently TBD per `docs/HARDWARE_INTEGRATION.md`).

## What did NOT change

- No musical/timing logic: `TRIGGER_ORDER`, `KEY_LEADER_ORDER`, transposition math, timeout constants (`TIMEOUT_IN_MILISECONDS`/`TIMEOUT_WARNING_IN_MILISECONDS`), the pillar IP map — all untouched.
- No event names or payload shapes changed — every `OutgoingEvents.emitEvent`/`emitEventWithoutResetingTimout` call site is byte-identical to `main`.
- No timeout semantics changed (that's WOW-018's scope) — `handleTimeout`'s body and `startTimeoutTimer`/`restartTimeoutTimer` are untouched beyond the one `.catch()` at the call site.
- No restructuring of the adapter's module shape, exports, or control flow beyond the mechanical additions above.
- `backend/event/OutgoingEvents.ts` was read (to confirm `emitEvent`/`emitEventWithoutResetingTimout` are synchronous, not Promise-returning — they are, so no call site needed a `.catch()` there) but not edited — outside this ticket's allowed-files list.

## A caught mistake, for the record

Mid-implementation, an edit intended for `setTempo` landed as garbled text (`abletonráson: (function () {})();`) that silently deleted the actual `ableton.song.set('tempo', tempo)` call — syntactically-valid but functionally a total loss of tempo-setting. Caught on the next full-file re-read (not by lint/tsc, which don't know a no-op is wrong) and fixed before proceeding. Every subsequent edit was re-verified with a full-file read rather than trusting the edit tool's success confirmation alone; the tsc pass at the end re-confirms nothing else of that shape survived, though tsc only catches type errors, not silent no-ops, so the manual full-file re-reads were the actual catch here.

## Verification performed (agent-side, non-hardware)

- `npx tsc --noEmit -p backend/tsconfig.json` — clean (surfaced and fixed the `cleanUpPhraseLeaderEventListener` type gap above).
- `yarn lint` — clean.
- `yarn test` — 68/68 passed, unaffected (no backend tests exist yet; WOW-015 adds the first ones).
- `yarn build` — clean, 160 modules.
- `git diff main --stat` — confirms exactly the 4 allowed files changed, nothing else.
- **`yarn start-backend` was explicitly requested mid-session (three times) and declined** — it sends live MIDI/OSC to a real Ableton set and real Art-Net to the real lighting server, which `AGENTS.md` classifies as a live-hardware command under its non-negotiable physical-installation safety rules, and which this ticket's own safety notes forbid outright. No agent has run it against this change. Real-hardware verification is a human step (see below).

## How to verify (human demo steps)

This ticket cannot be verified against real Ableton by an agent (see above), and it does not change simulator-visible behavior (the simulator doesn't model unhandled-rejection crashes), so there is no simulator scenario that exercises this fix. The honest verification path is human, on real hardware:

1. Review the diff directly — every change is either `.catch((err) => Logger.error(...))` appended to an already-fire-and-forget call, a `try { } catch (err) { Logger.error(...) }` wrapper around already-existing logic, or the `phraseLeader`/`throw` guards described above. No line changes what gets sent to Ableton or when.
2. To exercise the concrete crash trigger this ticket fixes: start the real backend (`yarn start-backend`, human-run), place a tag on a pillar, then remove it again within roughly a second — fast enough that `playing_slot_index` hasn't fired yet and `phraseLeader` is still undefined. Before this PR, this crashed the process. After, it should log a debug line ("No phrase leader set yet...") and continue normally.
3. To exercise the startup-crash fix: stop Ableton, then run `yarn start-backend` — before this PR, the process would hang or crash silently depending on timing; after, it should log "Fatal error during backend startup" and exit non-zero (WOW-032, next in this run, adds a bounded timeout here instead of relying on `ableton-js`'s own eventual rejection).

## Decisions / questions for the human

- `docs/DECISIONS_NEEDED.md` → **Deployment / show operation**: crash-restart supervision — open, needs the show machine's OS confirmed before choosing between pm2 and launchd/systemd.
