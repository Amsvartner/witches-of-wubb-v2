# WOW-016 — frontend-implementer handoff (debug modal spaced-name crash)

Date: 2026-07-12
Executor: Claude Sonnet 5 (frontend-implementer role, unattended `/ship-feature` pipeline)
Branch: `feat/wow-016-debug-modal-spaced-names`
Scope: one-line fix + regression test. UI-only, no event contract change.

## What changed

`src/container/DebugModalContainer.tsx`: the queued-clip button's `onClick` did `ClipDatabaseUtil.clipNameToInfoMap[queuedClip.clipName].rfid` — `clipNameToInfoMap`'s keys are space-stripped at build time (`backend/util/CsvUtil.ts:31`), while `queuedClip.clipName` arrives raw (spaced) from the `clip_queued` event, so any real clip name containing a space (the vast majority of them — e.g. `"Doink U" Vox 122`, `7 Rings vox 12A 140`) returned `undefined` from the lookup and `.rfid` threw, crashing the modal the operator would be using to fix things. Fixed by using `queuedClip.rfid` directly — exactly what the playing-clip branch two lines above (`:91`) already does, and the pattern the ticket names as the fix.

Confirmed the stop condition doesn't trigger before making this change: dispatched a research pass tracing `queuedClips`' type (`BrowserClipInfo`, same as `playingClips`) and its population (`clip_queued` socket handler, `backend/adapter/AbletonAdapter.ts:169` and the mirrored `sim/core/simulator.ts:250-251`) — `rfid` is a required field on `ClipMetadataType`, always present on both the real backend's and the simulator's `clip_queued` payload, and the existing sim tests (`sim/test/simulator.test.ts:243-264`) already assert it via the ack field-subset. `queuedClip.rfid` is exactly as reliable as the already-working `playingClip.rfid`.

## New test

`src/container/test/DebugModalContainer.test.tsx` (new file/directory — none existed before): renders the modal with a queued clip whose name contains spaces, clicks it, and asserts `socket.emit('/departed/tag', { rfid, pillar })` fires without throwing. Uses a synthetic clip name/rfid (not a real CSV row) so the test can't collide with the "available clips" list, which the component builds from the real `Music Database.csv` via `ClipDatabaseUtil` — a real clip name would render a second time in that list on other pillars and break `getByText`'s single-match assumption (hit this directly while writing the test; switched to a synthetic fixture named after the same bug class the ticket describes).

## What did NOT change

- No event contract change — still emits the existing `/departed/tag` with `{ rfid, pillar }`, byte-identical shape to before.
- `ClipDatabaseUtil` import retained (still used for the top-level `clips` list); not touched otherwise.
- No other modal behavior touched.

## Verification performed

- `yarn test` — 69/69 passed (68 pre-existing + 1 new).
- `yarn lint` — clean.
- `yarn build` (`tsc && vite build`) — clean. (One fix needed here: `vi` required an explicit `import { vi } from 'vitest'` for `tsc`'s static check to recognize it, even though vitest's `globals: true` makes it available at runtime without an import — matches the existing precedent in `src/context/hook/test/useSocketContextProviderState.test.tsx`.)
- **Live manual verification** (`yarn sim` + `yarn dev`, both explicitly permitted — no real hardware/Ableton involved): opened the debug modal against the real simulator and queued several real, space-containing clip names (`"Doink U" Vox 122`, `7 Rings vox 12A 140`, `Anti-General drums 11A 140`, `Afro House 125`) through ~7 real queue/auto-fire cycles. Zero console errors throughout. Was not able to screenshot the exact instant of clicking an unqueue button before the simulator's phrase-leader logic auto-fired the queued clip (~8s window, shorter than my tool round-trip latency) — this is a live-automation timing limitation, not a code-correctness signal; the deterministic component test exercises the identical code path without that race and is the more rigorous check of the two.
- Reverted an incidental, out-of-scope `.claude/launch.json` addition (a local `sim-idle` preview config I added to help drive manual verification) before committing — not in this ticket's allowed-files list.

## How to verify (human demo steps)

1. `yarn sim` (any scenario) + `yarn dev`, open the debug modal (top-left button on the main screen).
2. Queue a real clip with a spaced name (most of them qualify) on any pillar by clicking it in the available list while something else is already playing somewhere.
3. Before it auto-fires (or after re-queueing it manually), click it in the "queued:" slot to unqueue — confirm no crash, and that `/departed/tag` fires (visible in the sim server's log output) with the correct rfid.
