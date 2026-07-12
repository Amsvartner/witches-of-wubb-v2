# WOW-018 — audio-ableton-reviewer sign-off

Recorded on the human's/implementer's behalf: the audio-ableton-reviewer
agent's own profile is strictly read-only ("Never edit files; findings only.
No edits, no commits, ever.") and correctly declined to check this file out
or commit it itself despite being asked to in the review prompt — that
request conflicted with its own tighter agent-level constraint, and it
prioritized the latter, which is the correct call. This file transcribes its
reported findings verbatim/faithfully.

## Final verdict (after follow-up): APPROVE WITH CONDITIONS — condition met

The original review below (APPROVE) did not have `stopOrRemoveClipFromQueue`
or `transposeClipToNewKey` in its file list, so a specific follow-up question
was sent: does `handleTimeout`'s queue-clearing loop need the same
`pitch_coarse` reset that `stopOrRemoveClipFromQueue`'s existing
queued-removal branch already performs before dropping a clip? Answer:
**yes, in the backend; no sim-side equivalent needed** (the sim doesn't model
`pitch_coarse` at all). Implemented: `backend/adapter/AbletonAdapter.ts`'s
`handleTimeout` now calls `transposeClipToNewKey({ ...queuedClip, clip }, '')`
for every clip in each dropped queued pillar's loop, gated on
`keyLockEnabled`, exactly mirroring `stopOrRemoveClipFromQueue`'s pattern —
before nulling the slot and emitting `clip_unqueued`. Re-verified: `yarn
test` 77/77, `sim/test/simulator.test.ts` 29/29, `yarn lint`, `tsc --noEmit`
(root + backend), `yarn build` all clean after this change.

**Adjacent pre-existing gap, correctly out of scope for this PR**: the same
reviewer separately noted that playing clips stopped via timeout (the
`stop_all_clips` loop, unrelated to this PR's queue-clearing addition) also
skip a pitch reset for the same root cause — this predates WOW-018 entirely
and needs its own ticket + sign-off, so it was filed as a standalone
follow-up (`task_69cc6365`) rather than folded into this PR.

## Verdict: APPROVE

Comfortable with this shipping to the live installation.

## Files reviewed

`backend/adapter/AbletonAdapter.ts:148-163`, `sim/core/simulator.ts:164-185`,
`backend/event/OutgoingEvents.ts`, `backend/event/IncomingEvents.ts`,
`backend/adapter/LightingAdapter.ts`,
`src/context/hook/useAbletonContextProviderState.ts:105-174`,
`sim/test/simulator.test.ts:338-384`.

## Findings

1. **Drop-means-discard — confirmed, not at risk.** `AbletonAdapter.ts:157`
   and `simulator.ts:180-184` both null the queue slot _before_ emitting
   `clip_unqueued`; no `.fire()`/`startClip()`/`triggerQueuedClips()`
   anywhere in `handleTimeout`. The backend's real trigger path is driven by
   Ableton's `playing_position` on the phrase leader, which this same
   function has just stopped — no residual re-fire route. The sim's stale
   `phraseTimerId` is neutralized by `triggerQueuedClips`'s
   `if (!queued) return` guard.
2. **No hidden trigger side effects — confirmed.** `LightingAdapter.
sendOscMessage` is outbound-only OSC to the lighting server, no path back
   into Ableton. `IncomingEvents.ts` registers no server-side listener for
   either event name (rules out a self-trigger loop). Frontend handlers are
   pure `setState`, no `socket.emit` back.
3. **Without-reset emit variant — correct call.** `restartTimeoutTimer`
   timers are one-shot; genuine new activity already re-arms via the normal
   resetting path elsewhere, so idle-detection self-heals. Using the
   resetting variant here would be backwards (the cleanup re-arming the
   timer it just fired).
4. **`''` key semantics — confirmed pre-existing, not novel.**
   `sim/test/simulator.test.ts:63` already asserts `''` as the init
   sentinel for "no master key."
5. **Test realism — confirmed.** The new test queues a genuinely second real
   clip behind a genuinely playing one via ordinary `handleNewTag` calls,
   using `timeoutMs < phraseLengthMs` specifically to make the race
   observable. Realistic, not contrived.

Noted as non-blocking and pre-existing (not introduced by this diff): a
partial failure mid-`stop_all_clips` loop would skip the trailing cleanup
too (same shape as before this PR); the sim's `phraseTimerId` isn't
explicitly cleared in `handleTimeout`.

## Resolved: the pitch_coarse gap noted above

See "Final verdict (after follow-up)" near the top of this file — the gap
this section originally flagged as open is now fixed and re-verified.
