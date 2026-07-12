# WOW-018 — Idle timeout leaves stale queued clips and a silently cleared master key

## Pre-answered decision in effect

This run's advance decisions include: "WOW-018 timeout UX: drop the queue at
timeout (as ticket describes)." The ticket's own stop condition
("Disagreement over intended timeout UX (drop vs. keep queue) → Decision
needed") is resolved by this — implemented "drop the queue," not "keep it."

## The bug

`backend/adapter/AbletonAdapter.ts`'s `handleTimeout` stopped every track and
cleared `masterKey`, but:

1. Never emitted `master-key_changed` — the UI kept showing a key that no
   longer existed once everything went silent.
2. Never touched `queuedClips` — a clip queued behind whatever was playing at
   the moment of timeout stayed queued forever (nothing ever flushes the
   queue from silence otherwise; queued clips normally fire at the next
   phrase boundary of a _playing_ clip, and there's no playing clip left
   after a timeout).

`sim/core/simulator.ts`'s `handleTimeout` mirrored the same bug, and said so
explicitly in its own docstring: "the real backend assigns masterKey directly
without emitting master-key_changed."

## The fix

Both `handleTimeout` implementations now, after clearing state:

- Emit `master-key_changed` with the cleared key.
- Walk `queuedClips`, and for every occupied pillar: null the slot and emit
  `clip_unqueued` with `{ ...queuedClip, clip: undefined }` — the exact
  payload shape `stopOrRemoveClipFromQueue`'s existing queued-removal branch
  already uses.

**Both new emissions use the without-reset variant**
(`OutgoingEvents.emitEventWithoutResetingTimout` / `this.emit(..., false)`
in the sim), per the ticket's explicit instruction. `emitEvent`'s normal form
calls `restartTimeoutTimer()` as a side effect (treating any outgoing event
as fresh activity) — using it here would mean the timeout handler's own
cleanup re-arms the very timer that just fired, scheduling another full idle
period instead of settling into the timed-out state. Confirmed by reading
`backend/event/OutgoingEvents.ts` directly rather than assuming.

Did not reuse the general-purpose `setMasterKey(newKey)` setter for the
key-clearing emission in either file. In the backend, `setMasterKey` also
re-transposes every still-tracked playing/queued clip's pitch via
`FindAllClipsInLoop` + `transposeClipToNewKey` — wasted, incorrect work at
this point, since every clip is either just-stopped or about to be cleared
from the queue in the same function. In the sim, `setMasterKey` is simpler
(no re-transposition) but still calls `emit(..., resetTimeout = true)` by
default, which would trip the same re-arming problem. Both files instead set
`masterKey = ''` / `this.masterKey = ''` directly and emit with the
without-reset variant explicitly.

## Tests (`sim/test/simulator.test.ts`)

- Updated the existing timeout test (previously asserting the _bug_: "clears
  the master key without emitting", `not.toContain('master-key_changed')`) to
  assert the fixed behavior instead: `master-key_changed` with `{ key: '' }`
  is now in the emitted sequence.
- Added a new test for the queued-at-timeout case. Getting a clip into "still
  queued when the timeout fires" required a Simulator instance with a
  `timeoutMs` shorter than the default `phraseLengthMs` (1000ms in this
  suite) — otherwise the existing phrase-boundary timer (`schedulePhraseTrigger`,
  which every successful `queueClip` call arms) would auto-fire the queued
  clip well before any realistic timeout duration could. Used `timeoutMs:
500, timeoutWarningMs: 100` on a dedicated `Simulator` instance for just
  this test, confirmed `clip_unqueued` fires for the queued pillar and
  `getQueuedClips()` returns all-null afterward.
- No backend-level test added — `backend/adapter/test/**` isn't in this
  ticket's allowed files, and the ticket's required-tests line
  ("`yarn test` (extended sim suite)") points at the sim suite specifically.

## Verification

- `yarn test`: 77/77 (this branch's WOW-014+WOW-032 baseline, unaffected;
  29/29 in `sim/test/simulator.test.ts` including the 2 timeout tests).
- `yarn lint`, `npx tsc --noEmit` (root), `npx tsc --noEmit -p
backend/tsconfig.json`, `yarn build` — all clean.
- Live smoke test via `yarn sim full-spell` + `yarn dev`: normal (non-timeout)
  operation confirmed unaffected — clips play/queue normally, master key
  displays correctly (`4A` observed), zero console errors. Did **not** wait
  out a live 3-minute timeout window (impractical for this verification pass,
  and a new one-off shortened-timeout `.claude/launch.json` entry was
  considered and rejected — WOW-016 already established that ad hoc
  launch-config additions for a single ticket's manual verification are
  out of scope and get reverted). The deterministic fake-timer tests above
  are the authoritative verification of the actual timeout-triggered
  behavior; the live smoke test's purpose was narrower — confirming this
  change doesn't regress everyday (non-timeout) operation.

## Out of scope / deliberately not done

- Changing timeout durations — untouched.
- `ATTRACTOR_STATE_CLIP_NAME` / attractor-state behavior — currently unused,
  noted separately in WOW-023 per the ticket.
- Any new event names — both `master-key_changed` and `clip_unqueued` already
  exist and are already used elsewhere in both files for equivalent
  situations (key changes, queue removal); this ticket just adds two new
  call sites of existing events, not new event contracts.
