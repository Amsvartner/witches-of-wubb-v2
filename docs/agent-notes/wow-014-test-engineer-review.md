# WOW-014 PR #16 (crash-hardening) — test-engineer review

- Reviewer: test-engineer (Claude Sonnet 5, phase C / test-review of the WOW pipeline)
- Date: 2026-07-12
- Review target: `git diff main...feat/wow-014-crash-hardening` (PR #16, `fix(wow-014): crash-harden backend against unawaited async and unhandled rejections`)
- Base: `main` @ `7ba9d93` · Head: `feat/wow-014-crash-hardening` @ `887453b` (merge-base == `main` HEAD, so the diff has no rebase drift). Confirmed against `gh pr view 16`: base `main`, head `feat/wow-014-crash-hardening`, state OPEN.
- Ground truth: WOW-014 ticket text (`docs/TICKETS_002_BUGS.md`), implementer handoff (`docs/agent-notes/wow-014-creative-tech-integrator-crash-hardening.md`), `ableton-js` v3.1.5 type declarations (`backend/node_modules/ableton-js/ns/*.d.ts`, `backend/node_modules/ableton-js/index.d.ts`), `docs/CODING_GUIDELINES.md` testing section.
- Method: read-only, no hardware. Did not take the PR body's or the implementer's own site-list on faith — independently re-derived the complete set of Promise-returning call sites in both changed files from `ableton-js`'s actual type declarations, then swept both files line-by-line plus a mechanical grep cross-check for every call pattern. Ran `npx tsc --noEmit -p backend/tsconfig.json`, `yarn lint`, `yarn test` myself. `yarn start-backend` never run; no live Ableton, MIDI, OSC, or Art-Net traffic generated.

## Verdict: **approve-with-nits**

No remaining unguarded/unawaited-and-uncaught Promise-returning call site was found in `backend/adapter/AbletonAdapter.ts` or `backend/event/IncomingEvents.ts` after independently re-deriving and checking every single one (full inventory below) — the crash-hardening claim is accurate, not just plausible. `tsc`, `yarn lint`, and `yarn test` are all green. The ticket's own "reviewer verification, not new tests" instruction (since WOW-015 hasn't landed) is the correct call for this PR, though one narrow slice of genuinely testable surface exists today and is worth capturing as a named follow-up (see Should-fix). Findings below are non-blocking.

## Relationship to the other specialist reviews

Two specialist sign-off notes exist for this PR at the same base/head SHAs, both reaching **APPROVE**:

- `docs/agent-notes/wow-014-audio-ableton-reviewer-signoff.md` — an exhaustive function-by-function musical-timing/ordering audit. Explicitly states it did **not** run `tsc`/`yarn lint`/`yarn test` ("read-only reviewer... I did not re-run them, and note that as a gap rather than asserting a result I didn't produce").
- `docs/agent-notes/wow-014-hardware-safety-reviewer-signoff.md` (landed on disk while this review was in progress) — a live-command/volume/lighting/pillar-IP-map audit, plus two non-blocking observations outside this review's lens (no best-effort Ableton-silence attempt on crash-exit; a brief self-healing `playingClips` staleness window on clip-metadata-miss — see that note's sections 2 and 3 for the full analysis, not repeated here). It **did** independently re-run `tsc --noEmit`, `yarn lint`, and `yarn test`, reproducing the same clean/68-68-pass result reported below.

This review's lens is distinct from both: (1) exhaustively re-verify the _completeness_ of the rejection-handling claim itself — every Promise-returning call site in the two changed files, independently re-derived from `ableton-js`'s type declarations rather than taken from any prior note's list — and (2) run the verification commands myself rather than relying on someone else's report. My `tsc`/`lint`/`test` results (below) triangulate with the hardware-safety-reviewer's independent run: three separate command executions (theirs, mine) at the same SHA, identical results. I did not redo the musical-timing/event-payload or hardware-safety analysis either prior note already did — I relied on both, and spot-checked only the pieces that bear directly on my own completeness claim (see "Spot-checks" below).

## Independent re-derivation of the Promise-returning surface

From `ableton-js`'s `.d.ts` files (not the PR body's list):

- `Namespace<GP,TP,SP,OP>` (`ns/index.d.ts:13-22`, base class for `Clip`, `Track`, `Song`, `ClipSlot`, `DeviceParameter`, `MixerDevice`): `get()` → `Promise<...>`, `set()` → `Promise<null>`, `addListener()` → `Promise<() => Promise<boolean | undefined>>`, `sendCommand()` → `Promise<any>`.
- `Clip.fire()` (`ns/clip.d.ts:200`) → `Promise<void>`.
- `Ableton.start()` (`index.d.ts:82`) → `Promise<void>`.

Every method in these two files that touches Ableton goes through one of these five signatures. I then grepped both files for every call pattern (`.get(`, `.set(`, `.addListener(`, `.sendCommand(`, `.fire(`, `ableton.start(`, `.then(`, `Promise.`, plus every local `async function`/`async (...) =>` declaration and every call site of each) and cross-checked the result against a full manual read of both files. `.then(`/`Promise.` : zero hits in either file — the whole diff uses async/await + `.catch()` exclusively, one consistent idiom.

### `backend/adapter/AbletonAdapter.ts` — every local async function, and how its own promise is ultimately handled

| Function (def. line)                                                                           | Called from                                                                                                                                  | Handling                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startAbleton` (47)                                                                            | `index.ts:23`                                                                                                                                | `await`ed inside `main()`; `main()` itself wrapped by `.catch()` at `index.ts:49-52`. Chain terminates in a handler.                                                                                                                                                                                      |
| `handleTimeout` (54)                                                                           | `:78` (inside `setTimeout` callback in `startTimeoutTimer`)                                                                                  | `.catch((err) => Logger.error(...))` appended directly.                                                                                                                                                                                                                                                   |
| `triggerQueuedClips` (185)                                                                     | `:227`, `:286`                                                                                                                               | Both call sites `.catch()`-appended.                                                                                                                                                                                                                                                                      |
| `stopOrRemoveClipFromQueue` (196)                                                              | `IncomingEvents.ts:90`                                                                                                                       | `.catch()`-appended. No other caller in the repo (confirmed by grep, see below).                                                                                                                                                                                                                          |
| `addPhraseLeader` (259)                                                                        | `:223`, `:361`                                                                                                                               | Both call sites `.catch()`-appended.                                                                                                                                                                                                                                                                      |
| `getTracksAndClips` (294, `const ... = async () =>`)                                           | `:50`                                                                                                                                        | `await`ed inside `startAbleton` — same guarded chain as row 1.                                                                                                                                                                                                                                            |
| `playing_slot_index` listener (305, `async (clipSlotIndex) => {...}` passed to `.addListener`) | invoked later by `ableton-js`'s own event dispatch, never awaited by the caller                                                              | Entire body (306-387) wrapped in `try { } catch (err) { Logger.error(...) }` — cannot itself produce a rejected promise from internal logic. The _registration_ call `track.addListener(...)` (a separate promise, for the subscribe step) is itself `.catch()`-appended at 389-391. Both layers covered. |
| `getTempo` (406)                                                                               | `IncomingEvents.ts:148`                                                                                                                      | `await`ed inside a `try/catch`.                                                                                                                                                                                                                                                                           |
| `getTrackVolumes` (419)                                                                        | `:51` (chain to `main().catch()`), `:436` (awaited inside `setTrackVolume`, row below), `IncomingEvents.ts:160` (awaited inside `try/catch`) | All three call sites terminate in a handled chain.                                                                                                                                                                                                                                                        |
| `setTrackVolume` (434)                                                                         | `:347` (`.catch()`-appended), `IncomingEvents.ts:172` (awaited inside `try/catch`)                                                           | Both handled.                                                                                                                                                                                                                                                                                             |

### Every individual `ableton-js` Promise-returning call, file:line

All 24 call sites, cross-referenced against the table above:

- `:49` `ableton.start()` — awaited in `startAbleton` (row 1 chain).
- `:56` `tracks[i].sendCommand('stop_all_clips')` — awaited in `handleTimeout` (row 2 chain).
- `:159-163` `clips[0]?.fire().catch(...)` — `.catch()` appended directly. Verified the optional-chaining semantics precisely: `clips[0]?.fire().catch(...)` is one continuous optional chain (no interrupting parens), so if `clips[0]` is nullish the _entire_ expression short-circuits to `undefined` without ever evaluating `.fire()` or `.catch()` — it cannot throw "cannot read `.catch()` of undefined." Confirmed correct.
- `:191` `item.clip.fire()` — awaited in `triggerQueuedClips` (row 3 chain).
- `:211`, `:254` `tracks[pillar].sendCommand('stop_all_clips')` (×2) — both awaited in `stopOrRemoveClipFromQueue` (row 4 chain).
- `:261`, `:282` `cleanUpPhraseLeaderEventListener()` (×2) — both `.catch()`-appended directly.
- `:271` `clip.get('loop_end')` — awaited in `addPhraseLeader` (row 5 chain).
- `:273` `clip.addListener('playing_position', ...)` — awaited in `addPhraseLeader` (row 5 chain).
- `:298` `ableton.song.get('tracks')` — awaited in `getTracksAndClips` (row 6 chain).
- `:302` `track.get('clip_slots')` — awaited in `getTracksAndClips` (row 6 chain).
- `:340` `clip.get('warp_markers')` — awaited, additionally inside the `playing_slot_index` listener's own `try` block (row 7, belt-and-suspenders).
- `:347` `setTrackVolume(pillar, 0.6)` — `.catch()`-appended directly (necessary despite the surrounding `try/catch`, since it is not awaited — a synchronous `try/catch` cannot catch a later rejection of an un-awaited call; correctly recognized and handled).
- `:361` `addPhraseLeader(newPhraseLeader)` — `.catch()`-appended directly, same reasoning.
- `:397` `cs.get('clip')` — awaited in `getTracksAndClips` (row 6 chain).
- `:408` `ableton.song.get('tempo')` — returned directly from async `getTempo`; the function's own promise chain carries the rejection to its one caller, which awaits inside `try/catch`.
- `:413-415` `ableton.song.set('tempo', tempo)` — `.catch()`-appended directly.
- `:423` `track.get('mixer_device')` — awaited in `getTrackVolumes` (row 9 chain).
- `:424` `mixerDevice.sendCommand('get_volume')` — awaited in `getTrackVolumes` (row 9 chain).
- `:438` `trackVolume?.set('value', volume)` — awaited in `setTrackVolume` (row 10 chain).
- `:499-500`, `:517-518` `clip.set('pitch_coarse', ...)` (×2, in `transposeClipToNewKey`) — both `.catch()`-appended directly.

### `backend/event/IncomingEvents.ts`

- `:90-92` `AbletonAdapter.stopOrRemoveClipFromQueue(...)` inside `handleDepartedTag` — `.catch()`-appended directly (this is the ticket's own named example).
- `:146-153` `get_tempo` handler — `async (_, callback) => { try { await ...; callback(...) } catch (err) { Logger.error(...) } }`. Socket.io never awaits this handler's own returned promise, but since the entire body is inside `try/catch`, the handler cannot itself reject.
- `:158-169` `get_track_volumes` handler — same pattern.
- `:170-176` `set_track_volume` handler — same pattern.

### External-caller sweep

`grep -rn "AbletonAdapter\." backend sim src` (excluding the two audited files) turns up only: `index.ts:23` (`await AbletonAdapter.startAbleton()`, chain confirmed above), `index.ts:36`/`:41` (`addWebSocket`/`connectOscServer`, both synchronous, no promise), `OutgoingEvents.ts:8`/`:24` (a property read and a synchronous `restartTimeoutTimer()` call), `PhraseLeaderService.ts:9` (reads the `TRIGGER_ORDER` array property, not a call). No other module calls into `AbletonAdapter`'s async surface, and `sim/` — confirmed by the pre-existing import-guard test — never imports `backend/` at all. The two audited files are the entire attack surface for this ticket's claim.

### Spot-checks against the implementer's/prior reviewer's claims (bearing directly on my completeness check)

- **`OutgoingEvents.ts` is synchronous** (`backend/event/OutgoingEvents.ts:6-26`, read in full): `emit`, `emitEvent`, `emitEventWithoutResetingTimout` are all plain (non-`async`) functions with no `Promise` return. Confirmed — so none of the many `OutgoingEvents.emitEvent(...)` call sites in the two audited files needed a `.catch()`, as claimed.
- **`PhraseLeaderService.findNextPhraseLeader`** (`backend/service/PhraseLeaderService.ts:5`) is a plain (non-`async`) function. Confirmed — the `const promotedClip = PhraseLeaderService.findNextPhraseLeader(playingClips)` pattern used at `AbletonAdapter.ts:221` and `:359` is not silently awaiting-a-non-promise or treating a Promise as always-truthy.

**Result: zero remaining unguarded call sites.** Every `async function`/`async` arrow in both files, and every individual `ableton-js` Promise-returning method call, terminates in either an explicit `.catch()` or an `await` inside a function whose own rejection is itself provably handled up the chain. This matches the implementer's claim and the audio-ableton-reviewer's independent conclusion; I did not find anything either of them missed.

## Verification commands (the gap the audio-ableton-reviewer's sign-off explicitly left open)

| Command                                     | Result                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p backend/tsconfig.json` | Clean, exit 0.                                                                                                                                                                                                                                                                                                                                            |
| `yarn lint`                                 | Clean, exit 0 (one pre-existing, unrelated warning: "React version not specified in eslint-plugin-react settings").                                                                                                                                                                                                                                       |
| `yarn test`                                 | **68/68 passed**, 13 test files, exit 0. Zero files under `backend/**/test/**` exist or ran — consistent with WOW-015 not having landed. Two files (`useSocketContext.test.tsx`, `useAbletonContext.test.tsx`) print expected React error-boundary console noise for their own "throws outside a Provider" assertions; both are `✓` passes, not failures. |

Test count (68) matches the implementer's handoff claim exactly.

## Test-strategy question: is there testable pure-function surface here today, without WOW-015?

Checked this rather than assuming the ticket's own "reviewer verification only" line was correct.

- **`AbletonAdapter.ts`: no.** The module constructs `const ableton = new Ableton({ logger: Logger })` at import time (`:42`), and every function that changed in this diff reads or mutates non-exported module-closure state (`tracks`, `phraseLeader`, `playingClips`, `queuedClips`, `cleanUpPhraseLeaderEventListener`) with no dependency-injection or reset seam. The one genuinely new piece of _logic_ — the `if (!phraseLeader) {...} else if (...)` guard at `:214-218` — cannot be exercised in isolation without either mocking the entire `ableton-js` package and driving the module through `getTracksAndClips`, or a production-code seam to inject/reset `phraseLeader` directly, which is a real code change outside this ticket's allowed-files list (`backend/adapter/AbletonAdapter.ts`, `backend/event/IncomingEvents.ts`, `backend/index.ts`, `docs/DECISIONS_NEEDED.md` — no test directory listed). Worth noting precisely: **WOW-015 itself will not close this gap either** — its own "Out of scope" line says testing `AbletonAdapter` "needs an abstraction seam — future ticket if wanted." So the ticket's "backend tests if WOW-015 has landed" framing is optimistic for this specific file; landing WOW-015 will not make `AbletonAdapter.ts` testable.
- **`IncomingEvents.ts`: yes, in principle, today.** This file imports `AbletonAdapter` as a plain named object of functions (`import { AbletonAdapter } from '../adapter/AbletonAdapter'`), not `ableton-js` directly. `vi.mock('../adapter/AbletonAdapter')` (hoisted by Vitest before the import executes) would prevent the real `AbletonAdapter.ts` — and therefore the real `ableton-js` and `new Ableton(...)` — from ever loading. With that mock in place, a fake `socket` object (`{ on: (event, handler) => { handlers[event] = handler } }`) passed to `addSocketEventsHandlers` would let a test invoke the new `get_tempo`/`get_track_volumes`/`set_track_volume` try/catch handlers directly, force `AbletonAdapter.getTempo`/etc. to reject, and assert `Logger.error` was called and the ack `callback` was not — a real regression guard for exactly the crash this ticket fixes, using only `vitest` + `vi.mock`, no new dependency, no live Ableton. I did not write this test (out of this ticket's allowed-files scope, and not requested — this is an audit, not an implementation task), but it is a genuine, low-effort testable surface that neither WOW-015 nor WOW-017 currently names explicitly for these three handlers. See Should-fix below.

## Findings

### Blocking

None.

### Should-fix

1. **No ticket currently owns automated coverage for `IncomingEvents.ts`'s three new try/catch socket handlers** (`get_tempo`/`get_track_volumes`/`set_track_volume`, `:146-176`). This is genuinely testable today via `vi.mock('../adapter/AbletonAdapter')` (no `ableton-js`, no WOW-015 harness needed — see analysis above), but it's out of WOW-014's allowed-files scope (no test directory listed), out of WOW-015's stated scope (pure `service`/`util` modules only), and not the literal subject of WOW-017 (which only asks for a "fake `rinfo` address" test on the OSC tag handlers). Recommend a short, explicitly-scoped follow-up ticket (or an amendment to WOW-015/WOW-017's allowed-files) naming `backend/event/test/IncomingEvents.test.ts` so this doesn't fall through the gap between three tickets that each assume it's someone else's job.

### Nits

1. **`AbletonAdapter.ts:33` — `let phraseLeader: ClipInfo;` is not widened to `ClipInfo | undefined`**, even though this PR adds the first runtime code (`:214`) that treats it as genuinely possibly-undefined and even though the PR _did_ apply the equivalent widening to `cleanUpPhraseLeaderEventListener`'s type two lines below (`:34`, `(() => unknown) | undefined` → `(() => Promise<unknown>) | undefined`) for the same class of reason (tsc not objecting is not the same as the annotation being accurate). Doesn't affect `tsc` (module-level `let` isn't subject to definite-assignment analysis across function calls, confirmed `tsc --noEmit` is clean either way) or runtime correctness — purely a type-accuracy/self-documentation nit, and a natural companion to the type fix already made in this same PR.
2. **Client-side UX gap, not introduced by this PR but worth naming for a future ticket:** in all three `IncomingEvents.ts` socket-handler `catch` blocks, the client's ack `callback` is simply never called on error, so a client awaiting an ack (e.g. `socket.emit('get_tempo', {}, (tempo) => ...)`) hangs until its own timeout rather than getting an explicit error response. The implementer's handoff already acknowledges this ("the client's ack simply never arrives, same as it effectively never arrived before when the process crashed") — strictly better than the pre-PR crash-the-whole-server outcome, and fixing the client-visible ack-error UX would need a protocol change outside a crash-hardening ticket's scope. Flagging only so it has a paper trail.

## Required follow-up reviewers

Both specialist sign-offs required by the ticket's safety notes ("Requires audio-ableton-reviewer + hardware-safety-reviewer sign-off") are now recorded, at the same base/head SHAs as this review:

- **audio-ableton-reviewer** — **APPROVE** (`docs/agent-notes/wow-014-audio-ableton-reviewer-signoff.md`).
- **hardware-safety-reviewer** — **APPROVE, with two non-blocking observations** (`docs/agent-notes/wow-014-hardware-safety-reviewer-signoff.md`): (1) a "major, worth a follow-up ticket" note that neither `main` nor this PR attempts to silence Ableton before `process.exit(1)`, so a crash leaves audio playing indefinitely until a human restarts the backend — explicitly out of this ticket's scope, recommended to pair with WOW-032; (2) a "minor" note that the `playing_slot_index` listener's `!clipMetadata` early-return can leave `playingClips[pillar]` briefly stale until the next departed-tag event self-heals it. Neither observation concerns rejection-handling completeness (this review's lens) or musical timing (audio-ableton-reviewer's lens) — both are pre-existing behavior this PR does not change, newly reachable now that the crash is fixed.

From my own lens (test-engineering / crash-hardening completeness), I found no outstanding blocker. Final merge-gate sign-off is not this role's call.
