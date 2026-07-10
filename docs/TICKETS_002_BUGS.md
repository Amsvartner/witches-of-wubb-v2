# Tickets 002 — Bug fixes (repo review 2026-07-10)

Created 2026-07-10 from a full-repo review (Claude, Fable 5, effort high). Ten findings, ticketed WOW-014…WOW-023. WOW-024 added later the same day from a live debugging session. Ticket format follows `docs/TICKETS_001_INITIAL.md`. Agent output notes go to `docs/agent-notes/wow-XXX-<role>-<topic>.md`.

**Suggested order of attack:** WOW-014 → WOW-016 → WOW-017 (small crash/diagnosability fixes) → WOW-015 (test harness, locking behavior before further backend work) → WOW-018, WOW-019, WOW-020, WOW-021 (behavioral correctness) → WOW-022, WOW-023 (process + hygiene).

Tickets touching the Ableton/hardware path (WOW-014, WOW-017, WOW-018, WOW-020, WOW-021) require **audio-ableton-reviewer and/or hardware-safety-reviewer sign-off** per AGENTS.md. Agents never run `yarn start-backend`.

---

- ID: WOW-014
- Title: Backend crash-hardening — unawaited async handlers and unhandled promise rejections
- Summary: Any Ableton error inside a fire-and-forget async call becomes an unhandled promise rejection, which kills the Node process; `nodemon` waits for a file change after a crash, so the installation goes silent until a human intervenes.
- Description: Async functions are called without `await` or rejection handling throughout the hot path: `stopOrRemoveClipFromQueue` at `backend/event/IncomingEvents.ts:90` (the surrounding `try/catch` is synchronous and cannot catch async errors), `triggerQueuedClips()` at `backend/adapter/AbletonAdapter.ts:217` and `:268`, `addPhraseLeader` at `:334`, `handleTimeout` inside `setTimeout` at `:78`. There is also a concrete crash trigger: `AbletonAdapter.ts:210` reads `phraseLeader.clipName` while `phraseLeader` is `undefined` until the first `playing_slot_index` event fires — a tag removed quickly after the very first tag placed can hit it. Fix: (1) await or explicitly `.catch()`-and-log every async call site; (2) guard the `phraseLeader` access; (3) add `process.on('unhandledRejection')` / `process.on('uncaughtException')` handlers that log via pino before exiting; (4) record a Decision-needed entry on crash-restart supervision (nodemon's default does not restart on crash — the show-ops answer may be `nodemon --exitcrash`, pm2, or a launchd/systemd unit).
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/event/IncomingEvents.ts`, `backend/index.ts`, `docs/DECISIONS_NEEDED.md`
- Acceptance criteria: no async call site in `backend/` discards a promise without a rejection path; the `phraseLeader` undefined case is guarded and logged, not crashed; process-level rejection/exception logging in place; zero change to musical behavior, event names, or payloads; simulator + UI smoke (`yarn sim` + `yarn dev`) unchanged.
- Required tests/checks: backend tests if WOW-015 has landed, otherwise reviewer verification of every call site; `yarn lint`; `yarn test`.
- Hardware/Ableton/LED/RFID safety notes: touches clip trigger/stop paths — behavior must be byte-for-byte equivalent on the happy path. Requires audio-ableton-reviewer + hardware-safety-reviewer sign-off. Never run `yarn start-backend`.
- Dependencies: none (WOW-015 improves verifiability but is not required).
- Out of scope: restructuring the adapter; changing timeout semantics (that is WOW-018); supervisor/ops changes beyond the Decision-needed entry.
- Suggested agent(s): creative-tech-integrator (build), reviewer, audio-ableton-reviewer + hardware-safety-reviewer (sign-off)
- Risk: medium (hot path, but mechanical await/catch changes)
- Stop conditions: Any fix that would change ordering or timing of Ableton commands → stop and ask.

---

- ID: WOW-015
- Title: Backend test bootstrap — first tests for pure backend services
- Summary: `backend/` has zero automated tests while being the only code that drives real hardware; `docs/CODING_GUIDELINES.md` cites `backend/service/test/PhraseLeaderService.test.ts` as the convention example, but no such file exists.
- Description: Stand up vitest coverage for the pure (Ableton-free) backend modules, colocated per conventions: `backend/service/test/KeyTranspositionService.test.ts` — verify the Camelot transposition table is internally consistent (symmetry: transposing X→Y and Y→X sum to 0 or ±12; every key maps every other same-letter key exactly once), explicitly covering the two entries the author flagged with `(verify pattern)` comments (`KeyTranspositionService.ts:116` `9B`, `:285` `6A`); `backend/service/test/PhraseLeaderService.test.ts` — trigger-order promotion incl. empty list (returns undefined — coordinate with WOW-014's guard); `backend/util/test/CsvUtil.test.ts` — parseCsv row guards, space-stripped `clipNameToInfoMap` keys (the contract WOW-016 depends on), enrichRecommendations grouping. Decide and document how backend tests run (root vitest picking up `backend/**/test/**` vs. a backend-local runner) — prefer the root runner so CI needs no new step; the sim import-guard must not be weakened.
- Allowed files: `backend/service/test/**`, `backend/util/test/**`, `vite.config.ts` (test includes only), `docs/CODING_GUIDELINES.md` (only if the documented example path needs correcting)
- Acceptance criteria: `yarn test` runs and passes the new backend tests locally and in CI; zero imports of `ableton-js`/`node-osc`/socket.io in the new tests; no production code changes (any bug found is ticketed, not fixed here — matching the WOW-005 pattern); the `(verify pattern)` table entries are either confirmed correct or ticketed with the failing assertion documented.
- Required tests/checks: `yarn test`, `yarn lint`, `yarn build`.
- Hardware/Ableton/LED/RFID safety notes: tests must never import adapters or open sockets. Read-only CSV.
- Dependencies: none.
- Out of scope: testing `AbletonAdapter` (needs an abstraction seam — future ticket if wanted); fixing bugs the tests surface; new dependencies.
- Suggested agent(s): test-engineer (build), reviewer
- Risk: low (test-only), medium-value: locks in musical tables before WOW-018/020/021 touch adjacent code
- Stop conditions: A transposition-table assertion fails → do not "fix" the table; document and stop (musical decision requiring human/artist confirmation).

---

- ID: WOW-016
- Title: Debug modal crashes when unqueueing a clip whose name contains spaces
- Summary: The operator debug modal's queued-clip button looks up `clipNameToInfoMap[queuedClip.clipName]`, but that map's keys are space-stripped at build time, so any real clip name with spaces returns `undefined` and the `.rfid` access throws — taking down the UI the operator is using to fix things.
- Description: `src/container/DebugModalContainer.tsx:105` does `ClipDatabaseUtil.clipNameToInfoMap[queuedClip.clipName].rfid`; keys are built space-stripped in `backend/util/CsvUtil.ts:31` (`clipName?.replace(/[ ]/g, '')`) while `queuedClip.clipName` arrives raw from backend `clip_queued` events (real names like `"Doink U" Vox 122` contain spaces). Fix by using `queuedClip.rfid` directly, exactly as the playing-clip branch at `:91` already does; fall back to a space-stripped lookup only if `rfid` can be absent on queued clips (verify against the event payload — the sim tests document the ack field subset).
- Allowed files: `src/container/DebugModalContainer.tsx`, `src/container/test/**`
- Acceptance criteria: unqueueing a queued clip with a spaced name works against the simulator; a component test covers the spaced-name case with a mocked socket; no event contract changes.
- Required tests/checks: new vitest component test; `yarn test`; `yarn lint`; manual check via `yarn sim` + `yarn dev` (queue a clip, click it in the modal).
- Hardware/Ableton/LED/RFID safety notes: UI-only; emits the existing `/departed/tag` event, no new hardware behavior.
- Dependencies: none.
- Out of scope: other modal improvements; touching `CsvUtil` key normalization (frontend/backend divergence is documented in WOW-023).
- Suggested agent(s): frontend-implementer, test-engineer, reviewer
- Risk: low
- Stop conditions: If queued-clip payloads turn out not to carry `rfid` → stop and confirm the intended lookup key before changing the contract.

---

- ID: WOW-017
- Title: RFID/OSC handlers swallow errors and pass unknown pillars through unguarded
- Summary: Both tag handlers catch errors without logging the error object, and an OSC message from an IP not in the pillar map produces `pillar = undefined`, which is emitted to the UI and crashes inside `queueClip` (where the crash is then swallowed by the same catch). When a reader misbehaves at the venue, the logs say nothing useful.
- Description: `backend/event/IncomingEvents.ts:76-78` and `:94-96` log a fixed string and drop `err` — include the error object and the `rfid`/`requestAddress` context in the pino call. Add an explicit guard after the `IP_ADDRESS_TO_PILLAR_INDEX_MAP` lookup in `handleNewTag`/`handleDepartedTag`: on `undefined`, log a warning naming the offending IP and return without emitting `ingredient_detected`/`ingredient_removed` (the sim already guards out-of-range pillars; this brings the real backend to parity). The pillar IP map itself must not change.
- Allowed files: `backend/event/IncomingEvents.ts`, `backend/event/test/**` (if WOW-015's harness exists)
- Acceptance criteria: unknown-IP tag events produce one clear warning and no emissions, no crash; real errors appear in logs with stack traces; known-IP behavior byte-for-byte unchanged.
- Required tests/checks: `yarn lint`, `yarn test`; handler unit test with a fake rinfo address if the backend harness exists.
- Hardware/Ableton/LED/RFID safety notes: touches the RFID ingress path; the pillar-IP map is frozen per CODING_GUIDELINES ("must not grow without approval"). hardware-safety-reviewer sign-off.
- Dependencies: none (pairs naturally with WOW-014).
- Out of scope: changing the map, retry logic, or event contract.
- Suggested agent(s): creative-tech-integrator, reviewer, hardware-safety-reviewer (sign-off)
- Risk: low
- Stop conditions: none anticipated.

---

- ID: WOW-018
- Title: Idle timeout leaves stale queued clips and a silently cleared master key
- Summary: `handleTimeout` stops all tracks and clears `masterKey`, but never emits `master-key_changed` (UI keeps showing a key that no longer exists) and never clears `queuedClips` — clips queued at timeout linger forever because nothing flushes the queue from silence.
- Description: `backend/adapter/AbletonAdapter.ts:54-59`. Fix: on timeout, clear `queuedClips` (emitting `clip_unqueued` per occupied pillar so the UI drops them) and emit `master-key_changed` with the cleared key; use the without-reset emit variants so the timeout doesn't re-arm itself. Mirror the corrected behavior in `sim/core/simulator.ts` (the sim has idle-timeout tests — extend them to cover queued-at-timeout and key-cleared cases) so tier-1 fidelity holds.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `sim/core/simulator.ts`, `sim/test/simulator.test.ts`
- Acceptance criteria: after timeout: all four pillars silent, queue empty, UI shows no key and no queued clips (verified against the simulator); event additions limited to existing event names (`clip_unqueued`, `master-key_changed`); sim tests cover both new cases and pass.
- Required tests/checks: `yarn test` (extended sim suite), `yarn lint`; sim + UI smoke.
- Hardware/Ableton/LED/RFID safety notes: changes timeout-path musical behavior (what happens to queued clips at timeout is a musical/UX decision — confirm the "drop the queue" choice with the human before implementing if there is any doubt). audio-ableton-reviewer sign-off required.
- Dependencies: WOW-014 (the timeout path must be awaited/caught first so new emissions can't crash the process).
- Out of scope: changing timeout durations; attractor-state behavior (`ATTRACTOR_STATE_CLIP_NAME` is currently unused — noted in WOW-023).
- Suggested agent(s): creative-tech-integrator, test-engineer, reviewer, audio-ableton-reviewer (sign-off)
- Risk: medium (musical behavior change, albeit in a broken corner)
- Stop conditions: Disagreement over intended timeout UX (drop vs. keep queue) → Decision needed.

---

- ID: WOW-019
- Title: Frontend never re-syncs state after a backend restart or reconnect
- Summary: The Ableton context fetches state only when the socket object's identity changes; on a socket.io auto-reconnect the same object reconnects, so the touchscreen shows stale tempo/clips/volumes until someone reloads the page.
- Description: `src/context/hook/useSocketContextProviderState.ts` starts with a `{} as Socket` placeholder and never cleans up; the subscription effect at `src/context/hook/useAbletonContextProviderState.ts:174` depends on `[socket]` only. Fix: subscribe to the socket's `connect` event and re-run `getTracksAndClips()` on every (re)connection (a `connectionEpoch` state counter that the effect depends on is one clean shape); add proper cleanup (`sock.disconnect()`, `offAny`) on unmount; consider replacing the placeholder cast with `Socket | null` handled explicitly (the existing null-ish guards at `useAbletonContextProviderState.ts:109` suggest the shape). Existing mocked-socket tests in `src/context/hook/test/` cover connection behavior — extend them for the reconnect case.
- Allowed files: `src/context/hook/useSocketContextProviderState.ts`, `src/context/hook/useAbletonContextProviderState.ts`, `src/context/hook/test/**`
- Acceptance criteria: killing and restarting the simulator while the UI runs results in the UI re-fetching and showing correct state without a reload; mocked-socket test simulates disconnect→reconnect and asserts re-fetch; no duplicate subscriptions accumulate across reconnects (assert handler counts).
- Required tests/checks: `yarn test` (extended hook tests), `yarn lint`; manual sim restart smoke.
- Hardware/Ableton/LED/RFID safety notes: UI-only.
- Dependencies: none.
- Out of scope: offline/disconnected UI treatment (the `TODO: Show in UI` at `useAbletonContextProviderState.ts:110` — separate UX decision); socket.io version changes.
- Suggested agent(s): frontend-implementer, test-engineer, reviewer
- Risk: low-medium (touchy lifecycle code, but well covered by existing test patterns)
- Stop conditions: Fix requires changing the provider/context API surface consumed by containers → stop and propose first.

---

- ID: WOW-020
- Title: BPM calculation divides by zero on degenerate warp markers
- Summary: A clip with a single warp marker (or two markers at the same sample time) makes `calculateBpmFromWarpMarkers` return `Infinity`/`NaN`, which flows into `setTempo(NaN)` — pushed into Ableton and broadcast to the UI. One badly warped clip in the Live set breaks tempo for the whole installation.
- Description: `backend/adapter/AbletonAdapter.ts:405-410` (`calculateBpmFromWarpMarkers`), consumed at `:316` and adopted as song tempo at `:326` when starting from silence. Guard: fewer than 2 warp markers, zero/negative sample-time span, or a non-finite result → log a warning naming the clip and return `undefined`; callers skip tempo adoption on `undefined` (keep current tempo) and omit `bpm` from the emitted payload (the type already allows `bpm?: number`). Do not invent a fallback tempo — skipping adoption is the no-surprise behavior.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/adapter/test/**` (pure function — testable if WOW-015's harness exists)
- Acceptance criteria: degenerate marker arrays produce a warning and no tempo change; healthy clips byte-for-byte unchanged; `Number.isFinite` guard on anything passed to `setTempo`.
- Required tests/checks: unit test for the pure calculation (0, 1, 2-same-time, and healthy marker arrays); `yarn test`; `yarn lint`.
- Hardware/Ableton/LED/RFID safety notes: touches tempo adoption — audio-ableton-reviewer sign-off required. No change to healthy-path behavior.
- Dependencies: WOW-015 preferred (gives the test harness).
- Out of scope: tempo clamping/rounding policy changes; UI BPM display changes.
- Suggested agent(s): creative-tech-integrator, test-engineer, reviewer, audio-ableton-reviewer (sign-off)
- Risk: low
- Stop conditions: none anticipated.

---

- ID: WOW-021
- Title: Memoized clip lookups never invalidate after clips are re-fetched
- Summary: `MemoizedClipIndex` and `FindAllClipsInLoop` cache Ableton `Clip` object references forever, keyed by `clipName-pillar`; if `getTracksAndClips` re-fetches the Live set, the memo caches keep returning stale `Clip` handles from the previous fetch, so queueing silently breaks (or errors — see WOW-014) after any re-scan.
- Description: `backend/adapter/AbletonAdapter.ts:95-101` and `:113-132` (lodash.memoize with unbounded caches). Fix: clear both caches (`MemoizedClipIndex.cache.clear()`, `FindAllClipsInLoop.cache.clear()`) at the top of `getTracksAndClips` (`:276`), so every fetch starts fresh. Consider whether memoization is worth keeping at all given the lookup cost is a `findIndex` over ~dozens of clips — if removed, behavior must be verified identical.
- Allowed files: `backend/adapter/AbletonAdapter.ts`
- Acceptance criteria: after a second `getTracksAndClips()` call, lookups resolve against the fresh clip set (verifiable by unit test if the adapter gains a seam, otherwise by review); single-fetch behavior unchanged.
- Required tests/checks: `yarn lint`, `yarn test`; reviewer verification of cache-clear placement.
- Hardware/Ableton/LED/RFID safety notes: clip-triggering path — audio-ableton-reviewer sign-off. No musical logic change.
- Dependencies: none (pairs with WOW-014).
- Out of scope: restructuring the adapter's module-level state (larger refactor, separate proposal).
- Suggested agent(s): creative-tech-integrator, reviewer, audio-ableton-reviewer (sign-off)
- Risk: low
- Stop conditions: none anticipated.

---

- ID: WOW-022
- Title: Pin Node version across local, engines, and CI; retire the EOL Node 21 pin
- Summary: CI pins Node 21 (never LTS, now EOL upstream, and explicitly excluded by Vite ≥6's engine range, so it blocks any future toolchain bump); no `engines` field or `.nvmrc` exists anywhere, so every machine runs a different Node.
- Description: `.github/workflows/ci.yml:16` (`node-version: 21`). Pin Node 22 LTS consistently: `engines: { "node": ">=22 <23" }` in root and backend `package.json`, an `.nvmrc` with `22`, and CI `node-version: 22`. Verify `yarn build`, `yarn test`, `yarn lint` under Node 22 before landing (they are verified green under 18 and 25, so 22 is expected-safe — verify anyway). Note for WOW-009 (dependency audit): `@vitest/coverage-c8` is deprecated upstream in favor of `@vitest/coverage-v8`; the swap belongs to the vitest bump in WOW-009 group 2, not this ticket.
- Allowed files: `.github/workflows/ci.yml`, `package.json` + `backend/package.json` (engines field only), `.nvmrc` (new), `README.md` (one line on Node version)
- Acceptance criteria: CI green on Node 22; `engines` + `.nvmrc` agree with CI; no dependency changes.
- Required tests/checks: full CI run (`lint`, `test`, `build`) on the PR.
- Hardware/Ableton/LED/RFID safety notes: the backend process runs under this Node in production — flag the bump to the human for a hardware-day smoke before it's used at the venue (`node-osc` engines allow ≥18; `ableton-js` declares no constraint).
- Dependencies: none; coordinate with WOW-009 to avoid interleaved churn.
- Out of scope: dependency upgrades (WOW-009); coverage-provider swap.
- Suggested agent(s): frontend-implementer or test-engineer, reviewer
- Risk: low
- Stop conditions: Any script fails under Node 22 → stop and report before forcing.

---

- ID: WOW-023
- Title: Hygiene sweep — typos in exported names, dead code, stray console.log, fragile patterns
- Summary: A cluster of small defects that are individually harmless but collectively misleading; one deliberate zero-behavior-change PR in the spirit of WOW-011.
- Description: (1) `WS_SEVER_PORT` typo in both `.env` and `backend/index.ts:9` — rename to `WS_SERVER_PORT` in code and `.env` together (**`.env` edits need human approval per conventions — obtain before starting**); (2) `TIMEOUT_IN_MILISECONDS` / `TIMEOUT_WARNING_IN_MILISECONDS` (`backend/adapter/AbletonAdapter.ts:24-25`) and `emitEventWithoutResetingTimout` (`backend/event/OutgoingEvents.ts:19`) — correct spellings at every call site; (3) raw `console.log('clips', clips)` at `AbletonAdapter.ts:142` — remove or convert to `Logger.debug`; (4) never-read `KEY_LEADER_ORDER` export (`AbletonAdapter.ts:45`) and never-read `ATTRACTOR_STATE_CLIP_NAME` (`:29`) — delete or ticket their intended feature; (5) `[1, 2, 3, 4]?.map` optional chaining on array literals in `src/container/CurrentlyPlayingListContainer.tsx:11` — plain `.map`; (6) dead `trimStart()` assignment at `CurrentlyPlayingListContainer.tsx:17` (unconditionally overwritten by the if/else below — while there, confirm the else-branch's empty-name behavior is intended and comment it); (7) `ingredients_contianer` id in `src/container/RecipeBoxContainer.tsx:24`; (8) dynamic Tailwind class `` `col-start-${…}` `` at `CurrentlyPlayingListContainer.tsx:33` — works only because literal `col-start-1`/`col-start-2` happen to appear later in the same file; replace with a conditional between two full literal class strings; (9) the commented-out `enrichRecommendations` block in `backend/service/MusicDatabaseService.ts:22-24` — delete the dead code and add a short comment documenting the intentional divergence: the frontend (`src/util/ClipDatabaseUtil.ts:11`) **does** run enrichment (grimoire recommendations) while the backend does not (sim test asserts this).
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/event/OutgoingEvents.ts`, `backend/service/MusicDatabaseService.ts`, `backend/index.ts`, `.env` (item 1, approval required), `src/container/CurrentlyPlayingListContainer.tsx`, `src/container/RecipeBoxContainer.tsx`, plus every call site of renamed symbols
- Acceptance criteria: `yarn lint`, `yarn test`, `yarn build` green; zero behavioral change (emitted events/payloads byte-for-byte identical); UI renders identically via sim smoke; grep confirms no old symbol names remain.
- Required tests/checks: `yarn test`, `yarn lint`, `yarn build`, sim + UI smoke.
- Hardware/Ableton/LED/RFID safety notes: renames touch `backend/` — same zero-behavior bar as WOW-011; standard reviewer gate, escalate to specialists if any diff brushes musical logic.
- Dependencies: schedule after the behavioral tickets (WOW-014…021) to avoid rename/fix merge churn.
- Out of scope: any behavior change; `Music Database.csv`; Arduino; new lint rules.
- Suggested agent(s): frontend-implementer + creative-tech-integrator (split by area), reviewer
- Risk: low (mechanical, but wide)
- Stop conditions: Item 1 `.env` approval not granted → skip item 1, land the rest. Any rename that turns out to be load-bearing beyond spelling → stop and ask.

---

- ID: WOW-024
- Title: Debug modal needs a connection indicator and must not emit before the socket is connected
- Summary: Until the socket connects, the socket context hands out an empty placeholder object; clicking any clip in the debug modal then throws `socket.emit is not a function`, and there is no visual cue that the UI isn't connected to a backend. Observed live 2026-07-10: operator clicked samples while the backend was still in its ~1-minute Ableton startup, got silent console TypeErrors, and had no way to tell connected from not.
- Description: `src/context/hook/useSocketContextProviderState.ts:10` initializes state as `{} as Socket` and only swaps in the real socket on the `connect` event, so every consumer sees a non-functional object during startup, backend restarts, and connection failures. `src/container/DebugModalContainer.tsx:27` calls `socket.emit` unguarded in `toggleSong`. Fix: (1) expose connection state from the socket context (e.g. an `isConnected` boolean alongside the socket, or the `Socket | null` shape WOW-019 already suggests — coordinate, same file); (2) in the debug modal, show an explicit "connecting…" indicator and disable clip buttons until connected, flipping live on `connect`/`disconnect` events; (3) ensure clicks while disconnected are impossible or a logged no-op — never a TypeError. Keep the indicator operator-facing (debug modal only); whether the visitor-facing main screen should reflect connection loss is the separate UX decision already noted at `useAbletonContextProviderState.ts:110` (`TODO: Show in UI`) and stays out of scope.
- Allowed files: `src/context/hook/useSocketContextProviderState.ts`, `src/context/hook/useAbletonContextProviderState.ts` (only if the context shape change requires it), `src/container/DebugModalContainer.tsx`, `src/context/hook/test/**`, `src/container/test/**`
- Acceptance criteria: with no backend running, opening the debug modal shows a clear connecting/disconnected indicator and clip buttons are inert (no console errors); starting the sim while the modal is open flips it to connected without a reload; mocked-socket tests cover pre-connect click, connect transition, and disconnect transition; no event contract changes.
- Required tests/checks: `yarn test` (new hook/component tests), `yarn lint`; manual smoke: open UI with no backend → indicator shown; `yarn sim` starts → indicator clears, clips clickable.
- Hardware/Ableton/LED/RFID safety notes: UI-only; no new emissions — strictly prevents emissions that today throw. A disabled-until-connected debug modal also removes a class of accidental double-fires during backend restarts at the venue.
- Dependencies: coordinate with WOW-019 (same hooks/files; WOW-019's reconnect fix and this ticket's connection-state exposure should land as one design, in either order).
- Out of scope: visitor-facing main-screen disconnected treatment (separate UX decision); reconnect/re-sync logic (WOW-019); visual design beyond a minimal operator-facing indicator (escalate to frontend-ui-designer if more than a status line/badge is wanted).
- Suggested agent(s): frontend-implementer, test-engineer, reviewer
- Risk: low
- Stop conditions: If exposing connection state requires changing the context API surface consumed by other containers → align with WOW-019's stop condition: stop and propose first.
