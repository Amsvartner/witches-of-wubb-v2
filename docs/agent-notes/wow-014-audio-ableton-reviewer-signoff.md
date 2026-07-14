# WOW-014 PR #16 (crash-hardening) — audio-ableton-reviewer sign-off

- Reviewer: audio-ableton-reviewer (Claude Sonnet 5)
- Date: 2026-07-12
- Review target: `git diff main...feat/wow-014-crash-hardening` (PR #16, `fix(wow-014): crash-harden backend against unawaited async and unhandled rejections`)
- Base: `main` @ 7ba9d93 · Head: `feat/wow-014-crash-hardening` @ 887453b (merge-base == `main`, so the diff is clean — no rebase drift). Confirmed against `gh pr view 16`: base `main`, head `feat/wow-014-crash-hardening`, state OPEN.
- Method: static only. No live Ableton connection was opened, `yarn start-backend` was NOT run, and nothing was sent to hardware, MIDI, OSC, or Art-Net — I have no such access and did not attempt it. Every claim in the implementer's handoff (`docs/agent-notes/wow-014-creative-tech-integrator-crash-hardening.md`) was re-verified independently against the diff itself, and — where the claim concerned `ableton-js`'s internal invocation semantics — against the actual installed `ableton-js` v3.1.5 source in `backend/node_modules/ableton-js/index.js` and `ns/index.js`, not just the implementer's summary of it or the `.d.ts` type declarations.

## Verdict: **APPROVE**

Every fire-and-forget call site in the diff was already fire-and-forget before this PR; `.catch()`-and-log was appended without introducing any new `await`. No reordering of Ableton API calls, no reordering of `OutgoingEvents` emits relative to each other or to the Ableton calls they follow, and no change to any musical constant, table, or enum was found anywhere in the diff. The one genuinely new branch of logic (the `phraseLeader` undefined guard) only changes behavior in a case that previously crashed the process; in the unaffected (defined) case it is control-flow-identical to `main`. Non-blocking observations at the end; no findings rise to block.

---

## 1. `queueClip` — PASS

Diff: `clips[0]?.fire();` → `clips[0]?.fire().catch((err) => Logger.error(...));` (`backend/adapter/AbletonAdapter.ts:159-163`).

- `queueClip` is a synchronous (non-`async`) function in both `main` and the PR head. `.fire()` was never `await`ed in either version.
- Chaining `.catch()` onto an unawaited promise does not delay or block the enclosing synchronous function — the next statement (`} else if (clips[0]) {`, i.e. nothing, since this is the terminal branch) executes on the same tick exactly as before. No reordering relative to the `setMasterKey`/`transposeClipToNewKey` calls earlier in the same function (both untouched, sit above this diff hunk).
- Rest of `queueClip` (silence detection, `TRIGGER_ORDER`-adjacent master-key logic, `keyLockEnabled && clips.forEach(transposeClipToNewKey...)`, the `clip_queued`/`clip_unqueued` emits) is byte-identical to `main` — confirmed via full-file read plus `git diff`.

## 2. `stopOrRemoveClipFromQueue` — PASS

Diff: the bare `if (playingClip.clipName... === phraseLeader.clipName...) {...}` becomes `if (!phraseLeader) { Logger.debug(...); } else if (playingClip.clipName... === phraseLeader.clipName...) {...}`, and the inner `addPhraseLeader(promotedClip)` / `triggerQueuedClips()` calls each gain `.catch()` (`AbletonAdapter.ts:211-230`).

- **`phraseLeader`-defined case (the only case that ever ran on `main`):** `!phraseLeader` evaluates `false`, control falls into the `else if` whose condition is character-for-character the same expression `main` used as its `if`. Zero behavioral difference for this case. The `await tracks[pillar].sendCommand('stop_all_clips')` immediately above this block (line 211, unchanged) still executes at the same point, unaffected — it's above the diff hunk and isn't touched.
- **`phraseLeader`-undefined case (the ticket's named concrete crash trigger):** on `main`, `phraseLeader.clipName` throws a `TypeError` synchronously inside this `async` function's body. Because the function has already `await`ed `tracks[pillar].sendCommand('stop_all_clips')` earlier in the same `if (isClipPlaying)` block, this throw executes as a continuation resumed after that `await` — but throwing inside an `async` function body **never** propagates synchronously to the caller regardless of where in the body it occurs (ES2017 semantics: calling an async function always returns a Promise; a body throw always rejects that Promise, it never throws out of the call expression). The caller in `backend/event/IncomingEvents.ts:90` was a bare, unawaited call on `main` (`AbletonAdapter.stopOrRemoveClipFromQueue(...)` with no `.then`/`.catch`), so the rejection went unhandled — the ticket's documented crash. Traced what code the throw skips: it aborts the rest of `stopOrRemoveClipFromQueue`, i.e. the `isClipQueued` block and the final `if (!isClipPlaying && !isClipQueued)` fallback. The fallback block is dead in this scenario regardless of the throw (`isClipPlaying` is a `const` captured at function entry and is `true` here, so `!isClipPlaying` is always `false`). The `isClipQueued` block is reachable post-fix that was unreachable pre-fix (since pre-fix, the whole function died at the throw) — but `isClipQueued` requires `queuedClip?.clipName` (captured at function entry from `queuedClips[pillar]`) to equal the _departing_ clip name, and `queueClip`'s queueing logic only ever populates `queuedClips[pillar]` with a clip that is not the one currently in `playingClips[pillar]` (a clip fired directly from silence never enters the queue at all; `triggerQueuedClips` nulls the queue slot the instant its clip fires) — so in the exact scenario this guard targets (the _playing_ clip on this pillar is departing), `isClipQueued` evaluates `false` both before and after the fix, and no additional Ableton command fires from that block. Net effect of the guard: one new `Logger.debug` line, zero new Ableton calls, and the process survives instead of dying. This is the fix doing exactly what "guard the `phraseLeader` access" (ticket acceptance criterion) asks for, not a reordering.
- `addPhraseLeader(...).catch(...)` / `triggerQueuedClips().catch(...)`: both were bare, unawaited calls on `main`; `stopOrRemoveClipFromQueue` does not `await` either before or after, so `.catch()` addition changes nothing about when they're invoked, only what happens to a rejection.
- The rest of the function (`isClipQueued` block's `FindAllClipsInLoop`/`transposeClipToNewKey` calls, the final fallback's `tracks[pillar].sendCommand('stop_all_clips')` + `emitEventWithoutResetingTimout('clip_stopped', ...)`) is untouched.

## 3. `addPhraseLeader` — PASS

Diff (`AbletonAdapter.ts:259-291`): both `cleanUpPhraseLeaderEventListener()` call sites (the one at function entry, and the one inside the throttled `playing_position` listener) gain `.catch()`; `triggerQueuedClips()` inside the throttled listener gains `.catch()`; the module-level type annotation widens from `(() => unknown) | undefined` to `(() => Promise<unknown>) | undefined`.

- Neither call site was ever `await`ed on `main` (the enclosing throttled callback is a plain function, not `async`, and the outer `addPhraseLeader` never awaited its own cleanup call either). `.catch()` addition is a no-op with respect to timing for the same reason as sections 1-2.
- `await clip.get('loop_end')` (line 271) — the one genuine `await` in this function — is completely untouched by the diff, still executes at the same point before `cleanUpPhraseLeaderEventListener` is (re)assigned.
- The type widening is TS-only (erased at compile time); confirmed it introduces no runtime branch, cast, or coercion — purely satisfies `tsc` given `.catch()` requires the value to be typed as a `Promise`. `ableton-js`'s `Namespace.addListener` (`backend/node_modules/ableton-js/ns/index.js:77-92`) does in fact always resolve to a function (the removal closure), never bare `unknown` — so the new annotation is objectively more accurate, matching the implementer's claim.
- 300ms `throttle(...)` wrapper, the `currentTime >= endTime - 1` phrase-end trigger condition, and the `.bind({}, newPhraseLeader, endTime)` closure — all untouched.

## 4. `playing_slot_index` listener (inside `getTracksAndClips`) — PASS, claim independently verified against `ableton-js` source

Diff (`AbletonAdapter.ts:294-404`, the largest hunk): the whole callback body is wrapped in `try { ... } catch (err) { Logger.error(...) }`; `throw new Error(...)` on missing clip metadata becomes `Logger.error(...); return;`; `setTrackVolume(...)` and `addPhraseLeader(...)` calls inside gain `.catch()`; the outer `track.addListener('playing_slot_index', async (...) => {...})` gains a `.catch()` on its own registration promise.

**Verified independently (not taken on the implementer's word) how `ableton-js` invokes this listener**, since this is exactly the kind of claim the task asked me not to accept as merely plausible:

- `Namespace.prototype.addListener` (`ns/index.js:77-92`) wraps the caller's callback and forwards it to `Ableton.prototype.addPropListener` (`index.js:547-575`), which pushes the wrapper into `this.eventListeners.get(eventId)`, an array.
- Incoming prop-change messages are dispatched in `Ableton.prototype.handleUncompressedMessage` (`index.js:408-446`). The dispatch line is:
  ```
  var eventCallback = this.eventListeners.get(data.event);
  if (eventCallback) { return eventCallback.forEach(function (cb) { return cb(data.data); }); }
  ```
  This is a **synchronous, un-awaited `forEach` invocation** — `cb(data.data)` (which resolves to our `async (clipSlotIndex) => {...}` callback) is called, its returned Promise is discarded by `.forEach()`, and nothing anywhere upstream (`handleUncompressedMessage`, `handleIncoming`, the socket `message` listener) ever attaches a `.then`/`.catch` or awaits it. This confirms the callback is genuinely fire-and-forget from `ableton-js`'s side, exactly as the implementer claimed.
- Given that, per ES2017 semantics, calling an `async` function can never throw synchronously back into `cb(data.data)` — a body `throw` always becomes a rejected Promise, which here is simply an orphaned, unhandled rejection (Node's documented crash trigger, and now also explicitly caught by `backend/index.ts`'s new `process.on('unhandledRejection', ...)` handler). So on `main`, the `throw` inside this listener could never have influenced any _synchronous_ caller behavior — its only observable effect was the later, disconnected process crash.
- Traced what statements the `throw`/`return` point precedes: `transposeClipToNewKey` (previous-song-back-to-0 cleanup), `await clip.get('warp_markers')`, `calculateBpmFromWarpMarkers`, the `clip_playing`/`clip_started`/`volume_changed` emits, `setTempo`/`setMasterKey` silence-adoption, `playingClips[pillar]` assignment, and `addPhraseLeader` promotion. Both `throw` (old) and `Logger.error+return` (new) unconditionally skip **all** of these for the current invocation when `clipMetadata` is missing — identical outcome for this invocation's own Ableton calls (none of the above run, before or after the fix). The only behavioral delta is system-wide: old code eventually crashes the process (silencing every future pillar's commands too); new code logs and keeps serving subsequent `playing_slot_index` events on this and other pillars normally.
- The new outer `try/catch` around the whole callback body is pure defense-in-depth added around pre-existing, unmodified statements — confirmed line-by-line against `main` that no statement was reordered, removed, or given a new `await` inside the wrapped block (only whitespace/indentation changed from the `try` wrapper, verified via the diff hunk's context lines).
- `setTrackVolume(pillar, 0.6)` and `addPhraseLeader(newPhraseLeader)` inside: both were bare/unawaited on `main` (the enclosing callback doesn't await them either before or after); `.catch()` addition doesn't delay the statements that follow them in program order (`if (playingClips.every(...)) { setTempo(bpm); ...}`, `playingClips[pillar] = {...}`).
- The outer `.catch()` on `track.addListener(...)`'s own registration promise (line 389-391) only guards listener-_registration_ failures at startup (`getTracksAndClips` time), not anything in the per-event callback — irrelevant to trigger-time ordering.

## 5. `setTempo` — PASS, specifically confirmed the emit is still unconditional

Diff (`AbletonAdapter.ts:411-417`):

```
- ableton.song.set('tempo', tempo);
+ ableton.song.set('tempo', tempo).catch((err) => Logger.error(err, `Error setting tempo to ${tempo}`));
  OutgoingEvents.emitEvent('tempo_changed', { tempo });
```

- `setTempo` is not `async` in either version and contains no `await`. `ableton.song.set('tempo', tempo)` was never awaited on `main` either — it's a bare statement.
- Confirmed `OutgoingEvents.emitEvent` (`backend/event/OutgoingEvents.ts:23-26`) is itself fully synchronous (no `async`, no Promise return — it calls `AbletonAdapter.restartTimeoutTimer()` then the synchronous `emit()` helper, which loops `socket.emit` and calls `LightingAdapter.sendOscMessage`). So `emitEvent('tempo_changed', { tempo })` on the very next line runs immediately after `ableton.song.set(...)` is merely _called_ (not resolved) — exactly as on `main`. **The emit was never gated on the Ableton-side `set` succeeding before this PR, and it still isn't after.** This matches the review question's exact framing and the implementer's claim; independently confirmed rather than assumed.
- All three callers of `setTempo` (`get_tracks_and_clips` silence-adoption at `AbletonAdapter.ts:353`, and the `set_tempo` socket handler in `IncomingEvents.ts:154-157`) are unchanged and get this fix "for free" with no call-site edits.

## 6. `transposeClipToNewKey` — PASS

Diff (`AbletonAdapter.ts:494-522`): both `clip.set('pitch_coarse', 0)` (key-reset branch) and `clip.set('pitch_coarse', transposeAmount)` (transpose branch) gain `.catch()`.

- `transposeClipToNewKey` is not `async`; neither `.set('pitch_coarse', ...)` call was ever awaited on `main`. Same "already fire-and-forget" reasoning as above — no timing change to any of the ~10 call sites (`queueClip`, `stopOrRemoveClipFromQueue`, the `playing_slot_index` listener's previous-song cleanup, `setKeyLockState`, `setMasterKey`) that invoke this function; all of them are outside this diff and unmodified.
- The Camelot-key math itself — `key.match(/[A-Z]/g)`, `newKey.match(/\d+/g)`, the `backupKey` construction, and the `KeyTranspositionService.TRANSPOSITIONS[key][newKey]` / `[...][backupKey]` lookups — is untouched, confirmed via `git diff` (these lines appear only as unchanged context, never as `+`/`-`).

## 7. Musical constants and tables — PASS (grep-confirmed, not just eyeballed)

Ran `git diff main...feat/wow-014-crash-hardening -- backend/ | grep -nE '^[+-].*(TRIGGER_ORDER|KEY_LEADER_ORDER|TRANSPOSITIONS|TIMEOUT_IN_MILISECONDS|TIMEOUT_WARNING_IN_MILISECONDS)'` — **zero matches**. These symbols never appear on a `+` or `-` line anywhere in the diff; every occurrence in the changed files is unchanged context.

- `backend/type/` and `backend/service/` (incl. `KeyTranspositionService.ts`, `PhraseLeaderService.ts`) — `git diff main...feat/wow-014-crash-hardening -- backend/type/ backend/service/` is **empty**. `ClipTypes` enum confirmed at head: `Vox | Melody | Bass | Drums`, matching `AGENTS.md`/`docs/ABLETON_INTEGRATION.md`. `KeyTranspositionService.TRANSPOSITIONS` (`backend/service/KeyTranspositionService.ts`) untouched, including the two entries flagged `(verify pattern)` (`9B`, `6A`) — not this PR's concern (WOW-015).
- `TRIGGER_ORDER = [Drums, Melody, Bass, Vox]` and `KEY_LEADER_ORDER = [Vox, Melody, Bass, Drums]` (`AbletonAdapter.ts:44-45`) — outside every diff hunk, confirmed unchanged.
- `PhraseLeaderService.findNextPhraseLeader` (sorts playing clips by `TRIGGER_ORDER.indexOf`) — file has zero diff; logic and the guard-worthy `clipCopy[0]` (returns `undefined` on an empty list, which is exactly the value the new `phraseLeader` guard now defends against downstream) are unchanged.
- `TIMEOUT_IN_MILISECONDS` (180000) / `TIMEOUT_WARNING_IN_MILISECONDS` (30000) — unchanged; `handleTimeout`'s body (`stop_all_clips` ×4, `masterKey = ''`) is untouched except the `.catch()` added at its _call site_ inside `setTimeout` (not inside `handleTimeout` itself) — timeout semantics (WOW-018's scope) are explicitly out of scope here and correctly left alone.

## 8. New process-level handlers (`backend/index.ts`) and socket try/catch wraps (`IncomingEvents.ts`) — PASS, no musical-sequencing surface

- `process.on('unhandledRejection', ...)` / `process.on('uncaughtException', ...)` (new, `index.ts`): both log via `Logger.error` then `process.exit(1)`. These are global safety nets outside any per-tag or per-clip control flow — they cannot reorder Ableton commands; they can only end the process (which, per the whole point of this ticket, was already the failure mode for an unhandled rejection — this just makes it loud and clean instead of an ambiguous hang).
- `main().catch(...)` at the bottom of `index.ts`: guards backend _startup_ (`AbletonAdapter.startAbleton()`), not the triggering hot path. No effect on steady-state command ordering.
- `get_tempo` / `get_track_volumes` / `set_track_volume` socket handlers (`IncomingEvents.ts:146-176`): each already used `await` internally on `main`; the diff only adds a `try/catch` around the _same_ `await` sequence with no reordering. On error, the callback simply doesn't fire (client ack never arrives) instead of the process crashing — matches the pattern used elsewhere in this PR.
- `handleDepartedTag`'s `AbletonAdapter.stopOrRemoveClipFromQueue(...).catch(...)` (`IncomingEvents.ts:90-92`): `handleDepartedTag` is a plain synchronous function (not `async`) in both versions; the call was bare/unawaited on `main`. `.catch()` addition changes nothing about when the call fires relative to the `emitEvent('ingredient_removed', ...)` line immediately above it (untouched, still fires first, same as `main`).
- No new OSC/socket **event names** or payload shapes were introduced anywhere in this diff — confirmed by reading every `emitEvent`/`emitEventWithoutResetingTimout`/`socket.on` call site touched by the diff; all use pre-existing event names (`tempo_changed`, `clip_stopping`, `clip_unqueued`, `clip_queued`, `clip_playing`, `clip_started`, `volume_changed`, `clip_stopped`, `get_tempo`, `get_track_volumes`, `set_track_volume`).

## 9. CSV schema / mapping assumptions — PASS (not touched)

`src/assets/Music Database.csv`, `backend/util/CsvUtil.ts`, `backend/service/MusicDatabaseService.ts` do not appear in the diff at all (`git diff --stat` confirms only `backend/adapter/AbletonAdapter.ts`, `backend/event/IncomingEvents.ts`, `backend/index.ts`, `docs/DECISIONS_NEEDED.md`, and the implementer's new agent-note changed). Exact clip-name matching (`.replace(/[* ]/g, '')` trimming, `MemoizedClipIndex`/`FindAllClipsInLoop` 20-slot loop-window search) is untouched — none of those functions appear in the diff.

## 10. `docs/DECISIONS_NEEDED.md` addition — PASS, correctly scoped

The new "Crash-restart supervision" entry (ticket item 4) is documentation only, correctly flags that `process.exit(1)` now needs an external supervisor (`nodemon --exitcrash` / pm2 / launchd-systemd) to actually restart the show, and is explicitly blocked on a human decision. No code implication reviewed here beyond the doc text itself.

---

## Supporting checks

- `git diff --stat`: exactly the 4 code/doc files plus the new agent-note — matches `AGENTS.md`'s allowed-files list for WOW-014 (`backend/adapter/AbletonAdapter.ts`, `backend/event/IncomingEvents.ts`, `backend/index.ts`, `docs/DECISIONS_NEEDED.md`).
- Every `.catch()` added follows the same shape (`Logger.error(err, 'message')`, pino error-first form) — consistent with existing pre-PR `.catch()` usage already present in `main` (e.g. `handleTimeout().catch(...)` pattern didn't exist pre-PR for that one site, but the _shape_ matches the codebase's existing pino conventions elsewhere).
- No dependency, `package.json`, or lockfile changes in the diff.
- I did not run `yarn lint`/`yarn test`/`tsc` myself (read-only reviewer; the implementer's handoff reports all three clean plus a clean `yarn build`) — I have no reason to doubt those given the diff is mechanical, but I did not re-run them, and note that as a gap rather than asserting a result I didn't produce.

## Non-blocking observations (not musical-timing findings)

1. **informational** — `stopOrRemoveClipFromQueue`'s new `!phraseLeader` branch, once the process no longer crashes, does allow the function to reach its `isClipQueued` block in a code path that previously never completed. I traced this in section 2 above and confirmed it cannot fire an extra Ableton command in the specific scenario the guard targets, but it's worth a human's eyes precisely because "code that used to be unreachable due to a crash is now reachable" is the correct and intended shape of a crash fix, not a red flag — flagging so the reviewer chain has the reasoning on record, not because I believe it's wrong.
2. **informational** — Per `AGENTS.md`'s human-verifiable demo requirement, this ticket's own handoff correctly states there is no simulator scenario that exercises unhandled-rejection crashes, so verification is human-only. I have no way to confirm the fix behaves correctly against a live Ableton set (unbounded `await` resolution timing, real `ableton-js` reconnect behavior under an actual crash/restart, etc.) — this is expected and acceptable for a static review, not a defect in the PR.

## What I did not and could not verify

- **No live-Ableton verification was performed.** I have no access to a running Ableton Live instance, the MIDI remote script, or any hardware, and did not attempt to obtain any (per my read-only reviewer constraints and the task's explicit instruction). All findings above are from static analysis of the diff and the installed `ableton-js` library source.
- Real-hardware / real-Ableton verification remains a human step, exactly as the PR's own demo steps (`docs/agent-notes/wow-014-creative-tech-integrator-crash-hardening.md`, "How to verify (human demo steps)") already specify: (1) place-then-quickly-remove a tag to exercise the `phraseLeader` guard, (2) stop Ableton and run `yarn start-backend` to exercise the startup-crash guard. I did not run either.
- I did not independently re-run `yarn lint` / `yarn test` / `tsc --noEmit` / `yarn build` — see "Supporting checks" above.

---

**Verdict: APPROVE.** No change to `TRIGGER_ORDER`, `KEY_LEADER_ORDER`, key-lock/transposition logic, `KeyTranspositionService.TRANSPOSITIONS`, phrase-leader promotion logic (for any previously-working case), warp/loop handling, timeout constants, category enum values, CSV/mapping assumptions, or the sequence of any Ableton API call / `OutgoingEvents` emit relative to any other, in any of the six functions named for review (`queueClip`, `stopOrRemoveClipFromQueue`, `addPhraseLeader`, the `playing_slot_index` listener, `setTempo`, `transposeClipToNewKey`). The ticket's stop condition ("Any fix that would change ordering or timing of Ableton commands → stop and ask") was not triggered. Sign-off granted for merge of PR #16 conditional on the separately required hardware-safety-reviewer sign-off and the human-only live verification steps above remaining outstanding.
