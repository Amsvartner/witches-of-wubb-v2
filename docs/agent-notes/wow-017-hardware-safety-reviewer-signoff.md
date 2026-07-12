# WOW-017 (PR #19, RFID error handling) — hardware-safety-reviewer sign-off

- Reviewer: hardware-safety-reviewer (Claude Sonnet 5)
- Date: 2026-07-12
- Review target: `git diff feat/wow-014-crash-hardening...feat/wow-017-rfid-error-handling` (PR #19), equivalently `gh pr diff 19`
- **Stacked PR note**: PR #19's base is `feat/wow-014-crash-hardening` (PR #16, not yet merged), _not_ `main`. Confirmed via `gh pr view 19 --json baseRefName` (`"baseRefName":"feat/wow-014-crash-hardening"`) and the PR body's own "⚠️ Stacked on #16" banner. This review diffs against that actual base throughout, not `main`.
- Base: `feat/wow-014-crash-hardening` @ `c235678` (= `origin/feat/wow-014-crash-hardening`) · Head: `feat/wow-017-rfid-error-handling` @ `e0eb2b4` (single commit, = `origin/feat/wow-017-rfid-error-handling`, working tree clean)
- Precedent used for format/rigor: `docs/agent-notes/wow-014-hardware-safety-reviewer-signoff.md` (reachable from this branch, since this branch stacks on WOW-014's — confirmed via `git log --oneline feat/wow-017-rfid-error-handling` containing WOW-014's commits).
- Method: **static only.** `yarn start-backend` was not run — no such access, and it is forbidden regardless per `AGENTS.md`'s non-negotiable physical-installation safety rules (live OSC to a real Ableton set and the real lighting server). Nothing was sent to any hardware, Ableton, reader, or lighting-server target in this review. Every claim in the implementer handoff (`docs/agent-notes/wow-017-creative-tech-integrator-rfid-error-handling.md`) and the PR body was independently re-verified against the git objects (`git diff`, `git show <ref>:<file>` side-by-side, byte-level diff and MD5 of the frozen map block, targeted greps across both branches) rather than taken on trust. `npx tsc --noEmit -p backend/tsconfig.json`, `yarn lint`, and `yarn test` were re-run locally (safe, local, no hardware) and independently reproduced clean / clean / 68-68-pass.

## Verdict: **APPROVE**

No safety-blocker found. The pillar IP map is byte-identical to base. The known-IP code path is provably unaffected (same statements, same arguments, unreachable new branch). The `pillar === undefined` guard is the correct check — pillar 0 is not misclassified as unknown. The unknown-IP guard does exactly what the ticket requires: one warning log, then `return`, nothing else. No volume, lighting, or live-command code is touched. `backend/adapter/AbletonAdapter.ts` — where the crash this ticket prevents actually lives — is untouched; the fix is entirely on the ingress side as required.

---

## 1. Pillar IP map — byte-identical — PASS (this ticket's core safety concern)

- `IP_ADDRESS_TO_PILLAR_INDEX_MAP` (`IncomingEvents.ts:13-18`) and `getPillarIPAddressFromIndex` (`:20-22`): diffed lines 1-22 of `git show feat/wow-014-crash-hardening:backend/event/IncomingEvents.ts` against the same range of the head file — **empty diff**. As a second, independent check, extracted just the map literal (`const IP_ADDRESS_TO_PILLAR_INDEX_MAP ... };`) from both versions and MD5-hashed each: both hash to `cbccf1e94c8b8b48a86b6a157df3e2e1`. Byte-identical, confirmed two ways.
- `git diff feat/wow-014-crash-hardening...feat/wow-017-rfid-error-handling --stat` shows exactly two files touched: `backend/event/IncomingEvents.ts` (+16/-2) and the new implementer handoff doc. No diff hunk anywhere touches lines 1-22.
- Consistent with `docs/CODING_GUIDELINES.md:205` ("the existing pillar-IP map must not grow without approval") and the ticket's own text ("The pillar IP map itself must not change").
- No new hardcoded IP/port anywhere in the diff (full-diff grep for dotted-quad addresses found none outside the unchanged block). `.env`, `backend/package.json`, `Arduino/` — all untouched (confirmed via `git diff --stat`, empty).

## 2. Known-IP path — unaffected, byte-identical downstream calls — PASS

Traced both handlers structurally rather than accepting the claim:

- In both `handleNewTag` and `handleDepartedTag`, the new `if (pillar === undefined) { Logger.warn(...); return; }` block is inserted immediately after `const pillar = IP_ADDRESS_TO_PILLAR_INDEX_MAP[requestAddress];` and _before_ any downstream call.
- Critically, every line **after** the new guard block — `OutgoingEvents.emitEvent('ingredient_detected', {...clipMetadata, rfid, pillar, requestAddress})` / `AbletonAdapter.queueClip({...clipMetadata, rfid}, pillar)` in `handleNewTag`; `OutgoingEvents.emitEvent('ingredient_removed', {...clipMetadata, pillar, requestAddress})` / `AbletonAdapter.stopOrRemoveClipFromQueue(clipMetadata.clipName, pillar).catch(...)` in `handleDepartedTag` — appears in the unified diff as **unchanged context lines** (no `+`/`-`). That means the text is byte-identical between base and head: same call, same argument list, same object-spread shape, same variable (`pillar`), same order.
- For any `requestAddress` that is a key in the map, `IP_ADDRESS_TO_PILLAR_INDEX_MAP[requestAddress]` yields one of `{0, 1, 2, 3}` — a `number`, never `undefined`. `pillar === undefined` is therefore `false` for every known IP, by construction of the lookup (not "shouldn't fire in practice" — it structurally cannot fire for a successful map hit). Execution falls through the guard into the exact same statements that existed pre-PR, with the exact same `pillar` value.
- Net conclusion: for a known IP, every downstream call (`emitEvent('ingredient_detected'/'ingredient_removed', ...)`, `AbletonAdapter.queueClip(...)`, `AbletonAdapter.stopOrRemoveClipFromQueue(...)`) receives byte-identical arguments to base. The new guard's `if`-body is provably unreachable on this path.

## 3. `pillar === undefined` vs `!pillar` — pillar-0 correctness — PASS (verified independently, not accepted on claim)

- Per `docs/HARDWARE_INTEGRATION.md`: "4 pillars, indexed 0–3 in code, 1–4 in outgoing OSC addresses." Pillar index `0` is a real, first-class pillar (physical pillar 1), and `IP_ADDRESS_TO_PILLAR_INDEX_MAP['192.168.0.101']` is literally `0` (`IncomingEvents.ts:14`).
- The guard uses strict equality: `if (pillar === undefined)`. In JavaScript/TypeScript, `0 === undefined` evaluates to `false` — no coercion occurs with `===`. So for a tag event from `192.168.0.101`, `pillar` is `0`, the guard condition is `false`, and the function proceeds exactly as it did before this PR (see section 2). Had the guard instead been written as `if (!pillar)`, `!0` is `true` in JS, and **every legitimate tag event from pillar 1 (index 0) would have been silently dropped** — exactly the regression the implementer's handoff claims was avoided. Traced this myself rather than accepting the claim: confirmed by reading the literal map value (`0`), the literal guard condition (`=== undefined`), and JS's own equality semantics — not inferred from prose.
- Cross-checked that this correct pattern (checking pillar by strict/numeric comparison, not truthiness) is how the rest of the codebase already treats pillar 0, which is corroborating context (not part of this diff, unchanged either way): `OutgoingEvents.ts:11` uses `(data?.pillar as number) > -1` (`0 > -1` is `true`, correctly included); the offline simulator's `isValidPillar` (`sim/core/simulator.ts:67-68`) uses `Number.isInteger(pillar) && pillar >= 0 && pillar < PILLAR_COUNT` (also correctly range-based, not truthiness-based) and already logs-and-returns on failure (`sim/core/simulator.ts:181-183`, `:205-207`) — supporting the handoff's "brings the real backend to parity with the simulator" framing, though the simulator itself is untouched by and out of scope for this diff.
- No safety issue: pillar 0 tag events are not misclassified as unknown-IP by this guard.

## 4. Unknown-IP behavior — exactly log + return, no partial emission — PASS

- The guard body is exactly two statements: `Logger.warn(...)` then `return`. Verified `backend/util/Logger.ts` in full — `Logger` is a bare `pino({level: 'info'})` instance; `Logger.warn` has no network, hardware, or Ableton side effect, it only writes a structured log line.
- The `return` sits inside the `if (clipMetadata) {...}` block, itself inside the function body (not inside a nested callback) — so it exits the entire `handleNewTag`/`handleDepartedTag` invocation immediately. Everything textually after it in the function — the `else { Logger.warn("Couldn't find track...") }` branch (unreachable anyway, mutually exclusive with `if (clipMetadata)`), `OutgoingEvents.emitEvent(...)`, `AbletonAdapter.queueClip(...)` / `AbletonAdapter.stopOrRemoveClipFromQueue(...)` — does not execute.
- Confirmed no statement capable of reaching Ableton or the lighting server sits between the map lookup and the `return`. Nothing is emitted, nothing is queued, nothing is sent. A bogus, malicious, or misconfigured sender IP produces exactly one warning log line and nothing else.

## 5. Volume — no involvement — PASS

- Full-diff keyword sweep: `git diff feat/wow-014-crash-hardening feat/wow-017-rfid-error-handling | grep -inE "volume|gain|ramp|\bdb\b"` → **zero matches**.
- `backend/event/IncomingEvents.ts`'s volume-related socket handlers (`set_track_volume`, `get_track_volumes`, both delegating to `AbletonAdapter.setTrackVolume`/`getTrackVolumes`) are outside every diff hunk — read in full, confirmed untouched.
- `AbletonAdapter.ts` (where `setTrackVolume`'s body, the `0.6` auto-volume constant, and all volume ceiling/ramp logic live) is not in this diff at all (see section 8).

## 6. Light / strobe / flicker — no involvement — PASS

- Full-diff keyword sweep: `grep -inE "strobe|flicker|flash|blink|brightness|setinterval|led|artnet|dmx"` over the complete diff → no real matches (only unrelated hunk-header line numbers and doc-prose substrings like "OSC" in the handoff note; no LED/Art-Net/DMX code, no new interval/timer, no brightness/flicker term in code).
- `backend/event/OutgoingEvents.ts` and `backend/adapter/LightingAdapter.ts` (both read in full as required context) — zero changes; `git diff ...--stat` for both paths against this PR is empty. Neither file appears in this diff.
- No new emission frequency, no new loop, no new timer anywhere in the diff — the two new `if` blocks are pure early-return guards, not new emission paths.

## 7. Live commands (OSC/MIDI/Art-Net/serial) and sim-guard bypass — no new emission path, no bypass — PASS

- Full-diff keyword sweep for `osc|midi|serial|client|socket\.io|new nodeOSC|sendOscMessage` → only doc-prose matches in the handoff note and PR body (referring to _how to test_, e.g. "send an OSC `/new/tag` message"), no code matches. No new OSC/MIDI/Art-Net/serial client, constructor, or send call is introduced anywhere.
- The change is a pure ingress-side filter: it only ever _prevents_ an event from propagating further (via early `return`); it cannot cause a new or additional emission. There is no code path in this diff that could newly reach `LightingAdapter.sendOscMessage` or any Ableton RPC — if anything, the unknown-IP case now reaches **fewer** downstream calls than before (previously it reached `AbletonAdapter.queueClip` and threw; now it reaches nothing).
- No environment-variable-driven simulation guard exists in this diff to check for bypass (this PR doesn't touch any sim-guard/env-gated code at all — the closest such guard, `yarn start-backend` vs. the offline simulator, is unaffected and untouched). Nothing in this change could weaken that separation.

## 8. `backend/adapter/AbletonAdapter.ts` — confirmed NOT in this diff — PASS

- `git diff feat/wow-014-crash-hardening...feat/wow-017-rfid-error-handling --stat` output in full:
  ```
   backend/event/IncomingEvents.ts                                          | 16 +++++++-
   docs/agent-notes/wow-017-creative-tech-integrator-rfid-error-handling.md | 44 ++++++++++++++++++++++
   2 files changed, 58 insertions(+), 2 deletions(-)
  ```
  Exactly two files. `AbletonAdapter.ts` does not appear.
- This matters because the crash this ticket closes lives there: `queueClip` → `FindAllClipsInLoop(clipName, pillar)` → `allAbletonClips[pillar].slice(...)`, which throws when `pillar` is `undefined` (`allAbletonClips[undefined]` is `undefined`, `.slice` on it throws `TypeError`). I traced this call chain in the current `AbletonAdapter.ts` on this branch to confirm the crash site the ticket/handoff describe actually exists and matches the description — it does. The fix correctly stops the bad value at the ingress boundary (`IncomingEvents.ts`) rather than patching the crash site itself, which is the right shape of fix for "unknown/untrusted input arriving from the network" and keeps the change minimal and reviewable.

## 9. Error-logging change (both `catch` blocks) — diagnostics only, no safety impact — PASS

- `Logger.error('Errored trying find track from RFID tag')` → `Logger.error(err, \`Errored trying to find track from RFID tag ${rfid} (${requestAddress})\`)`in both handlers. This is pino's error-first call form (first arg becomes the serialized`err`object with stack trace); consistent with the convention already established on this same file by WOW-014 (confirmed by reading`IncomingEvents.ts`'s other `catch`blocks, e.g.`get_tempo`, `get_track_volumes`, `set_track_volume`handlers at lines 158-188, all already using`Logger.error(err, '...')` form pre-existing from WOW-014).
- Purely additive diagnostic information (the error object and rfid/IP context). No control-flow change, no new value computed or passed anywhere else, no behavior change beyond what gets written to the log.

## 10. Failure-mode analysis

- **Max volume**: not applicable — no volume code touched (section 5).
- **Reconnect / flood from an unknown or spoofed IP**: before this PR, a flood of `/new/tag` messages from an unrecognized IP would each attempt `queueClip` with `pillar=undefined`, throw, and get silently swallowed by the old string-only catch (still functioned as a de facto per-message drop, just with an unhelpful log and — per the ticket's own "Summary" — the _crash itself_ being what's swallowed, i.e. it was already resilient to a full process crash, just opaque). After this PR, each message produces one warning log and returns. Neither version applies any rate limiting to repeated unknown-IP messages, so a sustained flood could still produce log spam either way — this is a pre-existing characteristic of the ingress path, not a regression introduced by this PR, and rate-limiting is outside this ticket's stated scope (no ticket text or `AGENTS.md` rule requires it here). Not a blocker; noting for completeness per this reviewer's remit to consider failure modes.
- **Partial startup**: the new guard sits _inside_ the pre-existing `if (clipMetadata)` branch, which already depends on `MusicDatabaseService.rfidToClipMap[rfid]` having resolved. If the CSV/database service hasn't finished loading, `clipMetadata` is falsy and control goes to the pre-existing `else { Logger.warn("Couldn't find track from RFID tag") }` branch instead — the new guard is never reached in that case. The new guard does not introduce any new dependency on startup ordering; it is strictly nested inside an already-existing condition.
- **State of already-playing/queued clips when an unknown-IP or malformed-departed event is dropped**: the guard is a pure ingress filter for the one incoming event being processed; it does not read or write `playingClips`/`queuedClips`/any other shared state. Dropping an unrecognized-IP `/departed/tag` cannot stop/orphan a clip that's actually playing on a known pillar, because a genuine departed-tag from a real reader always carries that reader's real (mapped) IP — the only case affected is a message from an IP that was never a valid source in the first place, which the old code could not have handled correctly either (it would have crashed attempting to resolve `pillar`). No new "stuck" or "orphaned" state is introduced.

---

## Supporting checks (independently re-run, not just taken from the handoff)

- `npx tsc --noEmit -p backend/tsconfig.json` — clean, exit 0.
- `yarn lint` — clean, exit 0.
- `yarn test` — 68/68 passed (13 test files), exit 0.
- `git diff feat/wow-014-crash-hardening...feat/wow-017-rfid-error-handling --stat` — exactly `backend/event/IncomingEvents.ts` and the implementer's own agent-note. Matches the ticket's allowed-files list (`backend/event/IncomingEvents.ts`, `backend/event/test/**` if the harness exists — it doesn't yet, confirmed `backend/event/test/` absent, consistent with the handoff's own statement). No scope creep.
- `Arduino/`, `src/assets/Music Database.csv`, `.env`, `backend/package.json`, `backend/yarn.lock`, root `package.json`/`yarn.lock`, `backend/adapter/AbletonAdapter.ts`, `backend/adapter/LightingAdapter.ts`, `backend/event/OutgoingEvents.ts` — confirmed untouched (`git diff --stat` empty for all).
- PR #19 body reviewed via `gh pr view 19`: safety checklist and validation checklist match the handoff note; "Merge order matters" callout for the stacked-base is present and accurate; specialist sign-off (this document) is correctly listed as pending in the PR's pipeline-status checklist prior to this review.

## No live-hardware verification was performed

This review is static-only. `yarn start-backend` was not run by this reviewer or (per the PR body and handoff note) by any agent against this change — it requires a live Ableton connection and sends real OSC to the real lighting server and reads from real RFID readers, which is a live-hardware command under `AGENTS.md`'s non-negotiable rules and outside this reviewer's access regardless.

The PR body's three human demo steps remain required **human**, real-hardware/real-simulator verification before venue redeploy:

1. Unknown-IP guard: send an OSC `/new/tag` message from an IP not in the pillar map — expect one warning log, no emission, no crash.
2. Error logging: force an error inside either handler's try block — confirm the log now includes the full error/stack.
3. Known-IP parity: place a real tag on a real pillar via the simulator (`yarn sim` + `yarn dev`) — confirm behavior is identical to before this PR.

None of these three steps were exercised by this reviewer. This review's confidence in "known-IP parity" (section 2) and "pillar-0 correctness" (section 3) rests on static tracing of the code (diff structure, JS equality semantics, byte-identical downstream statements), not on running the demo steps.

---

**Verdict: APPROVE.** No safety-blocker. The pillar IP map is confirmed byte-identical to base (two independent methods: line diff and MD5 of the literal block). The known-IP path is provably unaffected — the new guard's body is structurally unreachable when `pillar` resolves to a real index, and every downstream call after it is an unchanged context line in the diff. The `pillar === undefined` check is correct and does not misclassify pillar 0 (`0 === undefined` is `false` in JS); a `!pillar` check would have been the actual hazard here, and that is not what was shipped. The unknown-IP guard's effect is exactly "log a warning, then return" — no partial emission, no call into `AbletonAdapter`, nothing reaches Ableton or the lighting server. No volume, lighting/strobe, or live-command (OSC/MIDI/Art-Net/serial) code is touched anywhere in this diff. `backend/adapter/AbletonAdapter.ts` is confirmed absent from the diff — the fix is entirely ingress-side as the ticket requires. Sign-off granted for merge of PR #19, contingent on PR #16 (its stacked base) landing first as the PR itself already notes, and on the three human/real-hardware-or-simulator demo steps above being run by a human — no live-hardware or OSC verification was performed by this reviewer.
