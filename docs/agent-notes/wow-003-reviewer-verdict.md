# WOW-003 — reviewer verdict: offline simulator

Date: 2026-07-10
Ticket: WOW-003 — Build offline simulator (mock backend) — ADR-001
Branch: `feat/wow-003-offline-simulator`, reviewed head `0ed5360bf1450fe02e4480c199757b08c700a4c3` (PR #3, fork `Amsvartner/witches-of-wubb-v2`, base `main`)
Prompt: `docs/agent-prompts/wow-003-reviewer-prompts.md`, Prompt 1
Reviewer: Claude Fable 5 (reviewer role, read-only)

## Checklist results

1. **Safety (blocking) — pass.** Every `sim/**` import verified by reading: `sim/core/*` imports only relative modules; `sim/server.ts` imports `fs`, `http`, `path`, `socket.io`, and `./core` (`sim/server.ts:10-21`). Zero import paths to `ableton-js`, `node-osc`, or `backend/`; no OSC/MIDI/serial/outbound-network capability anywhere in the diff. The only network surface is a listening socket bound to `127.0.0.1:3335` (`sim/server.ts:74`) — the preferred localhost-only default, so no bind finding. Structurally enforced by `spec/sim/import-guard.spec.ts` (fails the suite on any future forbidden import). `git diff main...HEAD --stat` shows `backend/`, `Arduino/`, and `src/assets/Music Database.csv` untouched; the CSV is consumed read-only (`fs.readFileSync`, `sim/server.ts:30`). No credentials in the diff.
2. **ADR-001 structure — pass.** All logic in `sim/core/` with zero socket.io imports (guarded by test); `sim/server.ts` is pure transport glue (socket registration + logging, no state or contract logic); port 3335 matches `.env` `VITE_WS_SERVER_PORT`; all 5 vitest suites in `spec/sim/` import `sim/core` directly with no socket transport.
3. **Contract fidelity — pass, documented deltas = none.** Verified event by event against `backend/events/incoming-events.ts`, `backend/events/outgoing-events.ts`, `backend/ableton-api.ts`, `backend/types.ts`, and `backend/utils/parse-csv.ts` / `get-clip-from-rfid.ts`. Highlights checked line-by-line:
   - Ack vs no-ack exactly mirrors `AddSocketEventsHandlers`: `set_track_volume` (`incoming-events.ts:164`) and `set_master-key` (`:177`) are fire-and-forget in `sim/server.ts:135-142`; all eight ack-style handlers ack the same shapes.
   - `get_playing_clips`/`get_queued_clips` return `BrowserClipInfoList` of length 4 with `null` slots and the exact 7-field projection (`sim/core/simulator.ts:335-343` ≡ `incoming-events.ts:110-147`).
   - `TagDetectionData` `{rfid, pillar}`; `ingredient_detected` carries metadata + `rfid`/`pillar`/`requestAddress` (`simulator.ts:188-193` ≡ `incoming-events.ts:75`); `ingredient_removed` correctly omits `rfid` (`simulator.ts:214-218` ≡ `:93`); unknown rfid → warn, no event (≡ `:77-78`).
   - `timeout_warning` is bare, fires at T−30s of the 3-minute idle window only while clips play and nothing is stopping; timeout clears the master key **silently** (no `master-key_changed`), matching `handleTimeout`/`startTimeoutTimer` (`ableton-api.ts:49-83`).
   - Timeout-reset semantics mirror `EmitEvent` vs `EmitEventWithoutResetingTimout` (`outgoing-events.ts:34-41`): `clip_playing`, `clip_stopped`, `timeout_warning` don't reset; everything else does (`simulator.ts:128-132` + per-emit flags).
   - Silence/key-adoption semantics (double `master-key_changed` on first clip from silence — once at queue time per `ableton-api.ts:160-163`, once at clip start per `:336-340`), `clip_started`+`volume_changed(0.6)` vs `clip_playing` branch (`:330-334`), `clip_queued`/`clip_unqueued`/`clip_stopping`/`clip_stopped` payloads incl. `clip: undefined` stripping, bare `clip_stopped {pillar}` fallback (`:253-259`) — all match.
   - Enrichment correctly absent: `EnrichRecommendations` is commented out in the real backend (`get-clip-from-rfid.ts:21-23`), so no `recommendedClips` — mirrored.
   - Timing approximations (synchronous triggering, fixed `phraseLengthMs` vs phrase-leader loop end, CSV BPM vs warp markers, sim-only tempo/volume defaults) change no names/shapes/order and are documented in the handoff note and code headers. The handoff contract-fidelity table held up under my independent reading.
4. **Scope — pass.** No `src/**` changes; only new dependency is the `socket.io@^4.6.0` devDependency, explicitly human pre-approved (DECISIONS_NEEDED "Resolved" 2026-07-10, ticket Dependencies line, commit `ae65cc0`); `yarn.lock` additions are exclusively the socket.io/engine.io tree. No new/renamed events. `package.json` touched only for the `sim` script + the approved devDependency. No drive-by refactors; prompt-file run records are pipeline-standard.
5. **One object per pillar — pass.** `handleNewTag` → `queueClip` replaces the pillar slot; `replace-ingredient` scenario demonstrates it; covered by tests ("replaces the object on an occupied pillar").
6. **Scenarios & logging — pass.** `buildScenarios`/`pickScenarioIngredients` select real CSV rows only (throws if a type is missing — no invented metadata); every emitted event is logged in `Simulator.emit` (`simulator.ts:130`) and every received socket event via `logReceived` in `sim/server.ts`; scenario steps logged with descriptions.
7. **Tests & checks — pass.** Run by me at `0ed5360`: `yarn lint` clean (pre-existing React-version warning only), `yarn test` 48/48 green (6 files), `yarn build` green, `git diff --check` clean. Coverage matches the test-engineer note's map (48 tests incl. its 8 additions); no test opens a socket — all suites drive `sim/core` in-process with fake timers.
8. **Docs & PR hygiene — pass.** README sim section documents `yarn sim [scenario]`, all four scenarios, env overrides, and the demo; handoff notes complete with human-verifiable demo requiring no hardware; PR #3 fills every template section, targets the fork base `main`; Copilot round complete (5 findings fixed at `e59a13f`, round 2 clean, threads resolved); test-engineer verdict approve at `0ed5360`.

**Specialist reviews:** none required. The ticket's suggested agents are creative-tech-integrator / test-engineer / reviewer only; the diff has no path to volume, lights, OSC/MIDI/Art-Net emission, or mappings — all "volume"/"tempo" values are fake in-memory state behind an import-graph guard, and the CSV/pillar-IP mapping is mirrored read-only, not edited.

## Findings

### Blocking

None.

### Should-fix

1. **Undocumented behavioral branch: missing-clip → `clip_unqueued`.** `sim/core/simulator.ts:226` (`queueClip`) — the real backend emits `clip_unqueued` when a CSV row's clip can't be found in the live Ableton set (`backend/ableton-api.ts:185-191`); the simulator assumes every CSV clip exists and proceeds to queue/start it. This is inherently unmodelable offline (only the live set knows its clips), but it is a browser-observable difference on CSV/set drift and it is absent from both the handoff note's approximations list and the simulator's header comment. Fix is docs-only: add one line to the "Known approximations" header in `simulator.ts` and/or the handoff note's assumptions section so the delta ledger stays complete. Does not change names/shapes/acks, so I am not treating it as the blocking "undocumented delta" class, which targets contract-shape drift.

### Nits

1. `sim/server.ts:72` — `cors: { origin: true }` reflects any origin. Harmless given the `127.0.0.1` bind, but narrowing to the vite dev origin (or documenting why not) would be tighter.
2. `package.json:14` — `yarn sim` invokes the `vite-node` binary, which is only a transitive dependency of vitest; a future vitest major could drop it and silently break the script. Deliberate (avoids another dependency approval) and documented in the PR body — acceptable, just noting the fragility.
3. `sim/core/csv.ts` — does not replicate the backend's `transformHeader: (header) => header.replace(':', '')` (`backend/utils/get-clip-from-rfid.ts:17`). No current header contains a colon, so behavior is identical today, but a future header rename with a colon would silently diverge between sim and backend parsing. A one-line comment would preserve the knowledge.
4. PR #3 body, Validation section — "`yarn test` green (38 tests…)" is stale; the suite is 48 after the test-engineer pass (the Pipeline-status section already says 48). Update at the gate.

## Verdict

**approve-with-nits** — no blocking findings; the one should-fix is a documentation-only addition to the approximation ledger. Required follow-up reviewers: none (see specialist-review rationale above). Acceptance criteria all verified: simulator drives the UI end-to-frontend per the implementer's executed demo (structure and round-trip handlers verified by reading; not re-run live in this pass), all events logged, zero ableton-js/node-osc imports (read + test-enforced), `sim/core` socket.io-free and exercised directly by vitest, contract documented deltas = none.

## Validations run

- `yarn lint` — clean (pre-existing React-version warning only)
- `yarn test` — 48/48 green, 6 files, no sockets, fake timers
- `yarn build` — green
- `git diff --check` — clean
- `yarn start-backend` — never run; no hardware, no network beyond reading local files

## Re-review @ 7765add

Date: 2026-07-10. Fix round reviewed at head `7765add831e8935d1c671a8902d5fe5c80ef753e` (commit "fix: address reviewer findings — document missing-clip approximation, localhost CORS, header colon-strip parity (WOW-003)"). The commit touches only `sim/core/simulator.ts`, `sim/core/csv.ts`, `sim/server.ts`, and the handoff note — no scope creep, no contract-shape changes, import graph unchanged (still no `ableton-js`/`node-osc`/`backend/` anywhere in `sim/**`; core still socket.io-free, guard suite still green).

Finding-by-finding disposition:

| Finding                                                           | Resolution                                                                                                                                                                                                                                                                                                                                                                                                               | Verified                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Should-fix 1 — missing-clip → `clip_unqueued` branch undocumented | **Fixed (docs).** Added to the "Known approximations" header in `sim/core/simulator.ts:15-18` and to the handoff note's assumptions list (`docs/agent-notes/wow-003-creative-tech-integrator-simulator.md`), both citing `backend/ableton-api.ts:185-191` and noting shapes/acks unaffected. Approximation ledger now complete.                                                                                          | yes                        |
| Nit 1 — `cors: { origin: true }`                                  | **Fixed.** `sim/server.ts:74` now restricts CORS to a localhost-origin regex (`/^https?:\/\/(localhost\|127\.0\.0\.1)(:\d+)?$/`) with a comment noting the real backend allows any origin (sim-only tightening, not a contract behavior). Combined with the `127.0.0.1` bind, the network surface is now localhost-only at both layers. Live re-verification (UI reconnect + full-spell scenario) done after the change. | yes                        |
| Nit 2 — `yarn sim` relies on transitive `vite-node`               | **Rationalized, not fixed.** Adding `vite-node` as an explicit devDependency would itself require human dependency approval (AGENTS.md); the script uses only what vitest already installs and the choice is documented. Acceptable residual — revisit if a vitest upgrade drops the binary.                                                                                                                             | accepted                   |
| Nit 3 — missing `transformHeader` colon-strip parity              | **Fixed.** `sim/core/csv.ts:55-58` now strips the first `:` from each header name, mirroring `backend/utils/get-clip-from-rfid.ts:17`, with a comment explaining it is parity-keeping (current headers contain no colons — behavior identical today).                                                                                                                                                                    | yes                        |
| Nit 4 — stale "38 tests" in PR body                               | **Being fixed outside the repo** (PR body edit, not a repo file). Gate should confirm the PR body reads 48.                                                                                                                                                                                                                                                                                                              | pending at gate (non-repo) |

Re-validation at `7765add`: `yarn lint` clean (pre-existing React-version warning only), `yarn test` 48/48 green, `yarn build` green, `git diff --check` clean. `yarn start-backend` never run.

### Final verdict @ 7765add

**approve** — the one should-fix and two of the code nits are fixed as suggested; the `vite-node` nit is rationalized consistently with the repo's own dependency-approval rule; the PR-body count is a non-repo cosmetic pending at the gate. No blocking findings, no required specialist reviewers (rationale unchanged from the original pass). Acceptance criteria stand as verified above.
