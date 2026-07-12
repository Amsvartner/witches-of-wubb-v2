# WOW-016 — test-engineer review (PR #18)

Date: 2026-07-12
Reviewer: test-engineer subagent (Claude Sonnet 5), phase C (test-review) of the ticket pipeline
Branch: `feat/wow-016-debug-modal-spaced-names` (base `main`), reviewed at commit `5b75d22`
Scope: verify the new regression test genuinely exercises the fix, verify two factual claims in the implementer's handoff (CSV-collision, rfid-required), re-run validation, assess sufficiency of automated vs. live-browser verification. No `wow-014-test-engineer-review.md` precedent exists in this repo (WOW-014 hasn't reached this pipeline phase); this note follows the structure/rigor of `docs/agent-notes/wow-004-test-engineer-review.md`, the closest existing test-engineer review.

**Verdict: approve-with-nits.**

---

## Validation (commands I actually ran)

- `yarn test` → **PASS** — 14 test files, **69 tests**, 0 failures (1.63s). Exactly matches the handoff's "69/69 (68 pre-existing + 1 new)" claim.
- `yarn lint` → **PASS** — clean except the pre-existing "React version not specified in eslint-plugin-react settings" warning (present before this branch; confirmed as pre-existing in `docs/agent-notes/wow-004-test-engineer-review.md`).
- `yarn build` (`tsc && vite build`) → **PASS** — clean. Only pre-existing, unrelated notices (Browserslist-outdated, a `Fondamento-Regular.ttf` runtime-resolve notice). `tsc` accepted the new test file, including the explicit `import { vi } from 'vitest'` the handoff called out as required for the static check.
- `git status --short` after all three commands → clean. No stray files (e.g. `dist/`) leaked into the tree.
- Did not run `yarn dev`, `yarn sim`, or `yarn start-backend` — not needed for this review; the implementer's handoff already documents live-sim verification, assessed below (item 5).

---

## Required (blocking)

None.

---

## 1 — Does the new test genuinely exercise the fix?

**Yes**, confirmed by reading `src/container/test/DebugModalContainer.test.tsx` against `git show 5b75d22 -- src/container/DebugModalContainer.tsx`.

The test renders `DebugModalContainer` with a stubbed `AbletonContext` holding one queued clip at pillar index 1 (`queuedClips[1]`) whose `clipName` contains spaces (`'Test Fixture Clip With Spaces 5A 100'`) and whose `rfid` is `'test-fixture-rfid-0001'`. It locates the queued-clip button via `screen.getByText(SPACED_CLIP_NAME).closest('button')` (confirmed unambiguous — see item 2), clicks it, and asserts `emit` was called with `('/departed/tag', { rfid: SPACED_CLIP_RFID, pillar: 1 })`.

Mentally reverting the fix (restoring the pre-fix onClick from the diff):

```jsx
onClick={() => toggleSong(ClipDatabaseUtil.clipNameToInfoMap[queuedClip.clipName].rfid, index, false)}
```

`ClipDatabaseUtil.clipNameToInfoMap['Test Fixture Clip With Spaces 5A 100']` is `undefined` (confirmed via grep — the synthetic name appears nowhere in `src/assets/Music Database.csv`, so it was never inserted into the space-stripped map built by `backend/util/CsvUtil.ts:31`). `undefined.rfid` throws a `TypeError` **during argument evaluation**, before `toggleSong` is ever called — so `socket.emit` is never invoked. The final assertion, `expect(emit).toHaveBeenCalledWith(...)`, would fail cleanly (0 calls recorded) against the pre-fix code. **The test would have caught the regression.**

One nuance worth recording (see Recommended, below): of the test's three assertions, the discriminating one is the final `toHaveBeenCalledWith`, not the `expect(() => fireEvent.click(...)).not.toThrow()` wrapper around it — that assertion is not capable of failing in this toolchain regardless of the bug's presence.

## 2 — CSV-collision claim (why a real clip name couldn't be the fixture)

**Verified true**, by reading `src/container/DebugModalContainer.tsx`'s render logic directly (not just taking the handoff's word for it).

The `clips` list (`DebugModalContainer.tsx:9-14`) is a **module-level constant** built once from the entire `ClipDatabaseUtil.rfidToClipMap` — i.e., every clip in the CSV, not scoped to any pillar. Inside the per-pillar `[1,2,3,4].map(...)`, the "available" list (`:111-127`) re-maps this _same full list_ for every pillar column, filtering a clip out only if `playingClips[index]`, `stoppingClips[index]`, or `queuedClips[index]` — **that column's own slot** — matches it (`:112-114`). A clip queued on pillar index 1 is excluded from the available list only in column index 1; columns 0, 2, and 3 check their own (empty) queued/playing/stopping slots, find no match, and render that same clip name in their available list. So a real CSV clip name queued on one pillar renders **once in "queued:" + three times across the other pillars' "available" lists** = 4 occurrences, breaking `getByText`'s single-match assumption. Claim confirmed.

The synthetic fixture avoids this because `SPACED_CLIP_NAME`/`SPACED_CLIP_RFID` aren't in `ClipDatabaseUtil.rfidToClipMap` at all (confirmed via grep against the CSV), so they never appear in the module-level `clips` list and can never render in any "available" column — only in the "queued:" section the stub explicitly populates. `getByText` genuinely has one match.

## 3 — Stop-condition verification (`rfid` required on queued-clip payloads)

**Verified true**, independently, not just re-stated from the implementer's claim:

- `backend/type/ClipMetadataType.ts:4` — `rfid: string;`, no `?`. Required.
- `backend/type/ClipInfo.ts:4` — `type ClipInfo = { clip: Clip; pillar: number } & ClipMetadataType;` — intersection keeps `rfid` required.
- `backend/type/BrowserClipInfo.ts:3` — `type BrowserClipInfo = Omit<ClipInfo, 'clip'>;` — omits only `clip`; `rfid` stays required. This is the type the frontend's `clip_queued` handler receives (`src/context/hook/useAbletonContextProviderState.ts:120`).
- Real backend emission: `backend/event/IncomingEvents.ts:72` — `AbletonAdapter.queueClip({ ...clipMetadata, rfid }, pillar);`. `clipMetadata` here comes from `RFIDToClipMapType` (`backend/type/RFIDToClipMapType.ts:4`, `Omit<ClipMetadataType, 'rfid'>` — deliberately rfid-less since rfid is that map's key), so the call site explicitly re-attaches `rfid` before calling `queueClip`. Inside `queueClip`, the queuing branch emits `OutgoingEvents.emitEvent('clip_queued', { pillar, ...clipMetadata })` (`backend/adapter/AbletonAdapter.ts:167-170`), spreading the now-rfid-bearing object. Because `queueClip`'s parameter is typed `ClipMetadataType` (required `rfid`), `tsc` itself would reject `IncomingEvents.ts:72` if the explicit `rfid` were dropped — this isn't just a runtime nicety, it's compiler-enforced given `yarn build` passing.
- Simulator emission: `sim/core/simulator.ts:198-201` — `this.queueClip({ ...clipMetadata, rfid: data.rfid, clipName: clipMetadata.clipName }, data.pillar);`, and inside `queueClip`, `this.emit('clip_queued', { pillar, ...clipMetadata })` (`:251`). Same pattern, same guarantee.
- Existing coverage: `sim/test/simulator.test.ts:243-264` (`exposes the queued clip through get_queued_clips with the ack field subset`) already asserts `rfid: melody.rfid` is present in the queued-clip shape emitted from the same code path.

The stop condition ("if queued-clip payloads turn out not to carry `rfid` → stop") correctly does not trigger. Both emission sites are structurally guaranteed (by TypeScript, not just convention) to include `rfid`.

## 4 — Lint / build

Both green — see Validation above. No new warnings introduced by this diff.

## 5 — Is the deterministic test sufficient given the live-browser gap?

**Yes**, and the reasoning holds up under scrutiny — more strongly than the handoff's own framing states. Two independent reasons:

**(a) The live session likely never exercised the fixed line at all.** Per the handoff, live verification queued real spaced-name clips repeatedly and watched for console errors — but queuing invokes the _available-list_ `onClick` (`toggleSong(rfid, index, true)`, `DebugModalContainer.tsx:123`), which was never the buggy branch. The handoff is explicit that it could not get a click on the _queued-clip_ button (the actually-fixed branch, `:103`) to land before the simulator's ~8s auto-fire raced it. So live verification is on record as having exercised the never-buggy queue path extensively, and the previously-buggy unqueue path not at all. The automated test is not just "more rigorous than an equally-successful manual check" — it may be the only verification of any kind that exercises the fixed line, short of reading the code.

**(b) A live "no console errors" observation is a weaker signal than it looks, in this exact toolchain.** I traced how a React onClick exception propagates through `fireEvent.click()` in this project's installed versions (React 18.2, jsdom 21, `@testing-library/dom` 9 via `@testing-library/react` 14 — read directly from `node_modules`, not assumed): `@testing-library/dom`'s `fireEvent` is a thin wrapper around `element.dispatchEvent(event)` (`node_modules/@testing-library/dom/dist/events.js:19`). jsdom's `innerInvokeEventListeners` invokes each registered listener (including React's single delegated root listener) inside its own `try { listener.callback.call(...) } catch (e) { reportException(window, e); }` (`node_modules/jsdom/lib/jsdom/living/events/EventTarget-impl.js:349-356`) — it catches and reports per listener, it does not re-throw to `dispatchEvent`'s caller. React's own internal rethrow of a captured handler error (`invokeGuardedCallbackAndCatchFirstError` / `rethrowCaughtError`, `node_modules/react-dom/cjs/react-dom.development.js` ~4290-4315, invoked from the dispatch path at ~9041/9087-9090) happens _inside_ that same jsdom-caught listener call, so it too gets swallowed into `reportException` (a console/`virtualConsole` "jsdomError" emission), not propagated further. Net effect: **a thrown error inside a React onClick handler never reaches the JS call site of `fireEvent.click()` in this stack** — confirmed independently by the real `yarn test` run producing a visible jsdom "Uncaught ..." stack-trace line for an unrelated test while that test still reported green.

The practical implication: a human eyeballing a live UI for "did it crash" is watching for exactly this same class of swallowed/reported error — easy to miss, especially with a ~8s window and network latency. The test's real strength isn't its `expect(() => fireEvent.click(...)).not.toThrow()` line (see Recommended below, that line can't fail either way in this toolchain) — it's the final `expect(emit).toHaveBeenCalledWith(...)`, which inspects the actual emitted value. That is strictly stronger evidence than "nothing looked wrong," live or automated, because it would catch both a crash _and_ a silent wrong-payload bug the same class of error could just as easily have produced.

Conclusion: the deterministic component test is sufficient on its own to consider this fix verified. The live-browser gap is a real limitation of the manual pass, not a gap in coverage.

---

## Recommended (advisory, non-blocking)

- **The `.not.toThrow()` assertions in the new test don't carry discriminating weight in this toolchain.** Per item 5(b) above, `expect(() => fireEvent.click(clipButton)).not.toThrow()` (`DebugModalContainer.test.tsx:69`) will pass whether or not the onClick handler throws internally, because jsdom catches and reports per-listener rather than propagating to `dispatchEvent`'s caller. It reads as the crash-guard but isn't one; the actual regression-catching assertion is the subsequent `toHaveBeenCalledWith` (confirmed in item 1). Not a defect — the test passes today and would have failed pre-fix for a solid reason — but a future edit that trimmed the `toHaveBeenCalledWith` check while keeping the `.not.toThrow()` lines would silently lose coverage of this bug class. Consider either a comment noting this, or (optional, more work) asserting on a spied `console.error`/`window.onerror` if a real crash-detection signal is ever wanted in jsdom. `expect(() => renderModal(socket)).not.toThrow()` (`:64`) is a fine, legitimate smoke check and is unaffected by this — the lookup is deferred into the click handler either way, so render never throws pre- or post-fix.
- **Benign `act()` warning.** The test run prints `Warning: An update to ye inside a test was not wrapped in act(...)` (from Headless UI's `Transition` component, triggered on mount by the `Logger.enableDebug()` effect in `DebugModalContainer.tsx:37-43`). This is the first test to render `DebugModalContainer` directly, so there's no prior in-repo precedent to compare against. It doesn't fail the test and isn't related to this fix; flagging only so a future pass at this file doesn't mistake it for a new problem.
- **Diff purity, checked though not one of the assigned items.** `git show 5b75d22 --stat` touches exactly `src/container/DebugModalContainer.tsx`, `src/container/test/DebugModalContainer.test.tsx` (both in the ticket's allowed-files list), plus `docs/agent-notes/wow-016-frontend-implementer-debug-modal-fix.md`. The last isn't in the ticket's literal "Allowed files" list but matches the standing `docs/agent-notes/` handoff convention in `AGENTS.md` ("Agent workflow files") used by every prior ticket in this pipeline — not a scope concern.

---

## Verdict

**approve-with-nits.** `yarn test` (69/69), `yarn lint`, and `yarn build` are all green, independently re-run. The new test genuinely exercises the fixed code path and would have failed against the pre-fix code (verified by tracing the exact pre-fix expression against the synthetic fixture, not just re-running green). Both factual claims in the handoff — the CSV-collision reason for using a synthetic fixture, and `rfid` being a structurally-required, always-populated field on both the real backend's and the simulator's `clip_queued` emission — check out against the source, independent of the implementer's own research pass. The ticket's stop condition does not trigger. The deterministic component test is sufficient to consider the fix verified despite the incomplete live-browser pass; if anything the live gap is more complete than the handoff states (the never-buggy queue path was exercised live, the actually-fixed unqueue path was not). The one substantive nit — the `.not.toThrow()` assertions being non-discriminating in this jsdom/React toolchain, with the real coverage carried entirely by the final `toHaveBeenCalledWith` — doesn't change the test's validity today and doesn't block merge, but is worth the implementer/reviewer knowing for future edits to this file.
