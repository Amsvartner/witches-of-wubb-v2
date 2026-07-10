# WOW-003 — test-engineer note: simulator core test review + extension

Date: 2026-07-10
Ticket: WOW-003 — Build offline simulator (mock backend) — ADR-001
Branch: `feat/wow-003-offline-simulator` (reviewed at head `e59a13f`)
Prompt: `docs/agent-prompts/wow-003-test-engineer-prompts.md`, Prompt 1

## Scope of this pass

Reviewed the implementer's `spec/sim/` suites against the prompt's minimum-coverage list and the observed backend contract (`backend/events/incoming-events.ts`, `backend/ableton-api.ts`, `backend/types.ts`), then extended `spec/sim/simulator.spec.ts` where real gaps existed. No `sim/**` production code was touched. No relocation of existing tests.

## Coverage map (behavior → test)

All tests import `sim/core` directly — no socket transport, no network, fake timers for anything time-driven.

| Behavior (contract source)                                                                                                                           | Test                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Initial state: 4 pillars, all `null`; defaults for tempo/volumes/keylock/master key                                                                  | `simulator.spec.ts` › initial state (2 tests)                               |
| Tempo get/set round-trip + `tempo_changed`                                                                                                           | › settings round-trips                                                      |
| Per-pillar volume get/set + `volume_changed` (no ack, fire-and-forget)                                                                               | › settings round-trips                                                      |
| Keylock get/set round-trip, no event emitted (`incoming-events.ts:170`)                                                                              | › settings round-trips                                                      |
| Master-key get/set + `master-key_changed` (no ack)                                                                                                   | › settings round-trips                                                      |
| `/new/tag` known rfid → `ingredient_detected` payload (metadata + `rfid`, `pillar`, `requestAddress`) + pillar occupied (`incoming-events.ts:68-83`) | › /new/tag › emits the backend event sequence…; › exposes the playing clip… |
| Unknown rfid → warn, no event, no crash (`incoming-events.ts:77-78`)                                                                                 | › ignores unknown RFIDs…                                                    |
| Out-of-range pillar index guard (sim hardening; unreachable in real backend)                                                                         | › ignores out-of-range pillar indices…                                      |
| Queue-while-playing → `clip_queued`, trigger at phrase boundary                                                                                      | › queues a second clip…                                                     |
| One-object-per-pillar replacement                                                                                                                    | › replaces the object on an occupied pillar…                                |
| `/departed/tag` → `ingredient_removed` (**no `rfid`**, `incoming-events.ts:93`) + `clip_stopping`/`clip_stopped`, pillar cleared                     | › /departed/tag › stops a playing clip…                                     |
| Departed queued clip → `clip_unqueued`                                                                                                               | › removes a queued clip…                                                    |
| Departed with nothing playing/queued → bare `clip_stopped {pillar}` (`ableton-api.ts:253-259`)                                                       | › emits a bare clip_stopped…                                                |
| Last playing clip stops with queue populated → immediate trigger (`ableton-api.ts:223-232`)                                                          | › triggers queued clips immediately…                                        |
| `get_playing_clips` ack: length 4, `null` empties, exact 7-field subset, no `clip` (`incoming-events.ts:110-128`)                                    | › exposes the playing clip through get_playing_clips…                       |
| `get_queued_clips` ack: same exact projection (`incoming-events.ts:129-147`)                                                                         | **NEW** › clip lifecycle details › exposes the queued clip…                 |
| Duplicate-queue early return (`ableton-api.ts:150-153`)                                                                                              | **NEW** › does not emit a second clip_queued…                               |
| Same-clip restart → `clip_playing`, not `clip_started`, no volume reset (`ableton-api.ts:330-331`)                                                   | **NEW** › re-triggering the clip already playing…                           |
| `clip_stopping`/`clip_stopped` payload shape: metadata + `pillar`, no live `clip` object (`ableton-api.ts:216-219, 352-356`)                         | **NEW** › clip_stopping and clip_stopped carry…                             |
| Tempo/key adopted only from silence (`ableton-api.ts:336-340`)                                                                                       | **NEW** › does not re-adopt tempo or key…                                   |
| Master key kept when different-key clip joins (`ableton-api.ts:160-163`)                                                                             | **NEW** › Simulator key adoption › keeps the first clip's master key…       |
| Keyless clip from silence → master key stays empty, tempo still adopted                                                                              | **NEW** › starting from silence with a keyless clip…                        |
| Empty master key mid-playback → adopted at queue time, before phrase boundary (`ableton-api.ts:160-163`)                                             | **NEW** › adopts a queued clip's key immediately…                           |
| `timeout_warning` at T−30s, clips stopped at T=3min, master key cleared silently (`ableton-api.ts:49-83`)                                            | › idle timeout (2 tests)                                                    |
| Timeout inert while nothing plays; reset by activity (`EmitEvent` semantics)                                                                         | › idle timeout (2 tests)                                                    |
| Misconfigured warning ≥ timeout falls back to real defaults (sim hardening)                                                                          | › idle timeout › falls back to the real defaults…                           |
| Scenario engine: deterministic scheduling, `stop()`, looping (fake timers)                                                                           | `scenario.spec.ts` (3 tests)                                                |
| Built-in scenarios use only real CSV rows; full-spell covers all 4 types/pillars                                                                     | `scenario.spec.ts` (2 tests)                                                |
| CSV parser: quoting, escaped quotes, CRLF, ragged rows                                                                                               | `csv.spec.ts` (5 tests)                                                     |
| Database build mirrors backend ParseCSV: field mapping, row guard, no `recommendedClips` (enrichment disabled in real backend)                       | `music-database.spec.ts` (4 tests)                                          |
| Pillar-index ↔ IP map mirrors `incoming-events.ts:29-38`                                                                                             | `music-database.spec.ts` (1 test)                                           |
| Import guard: `sim/**` never imports `ableton-js`/`node-osc`/`backend`; `sim/core` never imports `socket.io` and only relative modules               | `import-guard.spec.ts` (4 tests)                                            |

The last row satisfies the ADR-001 guard requirement structurally: any future forbidden import fails the suite.

## Tests added in this pass

8 new tests in `spec/sim/simulator.spec.ts` (rows marked **NEW** above): 5 in a new `clip lifecycle details` block using the real CSV database, 3 in a new `Simulator key adoption (synthetic database)` block using a synthetic CSV (real column headers, controlled keys/BPMs) so key-adoption semantics are deterministic regardless of production CSV contents. The synthetic block also exercises `buildMusicDatabase` end-to-end on non-production input.

## Defects found

None. Every behavior I tested matched the observed backend contract, including the subtle ones (no `rfid` on `ingredient_removed`, no event on `set_keylock_state`, silent master-key clear on timeout, `clip_playing` vs `clip_started` branch, adoption-at-queue-time when master key is empty). The implementer's contract-fidelity table held up under adversarial testing.

## Gaps left open and why

- **Multi-clip timeout `clip_stopped` fan-out**: on idle timeout the real backend calls `stop_all_clips` on all 4 tracks; whether Ableton fires `playing_slot_index → -1` for tracks with nothing playing is only observable against a live set. The sim emits `clip_stopped` only for occupied pillars — reasonable, but unverifiable offline. Live-check item, not automatable.
- **Phrase-boundary timing**: the fixed `phraseLengthMs` timer is a documented approximation of the phrase-leader loop-end listener; exact timing equivalence is untestable without Ableton. Event names/shapes/order are covered.
- **`clip_started.bpm` fidelity**: CSV BPM vs warp-marker BPM — documented approximation, untestable offline.
- **`sim/server.ts` socket wiring**: deliberately untested per ADR-001 (transport is a thin shell; testing it would require opening a real socket server, which the safety rules forbid). Its behavior was human-verifiable via the implementer's demo steps.
- **Timeout-while-stopping guard** (`stoppingClips` non-empty suppresses the warning): the sim clears `stoppingClips` synchronously within `stopOrRemoveClipFromQueue`, so the intermediate state is not observable from the public API. Testing it would require refactoring `sim/core` internals, which is outside this prompt's mandate.

None of these block the ticket's acceptance criteria.

## Safe validation run

- `yarn test` — 48 tests passing (6 files; was 40 before this pass), no network, no hardware, fake timers only.
- `yarn lint` — clean (pre-existing React-version warning only).
- `git diff --check` — clean.
- Never ran `yarn start-backend`; no sockets opened; `src/assets/Music Database.csv` read-only.

## Files changed

- `spec/sim/simulator.spec.ts` — extended (only file modified besides this note).

## Verdict

approve
