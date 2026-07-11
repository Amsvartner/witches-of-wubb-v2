# WOW-004 — architecture-reviewer review of `docs/UI_AUDIT.md`

Date: 2026-07-11
Reviewer: architecture-reviewer subagent (claude-opus-4-8), high reasoning effort
Branch: `docs/wow-004-ui-audit` @ `c3c5a3e`
Report under review: `docs/UI_AUDIT.md` (auditor: frontend-ui-designer, `c3c5a3e`)
Scope: independent verification of the audit's contract, boundary, disconnect/failure, visitor/operator, and blast-radius claims against ground truth. Read-only — no code or `docs/UI_AUDIT.md` edits made by me.

## Method

Cross-checked every architecture-facing claim against ground truth rather than trusting the report:

- Backend contract: enumerated all outgoing emissions in `backend/` (`grep emitEvent/emitEventWithoutResetingTimout`) and all `socket.on` handlers in `backend/event/IncomingEvents.ts`.
- Frontend consumption: read `src/context/hook/useAbletonContextProviderState.ts`, `useSocketContextProviderState.ts`, `src/container/DebugModalContainer.tsx`, `src/screen/MainScreen.tsx` in full.
- Blast radius: independently traced importers of `useGrimoire`, `RecipeBoxContainer`, `SpellRecipeType`, and `recommendedClips`/`enrichRecommendations` usage across `src/`.
- ADR alignment: `docs/adr/003`, `006`, `004`.
- Safe checks: `yarn lint` PASS, `yarn test` 68/68 PASS, `git diff --check` clean, audit commit `c3c5a3e` confirmed docs-only (3 files, +490, no `src/`/`backend/`).

Verified positives (all accurate as written):

- **No dead listeners.** Every event the UI subscribes to (`ingredient_detected`, `clip_queued`, `clip_unqueued`, `clip_started`, `clip_playing`, `ingredient_removed`, `clip_stopping`, `clip_stopped`, `tempo_changed`, `volume_changed`, `master-key_changed`) is emitted somewhere in `backend/adapter/AbletonAdapter.ts` / `backend/event/IncomingEvents.ts`. Ack/no-ack directions in the consumption table match the backend handlers exactly (`set_track_volume`/`set_master-key` no-ack; `set_tempo`/`set_keylock_state` ack — all confirmed against `IncomingEvents.ts:148-175`).
- **Boundary discipline (ADR-004).** The report treats the socket contract as the frontend/backend boundary, proposes no contract changes, and explicitly refuses to narrow the `backend/type/` `recommendedClips` field (blast-radius item 6) as out-of-scope. No "the backend should…" drift statements. Clean.
- **Disconnect/failure wiring.** UI-01 (`useAbletonContextProviderState.ts:109-112`, `// TODO: Show in UI`) and UI-02 (`useSocketContextProviderState.ts:10`, `{} as Socket`) match the current post-WOW-011 file shapes. Confirmed independently that no `socket.on('disconnect'|'connect_error', …)` exists anywhere in `src/` — only `connect` (`useSocketContextProviderState.ts:18`) and `onAny` (`:22`).
- **Visitor/operator mapping (ADR-003/006).** All 19 files assigned; the invisible single-tap trigger (`MainScreen.tsx:34-36`) is correctly identified as NOT matching ADR-006's long-press-on-themed-element gesture; UI-13 (trigger nested inside the F5-removed recipe-box wrapper) verified against `MainScreen.tsx:33-38`.
- **Recipe-removal blast radius.** Independently reproduced: `useGrimoire` imported only by `RecipeBoxContainer`; `RecipeBoxContainer` only by `MainScreen`; `SpellRecipeType` only by `useGrimoire`; `recommendedClips` consumed only at `useGrimoire.ts:86` + enriched at `ClipDatabaseUtil.ts:11`. The claimed absence of coupling to `CurrentlyPlayingListContainer.tsx` is correct (no import of grimoire/recipe/SpellRecipe). UI-08 `col-start` literals confirmed at lines 82/92 vs. the dynamic at line 33. Every item accurate.
- **Coverage.** All 19 inventory files (1 component, 6 containers, 10 context, 1 hook, 1 screen) have real per-file content; the extra files `find` surfaces (`main.tsx`, `util/*`, `type/SpellRecipeType.ts`, `vite-env.d.ts`) are correctly scoped as reference-only. Severity tags and file:line evidence present throughout; no code changes.

---

## Findings

### Blocking

_None._ The report satisfies the WOW-004 acceptance criteria (all 19 files covered, blast radius listed, issues severity-tagged, no fixes made) and is docs-only. No contract change, no missing-report/under-coverage stop condition triggered.

### Should-fix

**AR-01 — `timeout_warning` is an unconsumed backend emission the audit missed, and the "no deltas found" claim is factually wrong.**
Report section: "Socket-event consumption table" (`docs/UI_AUDIT.md:213-245`, esp. the header line 215 and the `clip_stopped`/lifecycle rows).
Ground truth: `backend/adapter/AbletonAdapter.ts` emits `timeout_warning` via `OutgoingEvents.emitEventWithoutResetingTimout('timeout_warning', …)` (backend grep: 1 occurrence). It is **not** subscribed anywhere in `src/` (confirmed: `grep -rn timeout_warning src/` → no matches). The WOW-003 fidelity table the audit says it cross-referenced explicitly lists it: `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md:44` (`timeout_warning (out) … bare event, 30s before 3-min idle timeout, only while clips play`).
Why it matters: checklist item 1 explicitly requires flagging "any backend emission the UI ignores (unused contract surface); both are rework-relevant facts." This is exactly that case, and it is precisely rework-relevant: the UI has **no idle-timeout affordance at all** — it neither warns at T-30s nor reflects the timeout when it fires. That directly reinforces UI-01 (silent-state blindness / UX_UI_PRINCIPLES principle 4). Worse, the audit's line 215 asserts "no deltas found — the frontend consumes/emits exactly what that table documents," which is contradicted by the very table it cites. As the pre-rework baseline for WOW-006/007, an incorrect "no deltas" claim in the contract table should not stand.
Suggested remedy (for the fix round, not by me): add a `timeout_warning (out) — not subscribed anywhere` row to the consumption table (mirroring the existing `disconnect`/`connect_error` "not subscribed" row at line 243), tag it as an unused-contract-surface finding relevant to the disconnect/idle-visibility rework, and correct the "no deltas found" sentence to name this one delta.

### Nits

**AR-02 — Idle timeout also stales `masterKey` with no corresponding event; worth a one-line note alongside AR-01.**
Report section: consumption table + UI-01 discussion (`docs/UI_AUDIT.md:143-151`, `241`).
Ground truth: WOW-003 note (`…wow-003-…-simulator.md:14`) records that `handleTimeout` clears the master key **without** emitting `master-key_changed`. Combined with AR-01, when the 3-min idle timeout fires the UI keeps showing a stale master key and gets no `timeout_warning` it listens for — a concrete stale-state case the disconnect/failure section (checklist item 3) could name. Descriptive backend behavior only; no contract change implied. Purely additive to the report.

**AR-03 — "No dead listeners" is proven but never stated as an explicit negative result.**
Report section: consumption table (`docs/UI_AUDIT.md:213-245`).
The audit documents the negative coupling result for `CurrentlyPlayingListContainer` explicitly (blast-radius item 7) but does not state the equally-relevant negative for checklist item 1's first half — that no UI listener lacks a backend emitter. It's true (I verified), just implicit. A single sentence ("every subscribed event has a backend emitter; no dead listeners") would close the checklist item cleanly. Cosmetic.

**AR-04 — UI-11 "always-populated" is asserted from a client-side code path, not a guaranteed invariant.**
Report section: `useGrimoire.ts` / UI-11 (`docs/UI_AUDIT.md:176`).
`recommendedClips` is populated by `CsvUtil.enrichRecommendations` over the local CSV at module load, so "never undefined" holds for the current CSV, but it's a data-dependent outcome (a clip with no same-key/tempo neighbours could yield an empty set), not a structural guarantee. The claim is fine for an informational finding and doesn't affect the boundary review or the F5 removal decision; flagging only so the rework doesn't treat "always populated" as a contract.

---

## Verdict

**approve-with-nits.**

The audit is thorough, correctly scoped to the frontend/socket boundary (ADR-004), accurate on every disconnect, visitor/operator, and blast-radius claim I re-derived, and makes no code or contract changes. One material correction is required in the fix round — **AR-01** (add the missing `timeout_warning` unused-contract-surface row and fix the incorrect "no deltas found" assertion) — plus three optional polish items (AR-02–AR-04). None of these blocks sign-off of the audit as the pre-rework baseline once AR-01 is applied.
