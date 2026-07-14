# Tickets 002 — Bug fixes (repo review 2026-07-10)

Created 2026-07-10 from a full-repo review (Claude, Fable 5, effort high). Ten findings, ticketed WOW-014…WOW-023. WOW-024 added later the same day from a live debugging session. WOW-025…WOW-031 added the same day from a second review pass covering the CSV data, Arduino firmware, sim server, and frontend event handling. WOW-032 added from the same live debugging session as WOW-024. WOW-033 added 2026-07-12 from an audio-ableton-reviewer follow-up flagged during the WOW-018/PR #22 review (a pre-existing gap adjacent to, but out of scope for, that PR). WOW-034 added 2026-07-12 from the WOW-014 hardware-safety-reviewer sign-off's non-blocking follow-up recommendation. WOW-035 added 2026-07-12 as a deferred follow-up from WOW-024 (PR #24) — same guard-condition fix, mirrored to `useAbletonContextProviderState.ts`. WOW-036 added 2026-07-14 as the fast-follow from the WOW-031/PR #29 audio-ableton-reviewer re-sign-off (finding 2), unblocked by the 2026-07-14 human decision on intra-block decoration recorded in `docs/ABLETON_INTEGRATION.md` via PR #47.

**Suggested order of attack:** WOW-028 first (public credential leak — rotation is a human action and can happen today) → WOW-014 + WOW-032 + WOW-034 (crash-hardening, startup diagnostics, and crash-exit audio-silencing — same file, coordinated exit semantics) → WOW-016 → WOW-017 (small crash/diagnosability fixes) → WOW-015 + WOW-025 (test harness + data validation, locking behavior before further backend work) → WOW-018, WOW-019 + WOW-024 (same hooks/files — land as one design) → WOW-033 (same function as WOW-018; land only after WOW-018/PR #22 merges, to avoid rebasing one atop the other) → WOW-020, WOW-021, WOW-026, WOW-027, WOW-031 (behavioral correctness) → WOW-036 (WOW-031 fast-follow; land after docs PR #47 merges) → WOW-029, WOW-030 (firmware, needs a hardware day) → WOW-022, WOW-023 (process + hygiene).

Tickets touching the Ableton/hardware path (WOW-014, WOW-017, WOW-018, WOW-020, WOW-021, WOW-025, WOW-027, WOW-031, WOW-033, WOW-034, WOW-036) require **audio-ableton-reviewer and/or hardware-safety-reviewer sign-off** per AGENTS.md. Firmware tickets (WOW-028, WOW-029, WOW-030) additionally require a human to flash and bench-test — agents never touch hardware. Agents never run `yarn start-backend`.

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
- Description: (1) `WS_SEVER_PORT` typo in both `.env` and `backend/index.ts:9` — rename to `WS_SERVER_PORT` in code and `.env` together (**`.env` edits need human approval per conventions — obtain before starting**); (2) `TIMEOUT_IN_MILISECONDS` / `TIMEOUT_WARNING_IN_MILISECONDS` (`backend/adapter/AbletonAdapter.ts:24-25`) and `emitEventWithoutResetingTimout` (`backend/event/OutgoingEvents.ts:19`) — correct spellings at every call site; (3) raw `console.log('clips', clips)` at `AbletonAdapter.ts:142` — remove or convert to `Logger.debug`; (4) never-read `KEY_LEADER_ORDER` export (`AbletonAdapter.ts:45`) and never-read `ATTRACTOR_STATE_CLIP_NAME` (`:29`) — delete or ticket their intended feature; (5) `[1, 2, 3, 4]?.map` optional chaining on array literals in `src/container/CurrentlyPlayingListContainer.tsx:11` — plain `.map`; (6) dead `trimStart()` assignment at `CurrentlyPlayingListContainer.tsx:17` (unconditionally overwritten by the if/else below — while there, confirm the else-branch's empty-name behavior is intended and comment it); (7) `ingredients_contianer` id in `src/container/RecipeBoxContainer.tsx:24`; (8) dynamic Tailwind class `` `col-start-${…}` `` at `CurrentlyPlayingListContainer.tsx:33` — works only because literal `col-start-1`/`col-start-2` happen to appear later in the same file; replace with a conditional between two full literal class strings; (9) the commented-out `enrichRecommendations` block in `backend/service/MusicDatabaseService.ts:22-24` — delete the dead code and add a short comment documenting the intentional divergence: the frontend (`src/util/ClipDatabaseUtil.ts:11`) **does** run enrichment (grimoire recommendations) while the backend does not (sim test asserts this); (10) comments in `sim/server.ts` (`:4`, `:43`, `:91`, `:101`, `:136`) reference pre-WOW-011 paths (`backend/events/incoming-events.ts`, `backend/ableton-api.ts`) — update to the current `backend/event/`/`backend/adapter/` paths.
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

---

- ID: WOW-025
- Title: CSV data integrity — duplicate clip name corrupts metadata lookup; add validation tests
- Summary: Two rows in `Music Database.csv` share the clip name `Flashback Drums 10A 135` (line 72, type Drums, and line 74, type Melody/Synth) — `clipNameToInfoMap` is keyed by space-stripped clip name, so the last-parsed row silently overwrites the first, and the backend resolves playing-clip metadata by that map: a pillar playing the Drums clip reports Melody metadata — wrong type feeds `PhraseLeaderService`'s `TRIGGER_ORDER` sorting (musical behavior), the UI category color, and the icon.
- Description: Line 74 (RFID `e280f3372000f00003effc3f`, "bone powder", instrument Synth) is almost certainly a data-entry error — its clip name duplicates the Drums row above it instead of naming its own Melody clip (compare line 95's `Flashback Bass 1A 135` naming pattern). The correct name must be confirmed against the Ableton Live set by a human — agents must not guess it. Alongside the fix, add data-validation tests so this class of error can't recur silently: unique RFIDs, unique space-stripped clip names, `Key` values present in `KeyTranspositionService.TRANSPOSITIONS` (empty allowed — keyless clips exist), `Clip Type` in the `ClipTypes` enum, and every `Icon / Asset Name` present in `public/ingredients/` (all of these pass today except the name collision). Natural homes: extend `sim/test/music-database.test.ts` and `src/util/test/ClipDatabaseUtil.test.ts`, or a dedicated `src/assets/test/` validation suite — implementer's choice, but it must run in `yarn test`.
- Allowed files: `src/assets/Music Database.csv` (**human edit only** — the CSV is agent-read-only per repo conventions), `sim/test/**`, `src/util/test/**`, `src/assets/test/**`
- Acceptance criteria: validation tests exist, run in `yarn test`, and fail on the current CSV until the human corrects line 74; after correction, full suite green; no parser/production code changes.
- Required tests/checks: `yarn test`, `yarn lint`.
- Hardware/Ableton/LED/RFID safety notes: the clip name must match the real Live set exactly — wrong name means the tag silently stops triggering (see `FindAllClipsInLoop`). audio-ableton-reviewer sign-off on the corrected row.
- Dependencies: pairs with WOW-015 (same test-first spirit); none blocking.
- Out of scope: renaming any other CSV row; normalization changes (WOW-031); parser changes.
- Suggested agent(s): test-engineer (validation suite), human + audio-ableton-reviewer (CSV correction)
- Risk: low (test-only for agents; one-cell data fix for the human)
- Stop conditions: Intended clip name cannot be confirmed from the Live set → artist decision, do not guess.

---

- ID: WOW-026
- Title: `ingredient_removed` handler matches clip names across all pillars instead of the event's pillar
- Summary: The frontend `ingredient_removed` handler decides the "was it playing or queued?" branch by searching **all** pillars for a matching clip name, then mutates the event's pillar slot — if the same clip name exists on two pillars (possible today: two RFID tags map to the same clip name, see WOW-025), removing a tag on one pillar can incorrectly clear or set stopping-state on the other pillar's UI slot.
- Description: `src/context/hook/useAbletonContextProviderState.ts:132-137`: `playingClipsRef.current.some((item) => item?.clipName === data.clipName)` and the sibling `queuedClipsRef` check scan every pillar; the state updates then target `data.pillar`. The branch condition and the mutation target disagree. Fix: compare the specific slot — `playingClipsRef.current[data.pillar]?.clipName === data.clipName` (and same for queued). Note: this site is WOW-012's location — the `findIndex` truthiness bug WOW-012 describes was already fixed by the context restructure (commit `0aaa123` introduced the current `.some`), so WOW-012 in `TICKETS_001_INITIAL.md` should be closed as done when this lands, with this ticket superseding it.
- Allowed files: `src/context/hook/useAbletonContextProviderState.ts`, `src/context/hook/test/**`, `docs/TICKETS_001_INITIAL.md` (WOW-012 status note only)
- Acceptance criteria: mocked-socket test covers: same clip name playing on pillar A while `ingredient_removed` arrives for pillar B → pillar A untouched; the normal single-pillar removal path unchanged; suite green.
- Required tests/checks: `yarn test` (new hook test), `yarn lint`.
- Hardware/Ableton/LED/RFID safety notes: UI state only; no emissions change.
- Dependencies: none (WOW-025's CSV fix removes today's known duplicate, but the handler should be correct regardless).
- Out of scope: backend `ingredient_removed` payload changes; the stopping-clips visual treatment.
- Suggested agent(s): frontend-implementer, test-engineer, reviewer
- Risk: low
- Stop conditions: none anticipated.

---

- ID: WOW-027
- Title: Tempo/volume sliders flood the backend, Ableton, and the lighting server on every drag pixel
- Summary: Both sliders emit one socket event per `input` event (per pixel of drag). Each `set_tempo` triggers an Ableton API call, a `tempo_changed` broadcast to every client, an OSC message to the lighting server, and a timeout-timer reset — a single slider drag produces hundreds of each.
- Description: `src/container/TempoSliderContainer.tsx:9-12` and `src/container/VolumeSliderContainer.tsx:13-16` call `changeTempo`/`changeTrackVolume` unthrottled from `onChange`. Backend cost per event: `ableton.song.set('tempo', …)` (`backend/adapter/AbletonAdapter.ts:376-380`), broadcast + lighting OSC (`backend/event/OutgoingEvents.ts:6-17`), `clearTimeout`×2 + `setTimeout`×2 (`restartTimeoutTimer`). Fix on the frontend only: throttle the emission (~75–100ms, trailing edge included so the released position always lands) while updating the local slider position immediately for responsiveness. Do not throttle the backend — that would change behavior for all callers. No new dependency without approval: a ~10-line local `throttle` util in `src/util/` is sufficient (the frontend has no lodash; `lodash.throttle` exists only in `backend/`).
- Allowed files: `src/container/TempoSliderContainer.tsx`, `src/container/VolumeSliderContainer.tsx`, `src/util/` (new throttle util + test), `src/container/test/**`, `src/util/test/**`
- Acceptance criteria: dragging a slider end-to-end against the simulator produces a bounded stream of `set_tempo`/`set_track_volume` events (sim logs every received event — count them) with the final value always emitted; slider UI stays responsive during the drag; util covered by unit tests incl. trailing-edge behavior.
- Required tests/checks: `yarn test`, `yarn lint`; manual sim smoke with event-count check in the sim log.
- Hardware/Ableton/LED/RFID safety notes: reduces load on the Ableton and lighting/OSC paths; no payload or event-name changes. audio-ableton-reviewer sign-off (tempo is musical).
- Dependencies: none.
- Out of scope: backend throttling; debouncing other controls; new dependencies.
- Suggested agent(s): frontend-implementer, test-engineer, reviewer, audio-ableton-reviewer (sign-off)
- Risk: low-medium (touch interaction feel on the installation screen — verify on-device before the venue)
- Stop conditions: Throttling makes the on-screen slider feel laggy on the actual touch hardware → tune or stop and ask.

---

- ID: WOW-028
- Title: SECURITY — Wi-Fi credentials committed to a public repo; rotate and remove
- Summary: Both Arduino sketches contain the installation network's SSID and password in plaintext (`Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino:37-38`, `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino:11-12`), plus commented-out credentials for two other networks (`Unit_RFID_M5Core.ino:31-41`). The repo is **public** on GitHub, and the credentials are in git history (commit `e4b22c2`). The installation network carries unauthenticated OSC and Art-Net — anyone in radio range who reads GitHub can join and inject control traffic (trigger/stop music, drive the LEDs).
- Description: (1) **Human, immediately and independent of any code change:** rotate the `wubb-net` password, and treat the two commented-out networks' credentials as leaked too (rotate if they are real home/venue networks). (2) Move credentials out of source: `#include "secrets.h"` with a gitignored `secrets.h` per sketch and a committed `secrets.h.example`; delete the commented-out credential blocks entirely. (3) Record a Decision-needed on git-history scrubbing (BFG/filter-repo) — rotation makes the old secrets worthless, so scrubbing is optional hygiene, but decide explicitly. (4) While touching the sketches, do not change any behavior — this ticket is credentials-only.
- Allowed files: `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino`, `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino`, `Arduino/**/secrets.h.example` (new), `.gitignore`, `docs/DECISIONS_NEEDED.md`, `docs/HARDWARE_INTEGRATION.md` (flashing note)
- Acceptance criteria: no credential strings anywhere in the working tree (grep-verified); sketches compile with a provided `secrets.h` (human-verified — agents cannot compile/flash); `.gitignore` covers `Arduino/**/secrets.h`; rotation confirmed by the human; Decision-needed entry recorded.
- Required tests/checks: grep for the removed strings; human compile/flash verification on one device of each type before venue redeploy.
- Hardware/Ableton/LED/RFID safety notes: firmware changes are flashed by humans only; a mis-flashed reader/LED node degrades the show — schedule alongside a hardware day. Reflashing all devices requires the rotated credentials in each device's `secrets.h`.
- Dependencies: none — the rotation (step 1) must not wait for the code change.
- Out of scope: any functional firmware change (WOW-029/WOW-030); network redesign (VLANs, OSC auth) — worth a separate security discussion, noted in DECISIONS_NEEDED.
- Suggested agent(s): creative-tech-integrator (code move only), hardware-safety-reviewer (review), human (rotation + flash)
- Risk: the code change is low; the exposure it fixes is high (public, unauthenticated show-control network)
- Stop conditions: none — if anything blocks the code change, the credential rotation still proceeds.

---

- ID: WOW-029
- Title: LED firmware ignores Wi-Fi failure and never reconnects — LEDs freeze mid-show on a network blip
- Summary: `ArtnetWifiFastLED.ino` gives up on Wi-Fi after ~10s but `setup()` ignores `ConnectWifi()`'s return value and proceeds anyway, and `loop()` never checks `WiFi.status()` — an AP reboot or signal dropout mid-show leaves the LED node frozen on its last frame until someone power-cycles it.
- Description: `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino:155` (`ConnectWifi();` — return value discarded), `:165-169` (`loop()` only calls `artnet.read()`). Fix: track connection state in `loop()`; on disconnect, attempt reconnection with backoff, and drive the LEDs to a deliberate fallback state while disconnected. **What the LEDs should show during signal loss is a show-design decision** (hold last frame / fade to a dim ambient / blank) — record as Decision-needed and implement the chosen option; do not invent it. Also surface boot-time connection failure visibly (e.g. a distinct dim color) instead of silently running with no network.
- Allowed files: `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino`, `docs/DECISIONS_NEEDED.md`, `docs/HARDWARE_INTEGRATION.md`
- Acceptance criteria: bench test (human): kill the AP mid-stream → node enters the chosen fallback state and recovers automatically when the AP returns, without power-cycling; boot without Wi-Fi shows the failure state; normal Art-Net behavior byte-identical when connected.
- Required tests/checks: human bench test per above; agents limit themselves to code review (no compile/flash capability).
- Hardware/Ableton/LED/RFID safety notes: reconnect/fallback transitions must not strobe — hardware-safety-reviewer sign-off required on the chosen fallback and transition behavior (visitor-facing light).
- Dependencies: WOW-028 (same file — land the secrets move first to avoid conflicts); the fallback-state decision.
- Out of scope: brightness/gamma changes; Art-Net protocol changes; the RFID sketch (WOW-030).
- Suggested agent(s): creative-tech-integrator, hardware-safety-reviewer (sign-off), human (bench test + flash)
- Risk: medium (firmware, human-in-the-loop testing only)
- Stop conditions: Fallback-state decision unanswered → implement reconnection but stop before changing any visible LED behavior.

---

- ID: WOW-030
- Title: RFID reader pillar identity relies on hand-edited static IPs; checked-in default silently maps to no pillar
- Summary: The backend derives which pillar a tag event came from by matching the reader's source IP against the frozen map `192.168.0.101-104` (`backend/event/IncomingEvents.ts:13-18`), but the sketch ships with `IPAddress ip(192, 168, 0, 52)` and an `// UPDATE ME!!!` comment (`Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino:43-44`) — a reader flashed as-checked-in emits tags the backend silently drops (until WOW-017 adds the warning), and four devices require four undocumented hand edits with nothing recording which device is which pillar.
- Description: Conservative hardening, no contract change: (1) move the per-device IP into the same gitignored `secrets.h`/config header established by WOW-028, with a committed example listing all four pillar IPs and their pillar numbers; (2) document the pillar↔IP table in `docs/HARDWARE_INTEGRATION.md` right next to a pointer at the backend map, including the flash-time checklist ("set pillar N → IP .10N"); (3) print the configured IP and derived pillar number over serial at boot so a mis-flashed device is diagnosable in seconds; (4) record a Decision-needed on the longer-term fix — carrying the pillar id in the OSC payload instead of deriving identity from source IP (contract change touching backend + firmware; needs explicit approval, out of scope here). Note in passing for the implementer: `WiFi.config(ip)` is called without gateway/subnet arguments (`:125`), and the sketch blocks forever in `setup()` if Wi-Fi is absent — verify on the bench whether either needs addressing, but change nothing beyond the ticket scope without asking.
- Allowed files: `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino`, `Arduino/**/secrets.h.example`, `docs/HARDWARE_INTEGRATION.md`, `docs/DECISIONS_NEEDED.md`
- Acceptance criteria: no hardcoded per-device IP in the sketch body; example config documents all four pillar assignments; boot serial output names the pillar; HARDWARE_INTEGRATION.md table present; pillar-IP map in the backend untouched; human bench-verifies one reader end-to-end against the real backend on a hardware day.
- Required tests/checks: human compile/flash + bench verification; agents review only.
- Hardware/Ableton/LED/RFID safety notes: the pillar-IP map is frozen per CODING_GUIDELINES — this ticket documents it, never edits it. hardware-safety-reviewer sign-off.
- Dependencies: WOW-028 (establishes the secrets/config-header pattern in the same files).
- Out of scope: pillar-id-in-payload contract change (Decision-needed); backend changes; the LED sketch.
- Suggested agent(s): creative-tech-integrator, hardware-safety-reviewer (sign-off), documentation-maintainer (HARDWARE_INTEGRATION.md), human (flash + bench)
- Risk: low (config extraction + docs)
- Stop conditions: Bench reveals the `WiFi.config` gateway/subnet gap actually breaks broadcast on the venue AP → stop and report before widening scope.

---

- ID: WOW-031
- Title: Backend clip-name matching uses two different normalizations — trim vs strip-asterisks-and-spaces
- Summary: Queue/playing/metadata comparisons normalize clip names with `.replace(/[* ]/g, '')` while the Ableton clip-slot lookups (`MemoizedClipIndex`, `FindAllClipsInLoop`) match raw Live clip names with `.trim()` only — a Live set clip whose name carries asterisks or internal-space variants can pass one check and fail the other, e.g. dedup says "already queued" for a clip the loop lookup can't find, or a metadata lookup succeeds for a clip that then fails to fire.
- Description: Strip-normalization sites: `backend/adapter/AbletonAdapter.ts:137` (queue dedup), `:198`, `:210`, `:223` (stop/unqueue matching), `:293` (`clipNameToInfoMap` lookup — and the map itself is keyed space-stripped in `backend/util/CsvUtil.ts:31`). Trim-only sites: `AbletonAdapter.ts:98` and `:122` (matching `clip.raw.name` from the Live set). The pervasive `[* ]` stripping strongly suggests real Live set names contain asterisks — meaning the trim-only lookups are the outlier. Fix: one `normalizeClipName()` helper (in `backend/util/` or a service) used at every comparison site, with unit tests; **before changing matching behavior, confirm the actual Live set naming convention with the human** — if Live names never contain asterisks, aligning normalizations is a no-op; if they do, the current trim-only lookups are silently broken today and this fix changes live behavior.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/util/CsvUtil.ts`, `backend/util/` (new helper + test), `backend/**/test/**`
- Acceptance criteria: single normalization helper used at all seven-plus comparison sites; unit tests cover asterisked, spaced, and trimmed name variants; behavior on names without asterisks/odd spacing byte-for-byte unchanged; human confirms the Live naming convention before merge.
- Required tests/checks: `yarn test` (requires WOW-015's backend harness), `yarn lint`.
- Hardware/Ableton/LED/RFID safety notes: changes how clips are located in the Live set — the core musical mapping. audio-ableton-reviewer sign-off mandatory; treat as behavior-affecting even though intended as a consistency fix.
- Dependencies: WOW-015 (backend test harness); human confirmation of Live set naming.
- Out of scope: CSV content changes (WOW-025); frontend name handling (WOW-016 covers its lookup).
- Suggested agent(s): creative-tech-integrator, test-engineer, reviewer, audio-ableton-reviewer (sign-off)
- Risk: medium (musical mapping assumptions)
- Stop conditions: Human cannot confirm the Live naming convention → stop; do not align normalizations on a guess.

---

- ID: WOW-032
- Title: Backend hangs forever on ableton-js remote-script version mismatch — add startup timeout and version-mismatch alerting
- Summary: A version mismatch between the `ableton-js` npm package (3.1.5) and the AbletonJS remote script installed in Live (was 3.7.0) changes the UDP framing, so `ableton.start()` blocks at "Checking connection..." forever with no error, no timeout, and no hint of the cause. Cost a full evening of live debugging 2026-07-10; at the venue it would read as "installation dead, no logs".
- Description: Three complementary fixes, all in backend startup. (1) **Connection timeout:** `backend/adapter/AbletonAdapter.ts:49` calls `await ableton.start()` bare; the library supports `start(timeoutMs)` and rejects with "Connection timed out." Pass a timeout (~30–60s, `.env`-overridable), catch the rejection, log an actionable error-level message listing the three known causes (Live not running; AbletonJS control surface not enabled in Preferences → Link/Tempo/MIDI; remote-script/npm version mismatch — remediation: copy `backend/node_modules/ableton-js/midi-script/` into Live's Remote Scripts folder as `AbletonJS` and restart Live), then exit non-zero. (2) **Pre-flight version cross-check, before `ableton.start()`:** the npm package ships its matching script version at `node_modules/ableton-js/midi-script/version.py`; the installed script lives at `~/Music/Ableton/User Library/Remote Scripts/AbletonJS/version.py` (path `.env`-overridable — the script can also be installed inside the Live app bundle). Read both, compare, and log a loud warning naming both versions on mismatch. Must be warn-and-continue: a missing file at the expected path is an info-level note, never fatal (the heuristic must not block a working setup). (3) **Post-connect exact-version log:** after a successful `start()`, call the remote script's version endpoint (`internal.get('version')`) and log both versions at info level on every startup, warning on any inequality — the library's built-in check only warns when the plugin is _older_ than the JS library and never runs at all when the handshake itself is incompatible, which is exactly the observed failure.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/index.ts`, `.env` (new optional vars — approval required per conventions), `backend/adapter/test/**` or `backend/util/test/**` (pre-flight check is pure file-reading logic — testable if WOW-015's harness exists), `README.md` (troubleshooting note)
- Acceptance criteria: with no Ableton running, `yarn start-backend` exits within the timeout with the actionable error instead of hanging; with a deliberately wrong `version.py` planted at the checked path, startup logs a mismatch warning naming both versions before connecting; healthy startup logs both versions at info; connected happy-path behavior byte-for-byte unchanged; missing script path does not block startup.
- Required tests/checks: unit test for the version-file parse/compare (pure function); `yarn lint`; `yarn test`; manual verification of the timeout path (no Ableton needed — that is the scenario).
- Hardware/Ableton/LED/RFID safety notes: startup/shutdown path (hardware-safety-reviewer per AGENTS.md scope) — but strictly additive diagnostics: no change to Ableton commands, event names, payloads, or timing once connected. Exit-on-timeout interacts with crash-restart supervision — coordinate with WOW-014's Decision-needed entry (a supervisor restarting a misconfigured backend would loop; the log message is what makes the loop diagnosable).
- Dependencies: none hard; coordinate with WOW-014 (same file, process-exit semantics) and WOW-015 (test harness for the pure parse/compare).
- Out of scope: upgrading the `ableton-js` npm package (belongs to WOW-009 dependency audit); auto-installing or auto-copying the remote script (mutating files outside the repo is a human action); protocol-level version negotiation.
- Suggested agent(s): creative-tech-integrator (build), reviewer, hardware-safety-reviewer (sign-off)
- Risk: low (additive diagnostics on the startup path)
- Stop conditions: `.env` addition not approved → land the timeout with a hardcoded default and skip the overrides. If the timeout's exit-on-failure conflicts with a supervision decision from WOW-014 → align there before merging.

---

- ID: WOW-033
- Title: Idle timeout drops the pitch reset for clips that were actively playing (only queued clips are covered by WOW-018)
- Summary: `handleTimeout` stops all four tracks via `stop_all_clips` without ever populating `stoppingClips[pillar]` for the clip that was playing on that pillar. The `playing_slot_index` listener's stop-branch only resets a stopped clip's `pitch_coarse` back to 0 when `stoppingClips[pillar]` is set, so a key-locked/transposed clip that was actively playing at the moment of the 3-minute idle timeout gets stopped but is left transposed in the live Ableton set — silently, until that same clip happens to be queued/played again (`transposeClipToNewKey`'s transpose branch does an absolute `clip.set('pitch_coarse', X)`, so it self-heals on next use, but not before).
- Description: Contrast `handleTimeout` (`backend/adapter/AbletonAdapter.ts:54-59` on current `main`) with `stopOrRemoveClipFromQueue` (`:192-247`), which sets `stoppingClips[pillar] = playingClip` (`:201`) before its own `stop_all_clips` call (`:207`). The `playing_slot_index` listener's stop-branch (`:337-355`, inside `getTracksAndClips`) reads `clipInfo = stoppingClips[pillar]` and only calls `transposeClipToNewKey({ ...clipInfo, clip }, '')` to reset pitch when `clipInfo?.clipName && keyLockEnabled` (`:346`) — both false when `stoppingClips[pillar]` was never populated. WOW-018 (PR #22, open at ticket time) extends `handleTimeout` with a pitch-reset loop for _queued_ clips being dropped at timeout, mirroring `stopOrRemoveClipFromQueue`'s queued-removal branch — but that PR's own audio-ableton-reviewer sign-off explicitly notes this _playing_-clip gap as adjacent and out of scope, filing it as this follow-up. Fix: in `handleTimeout`, before (or alongside) the `stop_all_clips` calls, set `stoppingClips[pillar] = playingClips[pillar]` for each pillar with a playing clip, mirroring `stopOrRemoveClipFromQueue`'s existing pattern, so the listener's stop-branch receives a populated `clipInfo` and performs the same pitch reset it already performs for every other stop path. Land on top of WOW-018 (same function) rather than against current `main`.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `sim/core/simulator.ts` + `sim/test/simulator.test.ts` (only if the sim turns out to model an equivalent playing-clip pitch/transpose state — WOW-018's sign-off notes the sim does not model `pitch_coarse` at all, so this is likely backend-only; verify before touching)
- Acceptance criteria: after an idle timeout, every pillar that had a key-locked/transposed clip actively playing has its `pitch_coarse` reset to 0, matching the pattern WOW-018 established for queued clips; pillars with no playing clip are untouched; `stoppingClips[pillar]` is left consistent with the existing stop-branch's `stoppingClips[pillar] = null` (`:353`) so no stale entries leak into the next stop/timeout cycle; zero change to `stop_all_clips` call ordering, timing, or any other timeout behavior.
- Required tests/checks: `yarn test`, `yarn lint`; if a backend test harness exists (WOW-015) add a unit/integration case for "playing + key-locked clip, idle timeout fires, pitch reset occurs"; manual sim/UI smoke per the human-verifiable demo requirement.
- Hardware/Ableton/LED/RFID safety notes: touches transposition/timeout musical behavior directly — **audio-ableton-reviewer sign-off required** per AGENTS.md. Scope is strictly "populate `stoppingClips` before the existing stop path fires" — do not change transposition tables, quantization, or trigger-order logic.
- Dependencies: WOW-018 (PR #22) — land only after it merges; same function, to avoid merge conflicts and rebase churn.
- Out of scope: changing timeout duration or `stop_all_clips` semantics; the queued-clip pitch reset (already covered by WOW-018); any sim-side `pitch_coarse` modeling beyond what WOW-018 already scoped out.
- Suggested agent(s): creative-tech-integrator, reviewer, audio-ableton-reviewer (sign-off)
- Risk: low (small, additive, mirrors an existing pattern in the same file) — mandatory sign-off regardless, since it changes live musical/transposition state.
- Stop conditions: If populating `stoppingClips[pillar] = playingClips[pillar]` in `handleTimeout` is found to interact unexpectedly with phrase-leader promotion or other state read elsewhere during timeout → stop and ask.

---

- ID: WOW-034
- Title: Crash-exit handlers don't silence Ableton — add bounded best-effort `stop_all_clips` before `process.exit`
- Summary: WOW-014's `unhandledRejection`/`uncaughtException` handlers (`backend/index.ts`) log then `process.exit(1)`, but neither they nor any prior code path ever tells Ableton to stop — a backend crash leaves whatever is playing/looping on each pillar audible indefinitely until a human notices and restarts the process. This gap is identical on `main` (any unhandled rejection there already kills the process the same way); WOW-014 did not introduce or worsen it. Flagged as a non-blocking, ticket-worthy follow-up by the WOW-014 hardware-safety-reviewer sign-off (`docs/agent-notes/wow-014-hardware-safety-reviewer-signoff.md`, section 2), which explicitly recommended a bounded (1–2s) attempt rather than an unbounded one, since an unbounded await inside a crash handler could itself hang the exit.
- Description: Add a bounded (~1.5s), best-effort attempt to stop all 4 pillar tracks inside both process-level handlers before they call `process.exit(1)`, never delaying the exit beyond that bound. Concretely: a new `AbletonAdapter` function that (a) guards against `tracks` being unpopulated (crash before/during startup — same class of gap WOW-032 is separately hardening on the startup path), (b) fires `stop_all_clips` on all 4 tracks in parallel — not `handleTimeout`'s sequential loop, which would burn up to 4× `ableton-js`'s own ~2000ms per-command timeout and blow the bound, (c) catches every individual command's rejection so the aggregate attempt never itself rejects, wrapped in its own try/catch. `backend/index.ts`'s two handlers race that attempt against a short timer and call `process.exit(1)` once either settles, guarded against re-entrancy if a second crash fires mid-shutdown.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/index.ts`, `docs/DECISIONS_NEEDED.md`
- Acceptance criteria: a crash after Ableton has connected attempts `stop_all_clips` on all 4 tracks before the process exits; total added delay to `process.exit(1)` is bounded (~1.5s) regardless of Ableton's responsiveness; a crash before `tracks` is populated exits with no added delay (no throw, no hang); no existing call site, argument, or ordering on any non-crash path changes (`handleTimeout` and the idle-timeout path are untouched); `docs/DECISIONS_NEEDED.md`'s WOW-014 crash-restart-supervision entry is amended to note that audio-silencing during the down-window is now handled here, distinct from restart speed (still open).
- Required tests/checks: reviewer verification of the guard/timeout logic (no backend test harness exists yet — WOW-015 is still pending, so this follows WOW-014's precedent of static verification + human real-hardware demo steps); `tsc --noEmit -p backend/tsconfig.json`; `yarn lint`; `yarn test`.
- Hardware/Ableton/LED/RFID safety notes: sends a real (if best-effort) live command — `stop_all_clips` — from inside a crash handler; this is an existing, unchanged command (the same one `handleTimeout` already sends on every idle timeout) invoked from a new call site, not a new command or new argument. Requires audio-ableton-reviewer + hardware-safety-reviewer sign-off. Never run `yarn start-backend`.
- Dependencies: builds on WOW-014 (same file, same handlers). Related to WOW-032 (startup-timeout exit path is a distinct, not-yet-connected case — the guard here must not fire spuriously there) but does not block on it.
- Out of scope: crash-restart supervision speed (the existing open Decision-needed entry); changing `handleTimeout`, the idle-timeout path, or any non-crash call site; retry logic beyond the single bounded attempt.
- Suggested agent(s): creative-tech-integrator (build), reviewer, audio-ableton-reviewer + hardware-safety-reviewer (sign-off)
- Risk: medium (touches the crash-exit path added by WOW-014 and issues a live command from within it — bounded and guarded, but a new runtime behavior on an already-safety-sensitive path)
- Stop conditions: if bounding the timeout turns out to be unsafe or infeasible (e.g., `ableton-js` internals make a clean bounded race impossible) → stop and write a Decision-needed entry instead of forcing a fix.

---

- ID: WOW-035
- Title: Guard `useAbletonContextProviderState`'s subscription effect on socket shape, not `.connected` (WOW-019/WOW-024 follow-up)
- Summary: Same class of bug a Copilot review caught on WOW-024's PR #24: gating listener attachment on `if (!socket.connected) return;` conflates "still the unconnected placeholder" with "a real socket that's momentarily disconnected." WOW-024 fixed this in `DebugModalContainer.tsx`'s connection-tracking effect; the identical guard exists in `useAbletonContextProviderState.ts`'s subscription effect (the one WOW-019 extends with a persistent `'connect'` listener for reconnect-resync) and was explicitly flagged there as an unfixed follow-up rather than bundled into that PR.
- Description: On `feat/wow-019-frontend-reconnect-resync` (after WOW-019 adds `socket.on('connect', getTracksAndClips)` inside the same guarded block), the subscription effect still opens with `if (!socket.connected) return;`. If this effect ever ran while an already-real socket object was momentarily disconnected (e.g. mid-reconnect), none of its listeners — including WOW-019's `'connect'` re-fetch listener — would attach, and since the socket's object reference never changes again on a live reconnect, the hook would be permanently stuck without a working resync path even after the socket actually reconnects. Very likely unreachable today (this hook and `DebugModalContainer` both mount once, at provider-tree mount, always starting from the true placeholder), but it's the same class of fragile correctness issue WOW-024 fixed defensively. Fix: change the guard to `typeof socket.on !== 'function' || typeof socket.off !== 'function'`, matching WOW-024's fix (`src/container/DebugModalContainer.tsx`, commit `a3482b6`) exactly — guard-only, no change to what fires once connected. Extend `src/context/hook/test/useAbletonContextProviderState.test.tsx` (WOW-019's suite) with the analogous "connect transition" case: a real-but-not-yet-connected socket (`createFakeSocket(false)`) still gets its listeners attached on mount, and a live `'connect'` correctly triggers the resync fetch.
- Allowed files: `src/context/hook/useAbletonContextProviderState.ts`, `src/context/hook/test/useAbletonContextProviderState.test.tsx`
- Acceptance criteria: guard checks for `on`/`off` function presence, not `.connected`; a mocked real-but-disconnected socket gets every listener (including `'connect'`) attached on mount; firing `'connect'` on that socket triggers `getTracksAndClips` the same way the existing reconnect test verifies; all pre-existing WOW-019 tests in the file still pass unchanged; no event contract changes.
- Required tests/checks: `yarn test` (extended hook tests), `yarn lint`.
- Hardware/Ableton/LED/RFID safety notes: UI-only; no new emissions and no change to what's emitted once connected — purely widens _when_ the existing listeners attach.
- Dependencies: branches from `feat/wow-019-frontend-reconnect-resync` (PR #23, open) — the `'connect'` listener and this file's test coverage this ticket extends only exist on that branch, not on `main`. PR targets `feat/wow-019-frontend-reconnect-resync`, mirroring how WOW-024's PR #24 targets its own prerequisite branch rather than main.
- Out of scope: `DebugModalContainer.tsx` (already fixed, WOW-024); restructuring when `getTracksAndClips()` fires relative to connection state (out of scope — same minimal guard-only fix WOW-024 applied, not a redesign).
- Suggested agent(s): frontend-implementer, test-engineer, reviewer
- Risk: low (mirrors an already-reviewed, already-shipped fix pattern; two-file diff; theoretical/defensive, not an observed active bug)
- Stop conditions: none anticipated — fully specified by the WOW-024 precedent.

---

- ID: WOW-036
- Title: Normalize the two remaining raw clip-name comparisons in the `playing_slot_index` listener (WOW-031 fast-follow)
- Summary: WOW-031 (PR #29) routed every backend clip-name comparison through `ClipNameUtil.normalizeClipName` except two sites inside the `playing_slot_index` listener, which still compare raw Live names: `backend/adapter/AbletonAdapter.ts:490` (de-transpose decision) and `:514` (`clip_playing` vs `clip_started` decision) — line numbers at `main` @ `f362b1d`; the re-sign-off note and the `ABLETON_INTEGRATION.md` paragraph cite the same two sites as `:468`/`:492` in their pinned pre-merge numbering. Both sides of both comparisons are raw Live names of _different slots_ (`clip.raw.name` of the slot that just fired vs `playingClips[pillar]` captured from an earlier event), so if consecutive slots of one loop block carry differing decoration (e.g. `Verse`, `Verse *`), a slot advance takes the new-clip path: `:490` de-transposes the still-playing block to pitch 0 (audible key clash under key lock — nothing re-transposes it, since transposition happens in `queueClip`), and `:514` emits `clip_started` instead of `clip_playing` (idle-timeout reset + track-volume reset to 0.6).
- Description: Goal: make the listener's same-clip detection consistent with the WOW-031 normalization contract, so intra-block decoration variance cannot de-transpose a playing block or misreport a slot advance as a new clip. Why now (record of the unblocking decision) — human decision 2026-07-14, answering the re-sign-off's finding 2: samples are generated and named by hand; identical decoration (spaces/asterisks/whitespace) across one clip's loop-block slots is intended but **NOT guaranteed** (human error is possible), so the backend must not assume it. The decision is recorded in `docs/ABLETON_INTEGRATION.md` ("Clip-name matching and naming rules", 2026-07-14 paragraph, added by PR #47); the full failure analysis is `docs/agent-notes/wow-031-audio-ableton-reviewer-resignoff.md` finding 2. Fix: route both comparisons through `ClipNameUtil.normalizeClipName` (`backend/util/ClipNameUtil.ts`) on **both** sides, exactly like every other comparison site, following the existing undefined-guard pattern from `stopOrRemoveClipFromQueue` (`AbletonAdapter.ts:353-355`, `:388-390`) so the helper never receives `undefined`. This is the strictly-narrowing direction: raw-equality implies normalized-equality, so the new-clip path can only fire less often, never more — uniformly-decorated Live sets behave byte-for-byte the same. The genuinely-new-song case (the scenario in the `:491-492` comment) keeps working because naming rule 1 in `ABLETON_INTEGRATION.md` (distinct clips must differ by more than decoration) is already a hard Live-set rule. Deliberate non-goal, from the same review: the listener's third raw comparison, `:536` (`newPhraseLeader?.clipName === clipName`; `:514` in the review's numbering), was explicitly reviewed and is an identity check on same-provenance strings — **fine as-is, do not touch**. Same-PR docs update (AGENTS.md guardrail 6): amend the 2026-07-14 paragraph in `docs/ABLETON_INTEGRATION.md` — replace the interim caveat "until it lands, treat identical decoration within a block as a Live-set requirement and double-check it when adding samples" with a note that the listener now normalizes these comparisons too; the two block-naming hard rules above that paragraph stay (they are matching-contract consequences, not this bug).
- Context files: `docs/agent-notes/wow-031-audio-ableton-reviewer-resignoff.md` (finding 2 — the analysis; finding 5 — the adapter test-seam situation), `docs/ABLETON_INTEGRATION.md` ("Clip-name matching and naming rules" section as of PR #47), `backend/util/ClipNameUtil.ts`, `backend/adapter/AbletonAdapter.ts` (the `playing_slot_index` listener inside `getTracksAndClips`), the WOW-031 entry above.
- Allowed files: `backend/adapter/AbletonAdapter.ts` (the two comparison sites only), `backend/adapter/test/**`, `docs/ABLETON_INTEGRATION.md` (the one-paragraph amendment only)
- Disallowed files: `backend/util/ClipNameUtil.ts` (the helper is final per the re-sign-off addendum at `53960ee`); `sim/**` (the sim's equivalent playing/queued checks already normalize both sides — `sim/core/simulator.ts:311` — and its `[*\s]` alignment belongs to PR #47); `src/assets/Music Database.csv`; `backend/service/KeyTranspositionService.ts`; everything else.
- Acceptance criteria: both comparison sites (`:490` and `:514` at `f362b1d`) compare via `ClipNameUtil.normalizeClipName` on both sides; a decoration-only mismatch between consecutive slots of one loop block now takes the same-clip path — no de-transpose of the playing block, `clip_playing` emitted (no idle-timeout reset, no volume write) instead of `clip_started`; behavior for uniformly-decorated names is byte-for-byte unchanged (raw-equal ⇒ normalized-equal); `normalizeClipName` is never called with `undefined`; `:536`'s phrase-leader identity check is untouched; no event names, payload shapes, command ordering, or timing changes; the `ABLETON_INTEGRATION.md` interim caveat is replaced in the same PR.
- Required tests/checks: `yarn test`, `yarn lint`, `tsc --noEmit -p backend/tsconfig.json`. The listener is an inline closure with no test seam (re-sign-off finding 5 — same situation WOW-021/WOW-031 faced), so the accepted floor is the existing `ClipNameUtil` unit tests plus reviewer hand-trace of both sites; preferred, if it stays a small diff: extract the same-clip decision as an exported pure predicate on the adapter namespace (the `calculateBpmFromWarpMarkers`/`parseRemoteScriptVersion` pattern) and unit-test it in `backend/adapter/test/AbletonAdapter.test.ts` with decorated-variant cases — do not restructure the listener beyond that just to create a seam.
- Hardware/Ableton/LED/RFID safety notes: changes when de-transposition fires and which of `clip_started`/`clip_playing` is emitted (idle-timeout and volume side effects) — a live musical/timing surface. **audio-ableton-reviewer sign-off mandatory.** No new commands or events; the change strictly narrows the new-clip path to genuinely-different normalized names. Never run `yarn start-backend`.
- Dependencies: WOW-031 (PR #29, merged). Docs PR #47 (open) — the `ABLETON_INTEGRATION.md` paragraph this ticket amends exists only on that branch; land this after #47 merges.
- Out of scope: `:536` (reviewed fine as-is); the two Live-set naming hard rules (decoration-distinct clips, contiguous blocks — they remain set requirements per finding 3); frontend changes (the more-truthful `clip_playing` stream needs no handler change); sim changes; any `ClipNameUtil` change.
- Suggested agent(s): creative-tech-integrator, reviewer, audio-ableton-reviewer (sign-off)
- Risk: low (two-comparison diff in the already-reviewed WOW-031 direction; strictly-narrowing matching semantics) — mandatory sign-off regardless, since it changes live transposition and event-emission behavior.
- Stop conditions: normalizing either site turns out to interact with `stoppingClips`/phrase-leader bookkeeping beyond finding 2's analysis → stop and ask. PR #47 has not merged when work starts (the paragraph to amend won't exist on `main`) → stop and coordinate rather than duplicating the docs text.
