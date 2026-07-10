# WOW-011 — creative-tech-integrator handoff (PR 2: backend sweep)

Executor: Claude Fable 5 (creative-tech-integrator role, /ship-feature pipeline)
Branch: `feat/wow-011-backend-sweep` (stacked on `feat/wow-011-frontend-sweep`; PR base = PR 1 branch)
Scope: migration steps 3, 4, 5 under the AGENTS.md v0.4 conventions-migration exception. **Zero behavioral change.**

## Rename map (all via `git mv`)

| Old path                                | New path                                            | Grouped export                                                |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `backend/ableton-api.ts`                | `backend/adapter/AbletonAdapter.ts`                 | `AbletonAdapter`                                              |
| `backend/events/incoming-events.ts`     | `backend/event/IncomingEvents.ts`                   | `IncomingEvents`                                              |
| `backend/events/outgoing-events.ts`     | `backend/event/OutgoingEvents.ts`                   | `OutgoingEvents` (OSC client extracted)                       |
| (extracted from outgoing-events)        | `backend/adapter/LightingAdapter.ts`                | `LightingAdapter = { sendOscMessage }`                        |
| `backend/key-transpositions.ts`         | `backend/service/KeyTranspositionService.ts`        | `KeyTranspositionService = { TRANSPOSITIONS }`                |
| `backend/utils/is-new-phrase-leader.ts` | `backend/service/PhraseLeaderService.ts`            | `PhraseLeaderService = { findNextPhraseLeader }`              |
| `backend/utils/get-clip-from-rfid.ts`   | `backend/service/MusicDatabaseService.ts`           | `MusicDatabaseService = { rfidToClipMap, clipNameToInfoMap }` |
| `backend/utils/logger.ts`               | `backend/util/LoggerUtil.ts`                        | `LoggerUtil = { logger }`                                     |
| `backend/utils/parse-csv.ts`            | `backend/util/CsvUtil.ts`                           | `CsvUtil = { parseCsv, enrichRecommendations }`               |
| `backend/types.ts`                      | `backend/type/*.ts` (14 files incl. new `Maybe.ts`) | types exported directly                                       |

Function renames (camelCase, name-only): `StartAbleton`→`startAbleton`, `QueueClip`→`queueClip`, `StopOrRemoveClipFromQueue`→`stopOrRemoveClipFromQueue`, `TriggerQueuedClips`→`triggerQueuedClips`, `AddPhraseLeader`→`addPhraseLeader`, `GetTracksAndClips`→`getTracksAndClips`, `Get/SetTempo`, `Get/SetTrackVolume(s)`, `Get/SetKeyLockState`, `Get/SetMasterKey`, `CalculateBPMFromWarpMarkers`→`calculateBpmFromWarpMarkers`, `ConnectOSCServer`→`connectOscServer`, `AddWebSocket`→`addWebSocket`, `FindNextPhraseLeader`→`findNextPhraseLeader`, `ParseCSV`→`parseCsv`, `EnrichRecommendations`→`enrichRecommendations`, `EmitEvent`→`emitEvent`, `SendOSCMessage`→`sendOscMessage`, `UpdateIndex` equivalents. The misspelling `emitEventWithoutResetingTimout` is deliberately preserved (name-fidelity over spelling; rename would be gratuitous churn).

## Semantics-preserving mechanics (for reviewers)

- **Live bindings:** `trackVolumes` and `tracks` are `let`s reassigned inside the adapter and read from `IncomingEvents`. The grouped `AbletonAdapter` object exposes them as **getters**, preserving the `export let` live-binding read semantics exactly. Const arrays (`playingClips`, `queuedClips`, `stoppingClips`, `sockets`) are direct references (never reassigned — mutation via index/`splice` flows through the shared reference as before).
- **Logger call sites unchanged:** every module does `const logger = LoggerUtil.logger;` once, so all `logger.*` calls are byte-identical to the old tree.
- **Module cycles preserved:** the adapter↔event cycles that existed before (`ableton-api` ↔ `outgoing-events`/`incoming-events`) persist with identical late-binding resolution — all cross-module uses are call-time property accesses on the grouped objects, none at module-eval time. CommonJS emit (ts-node, `@tsconfig/recommended`) unchanged.
- **Env-read timing:** `LightingAdapter` reads `LIGHTING_SERVER_ADDRESS`/`PORT` at module eval, after `dotenv.config()` in `index.ts` — same relative order as the old `outgoing-events.ts`.
- **`interface WarpMarker` → `type`** (type-level only, per guidelines).
- `transpositions` → `KeyTranspositionService.TRANSPOSITIONS`: binding renamed; **table body verified byte-identical** (`diff` of lines 2–340 old vs new: empty).

## Equivalence inventory (verified by grep/diff, commands in PR)

| Check                          | Old (main)                                                                                                                                                                           | New (HEAD)                      | Result |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------ |
| Emitted socket/OSC event names | 12 distinct (`clip_playing/queued/started/stopped×2/stopping/unqueued×2`, `ingredient_detected/removed`, `master-key_changed`, `tempo_changed`, `timeout_warning`, `volume_changed`) | identical set, identical counts | ✓      |
| `socket.on` handler names      | 10 + `/new/tag`, `/departed/tag`                                                                                                                                                     | identical                       | ✓      |
| Pillar IP map                  | 192.168.0.101–104 → 0–3                                                                                                                                                              | byte-identical                  | ✓      |
| Lighting OSC address patterns  | `/${pillar}/${eventName}`, `/${eventName}`                                                                                                                                           | identical                       | ✓      |
| Timeout constants              | 180 000 ms / 30 000 ms                                                                                                                                                               | identical                       | ✓      |
| Auto-volume on clip start      | `0.6`                                                                                                                                                                                | identical                       | ✓      |
| Transposition table            | 24 keys × 11 mappings                                                                                                                                                                | byte-identical (diff empty)     | ✓      |
| Payload shapes                 | spread-based payloads unchanged line-for-line                                                                                                                                        | ✓                               |

## Deliberate deviations (rationalized)

- **`sim/` comment anchors not updated:** ~40 comments in `sim/core/*` cite pre-migration backend paths with line numbers (e.g. `backend/ableton-api.ts:434`) as contract-mirroring provenance. These are code comments, not docs; rewriting path+line anchors en masse is error-prone and the ticket's stale-path AC covers AGENTS.md/docs. Left as historical anchors; flagged for an optional follow-up.
- **`backend/tsconfig.json`, `backend/package.json` untouched** (nodemon runs `index.ts`, which kept its path).
- `console.log('clips', clips)` in `queueClip` and commented-out blocks left in place — cleanup is PR 3 (step 8) — as are the `any`s.

## Docs updated (same-PR stale paths)

- `AGENTS.md` — ClipTypes path (project context), pillar-IP-map path, transposition-logic path (safety rules)
- `docs/ARCHITECTURE.md` — diagram lines (adapter/service/event/util), RFID-flow path, Ableton-integration paths, TBD coupling note
- `docs/ABLETON_INTEGRATION.md` — status line (with pre-migration paths noted), key-lock path
- `docs/HARDWARE_INTEGRATION.md` — pillar-IP path, lighting-failure path

## Validation

- `yarn build` ✓ (root tsc covers backend), `yarn lint` ✓, `yarn test` ✓ 48/48
- Equivalence greps/diffs above run against `origin/main` — outputs in the PR body
- **`yarn start-backend` was NOT run** — equivalence proven statically, per safety rules

## Human-verifiable demo

`yarn sim full-spell` + `yarn dev`: UI behaves identically (backend restructure does not touch the sim, and the frontend only gained new import paths). For the backend itself: pick any event in the equivalence table, `git diff main...HEAD -M` the two files it names, and confirm the handler moved without edits.

## Requires before merge

**Both audio-ableton-reviewer AND hardware-safety-reviewer sign-off** (AGENTS.md v0.4 exception terms), plus general reviewer.
