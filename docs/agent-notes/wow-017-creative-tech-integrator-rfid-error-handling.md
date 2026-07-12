# WOW-017 — creative-tech-integrator handoff (RFID/OSC error handling)

Date: 2026-07-12
Executor: Claude Sonnet 5 (creative-tech-integrator role, unattended `/ship-feature` pipeline)
Branch: `feat/wow-017-rfid-error-handling` (**stacked on `feat/wow-014-crash-hardening`** — same file, `backend/event/IncomingEvents.ts`; PR base is WOW-014's branch, not `main`)
Scope: two mechanical fixes in `handleNewTag`/`handleDepartedTag`. **Pillar IP map untouched, zero change to known-IP behavior.**

## What changed

1. **Both `catch` blocks now log the error object plus context.** `Logger.error('Errored trying find track from RFID tag')` (fixed string, `err` dropped) → `Logger.error(err, \`Errored trying to find track from RFID tag ${rfid} (${requestAddress})\`)` — pino's error-first form (established convention from WOW-014/WOW-032 on this same file), gets full stack-trace serialization plus the rfid/IP that were previously invisible in the log.
2. **Explicit guard on unknown-IP tag events**, added right after the `IP_ADDRESS_TO_PILLAR_INDEX_MAP` lookup in both handlers, inside the `if (clipMetadata)` branch (before any emit): if `pillar === undefined`, log a warning naming the offending IP and rfid, then `return` — no `ingredient_detected`/`ingredient_removed` emission, no downstream call. This brings the real backend to parity with the simulator, which already guards out-of-range pillars (`sim/core/simulator.ts`, confirmed by the ticket text and the existing sim test "ignores out-of-range pillar indices without stretching the 4-slot state").

## The exact crash this closes

Traced the failure mode rather than assuming the ticket's description: with `pillar` undefined, the old code called `AbletonAdapter.queueClip({ ...clipMetadata, rfid }, undefined)`. Inside `queueClip`, `FindAllClipsInLoop(clipName, pillar)` does `allAbletonClips[pillar]` — `allAbletonClips[undefined]` is `undefined`, and the memoized function's body calls `.slice(...)` on it, which throws a `TypeError`. That throw propagates back up through `queueClip` (synchronous, uncaught within it) to `handleNewTag`'s `try` — where it _was_ being swallowed by the string-only `catch`, which is exactly the ticket's second complaint (a real crash, silently discarded, invisible in logs). The new guard prevents ever reaching `queueClip` with an undefined pillar in the first place.

## A correctness detail worth recording

The guard is `pillar === undefined`, not `!pillar`. Pillar indices are `0`–`3`; pillar `0` is falsy in JS but a completely valid pillar (the map's own `getPillarIPAddressFromIndex` reverse-lookup would break the same way if written carelessly — checked it or hand, it also compares by index, not truthiness, so no shared bug there). A `!pillar` guard would have silently broken pillar 0 tag events. Verified `IP_ADDRESS_TO_PILLAR_INDEX_MAP['192.168.0.101']` is `0` and confirmed the new guard only fires for `undefined` (i.e., only for IPs genuinely absent from the map), not for pillar 0's legitimate `0` value.

## What did NOT change

- `IP_ADDRESS_TO_PILLAR_INDEX_MAP` itself — byte-identical, frozen per `docs/CODING_GUIDELINES.md` ("the existing pillar-IP map must not grow without approval"). This ticket documents/guards around it, never edits it.
- Known-IP behavior — for any `requestAddress` present in the map, `pillar` resolves exactly as before and every downstream call (`emitEvent`, `queueClip`, `stopOrRemoveClipFromQueue`) is byte-identical; the new guard's `if` branch is simply never entered on that path.
- No event contract change — `ingredient_detected`/`ingredient_removed`/`clip_queued`/etc. unchanged; the fix only prevents emission for a case that previously either crashed or silently emitted garbage (`pillar: undefined` in the payload).
- Retry logic — none added, matches "Out of scope."

## Test coverage

No new test added. The ticket's own required-tests line is conditional: "handler unit test with a fake rinfo address **if the backend harness exists**." WOW-015 (which establishes `backend/**/test/**` conventions) hasn't landed yet in this run's order — confirmed via `ls backend/event/test/` (does not exist) before deciding. Per the ticket's own fallback and WOW-014's precedent for the same situation, this PR relies on `yarn lint`/`yarn test` (both green, unaffected) plus reviewer verification of every call site instead. Flagging as a natural candidate for WOW-015's follow-on test coverage once that harness lands (not filing a separate task — WOW-015 is already the next ticket in this run's order and its own scope note calls out exactly this kind of gap).

## Verification performed (agent-side, non-hardware)

- `npx tsc --noEmit -p backend/tsconfig.json` — clean.
- `yarn lint` — clean.
- `yarn test` — 68/68 passed (this branch's baseline, from WOW-014; unaffected).
- `git diff feat/wow-014-crash-hardening --stat` — confirms exactly one file changed, `backend/event/IncomingEvents.ts`, matching the ticket's allowed-files list.
- **No agent ran `yarn start-backend`** — same non-negotiable rule as every backend ticket in this run.

## How to verify (human demo steps)

1. **Unknown-IP guard**: send an OSC `/new/tag` (or `/departed/tag`) message from an IP not in `IP_ADDRESS_TO_PILLAR_INDEX_MAP` (e.g. via a test OSC client) — expect one warning log naming the IP and rfid, no `ingredient_detected` emission, no crash.
2. **Error logging**: force an error inside either handler's try block (e.g. temporarily point `MusicDatabaseService.rfidToClipMap` at something that throws on access) — confirm the log now includes the full error/stack, not just the fixed string.
3. **Known-IP parity**: place a real tag on a real pillar via the simulator (`yarn sim` + `yarn dev`) — confirm behavior is identical to before this PR (this is the low-risk, well-covered path; the sim doesn't exercise the OSC transport directly but the `wsHandler` path shares the same `handleNewTag`/`handleDepartedTag` functions this PR touches).
