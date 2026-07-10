# WOW-011 — audio/ableton reviewer sign-off (PR 3: tests + enforcement)

Reviewer: audio-ableton-reviewer (Claude Fable 5, read-only specialist spot-check)
Date: 2026-07-10
Review target: `git diff origin/main HEAD -- backend/` on `feat/wow-011-tests-enforcement`, head `56a16cb`, PR https://github.com/Amsvartner/witches-of-wubb-v2/pull/9.
Requested by: general reviewer (`docs/agent-notes/wow-011-reviewer-verdict-pr3.md`, should-fix 2) per the WOW-011 escalation clause — the `any`-removal brushes Ableton/OSC paths.

## Verdict

**Approve.** Every backend hunk is erased-type-level (annotations, generics, `as` casts) or dead-comment removal. Zero runtime-expression change in any Ableton, OSC, timing, or CSV-mapping path. No musical mapping, timing, or event-surface change; nothing rises to the mapping/timing block rule.

## Scope reviewed (line by line)

Eight backend files in the delta: `backend/adapter/AbletonAdapter.ts`, `backend/adapter/LightingAdapter.ts`, `backend/event/IncomingEvents.ts` (in the diff though not in the request's file list — verified anyway), `backend/event/OutgoingEvents.ts`, `backend/service/MusicDatabaseService.ts`, `backend/util/CsvUtil.ts`, new `backend/type/CsvRow.ts`, new `backend/type/OutgoingEventData.ts`.

## Findings

### Blocking

None.

### Should-fix

None.

### Nits / observations

1. **Observation (no action)** — `backend/event/OutgoingEvents.ts:13-14`: `(data?.pillar as number) > -1` asserts `number` on a possibly-`undefined` value. Runtime is byte-identical to the old untyped code (`undefined > -1` → `false` on both paths, casts erased), and a "cleaner" `typeof` guard would be an expression change forbidden by the zero-behavior invariant — so the cast is the correct choice _here_. A future behavior-allowed ticket could tighten it.
2. **Observation (no action)** — `backend/util/CsvUtil.ts:43-77` `enrichRecommendations`: the `as unknown as number` casts encode the pre-existing string-to-number subtraction coercion on `Key Numerical`; runtime unchanged, and the function's only call site remains commented out in `MusicDatabaseService.ts` (dead path, unchanged). The removed `// && Math.abs(compRow[bpmHeader] - ...)` line was already a comment — the BPM-proximity constraint was disabled before this PR and remains so.

## Evidence per checklist item

### 1. Type-level only — verified hunk by hunk

- **OutgoingEvents.ts** — `Record<any, any>` → `OutgoingEventData` (new `backend/type/OutgoingEventData.ts`: `Record<string, unknown> & { pillar?: number; type?: string }`) on `emit`/`emitEvent`/`emitEventWithoutResetingTimout`; `(data?.pillar as number)` casts in the pillar branch. All erased at compile time. `socket.emit(eventName, data)` payloads and OSC address construction (`/${pillar}/${eventName}` with `pillar = data.pillar + 1`, else `/${eventName}`) byte-identical. `AbletonAdapter.restartTimeoutTimer()` call placement unchanged, so the timeout-reset vs no-reset split between `emitEvent` and `emitEventWithoutResetingTimout` is intact.
- **LightingAdapter.ts** — `sendOscMessage(address, data?: Record<any, any>)` → `OutgoingEventData`: signature annotation only. Body (`Message(address)`, `if (data?.type) message.append(data.type)`, `lightingClient.send`) untouched; `data.type` narrows from `any` to `string | undefined`, no coercion change.
- **AbletonAdapter.ts** — `cleanUpPhraseLeaderEventListener: any` → `(() => unknown) | undefined` (usages at lines 252/261/269 are guard-then-call, unchanged); all other hunks remove only `//`-prefixed dead code (`onAny` logger, duplicate `FindAllClipsInLoop` function, `stoppingClipsInLoop`, `checkDatabase` block). The live memoized `FindAllClipsInLoop` and the key-lock transposition loop (`playingClipsInLoop.forEach(... transposeClipToNewKey ...)`) are unchanged.
- **IncomingEvents.ts** — adds `IncomingEventSpec` type and annotates the `incomingEvents` map (`{ [key: string]: any }` → `IncomingEventSpec`). The `/new/tag` and `/departed/tag` entries, `IP_ADDRESS_TO_PILLAR_INDEX_MAP` (4 pillar IPs, unchanged), and every handler body are byte-identical.
- **MusicDatabaseService.ts** — `Papa.parse<CsvRow>` is a type argument (erased); `forEach(CsvUtil.parseCsv.bind(this, rfidToClipMap, clipNameToInfoMap))` → `forEach((row) => CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, row))`. Confirmed on `origin/main`: `parseCsv` declares exactly 3 parameters and contains no `this` (grep: zero hits either revision), so the old path already discarded `forEach`'s extra index/array arguments — identical arguments reach identical code. CSV filename, `transformHeader` colon-strip, and header names (`RFID`, `Clip Name`, `Clip Type (e.g. Vocals)`, `Key`, etc.) untouched.
- **CsvUtil.ts** — `row: any` → `CsvRow` (`Record<string, string>`), `as unknown as number` / `as ClipMetadataType` / typed `reduce` accumulator: all erased. Removed lines are comments only.

### 2. Event names frozen

Grep of all `emitEvent`/`emitEventWithoutResetingTimout`/`sendOscMessage` call sites across `backend/` on `origin/main` vs `HEAD`: identical sets and counts — `clip_queued`, `clip_started`, `clip_stopping`, `clip_unqueued` (x2), `ingredient_detected`, `ingredient_removed`, `master-key_changed`, `tempo_changed`, `volume_changed`, `clip_playing`, `clip_stopped` (x2), `timeout_warning`, plus OSC patterns `/${eventName}` and `/${pillar}/${eventName}`. Incoming surface (`/new/tag`, `/departed/tag`, all `socket.on` names) unchanged. Nothing added, renamed, or removed.

### 3. Musical constants untouched

- `git diff origin/main HEAD -- backend/service/KeyTranspositionService.ts backend/service/PhraseLeaderService.ts backend/type/ClipTypes.ts` — empty. Transposition table, phrase-leader logic, and category enum are not in the delta.
- `TIMEOUT_IN_MILISECONDS = 60 * 3 * 1000` / `TIMEOUT_WARNING_IN_MILISECONDS = 30 * 1000` and both `setTimeout` sites: identical on both revisions (line numbers shift only from comment removal).
- Volume paths (`get_volume`, `setTrackVolume`) and `IP_ADDRESS_TO_PILLAR_INDEX_MAP`: unchanged.
- Camelot key/BPM assumptions: only touched via the type-only casts in the dead `enrichRecommendations` path (observation 2).

### 4. Runs (on `56a16cb`; real backend never started)

- `yarn test`: **52/52 passed, 8 files** — matches expected count.
- `yarn lint`: pass with the new enforcement rules active.
- `npx tsc --noEmit` (root) and `npx tsc --noEmit -p backend/tsconfig.json`: both clean — the new annotations compile.
- `yarn sim full-spell` smoke (simulator only): loads the Music Database, emits `master-key_changed {"key":"4A"}`, then per-pillar `ingredient_detected` → `clip_queued` → `clip_started` (with correct BPM 86 / key 4A metadata and 0-indexed pillar in payloads vs 1-indexed pillar addresses) → `volume_changed {volume:0.6}`. Payload shapes match the frozen event surface. Sim processes terminated after the smoke.

## TBD / out of scope

- Ableton set contents not represented in the repo: not assessed (per reviewer profile — no speculation).
- Frontend and test-file portions of PR 3: covered by the general reviewer's verdict note; this sign-off is scoped to the backend delta.
