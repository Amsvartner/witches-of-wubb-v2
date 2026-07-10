# WOW-011 PR 2 (backend sweep) — general reviewer verdict

- Reviewer: reviewer (Claude Fable 5, /ship-feature pipeline)
- Date: 2026-07-10
- Review target: `git diff feat/wow-011-frontend-sweep...feat/wow-011-backend-sweep` (PR #8, stacked on PR 1 — NOT diffed against main)
- Base: `feat/wow-011-frontend-sweep` @ c475540 · Head: `feat/wow-011-backend-sweep` @ 5b4ef0d (matches origin)
- Ground truth: AGENTS.md v0.4 (conventions-migration exception), WOW-011 in `docs/TICKETS_001_INITIAL.md`, `docs/CODING_GUIDELINES.md` v1.0, reviewer profile
- Method: read-only. All equivalence claims re-verified independently against `git show origin/main:backend/...` (backend is byte-identical between `origin/main` and the PR 1 base — confirmed first). `yarn start-backend` never run.

## Verdict: **approve-with-nits** — conditional on audio-ableton-reviewer sign-off

- hardware-safety-reviewer: **APPROVE recorded** @ 5b4ef0d (`docs/agent-notes/wow-011-hardware-safety-reviewer-signoff.md`). ✓
- audio-ableton-reviewer: **note absent at review time** (runs in parallel). Per the ticket and AGENTS.md exception terms, this approval is **conditional on that sign-off landing before merge**. Do not merge without it.
- No blocking findings. Should-fixes are doc-path gaps; zero behavioral deltas found.

## Independent equivalence verification (checklist items 1–3)

Rebuilt from the old tree (`git show origin/main:backend/*`) vs. the new files — not taken from the implementer's table; results match it exactly:

- **Emitted event names:** identical 12-name multiset incl. duplicates (`clip_stopped` ×2, `clip_unqueued` ×2; `clip_playing`, `clip_queued`, `clip_started`, `clip_stopping`, `ingredient_detected`, `ingredient_removed`, `master-key_changed`, `tempo_changed`, `timeout_warning`, `volume_changed`).
- **socket.on handlers:** identical set — 10 named ws events + 2× `disconnect`; OSC `/new/tag`, `/departed/tag` unchanged. Ack-vs-no-ack semantics identical per full-file normalized diff (callbacks preserved 1:1; `set_track_volume`/`set_master-key` still ack-less).
- **Transposition table:** body lines 2–340 byte-identical (`diff` empty); only the binding line (`export const transpositions` → `const TRANSPOSITIONS`) and appended namespace export differ.
- **Pillar IP map:** 192.168.0.101–104 → 0–3 byte-identical (only `export` keyword dropped).
- **Lighting OSC addresses:** `/${pillar}/${eventName}` and `/${eventName}` unchanged; `data?.pillar > -1` branch and `message.append(data.type)` logic unchanged.
- **Timeouts:** `60 * 3 * 1000` / `30 * 1000` unchanged; auto-volume on clip start `0.6` unchanged.
- **Rename-not-rewrite, token-level:** normalized diff (old file with the declared renames mechanically substituted vs. new file) of `AbletonAdapter.ts` and `IncomingEvents.ts` leaves only: one prettier line-wrap each, the appended namespace-export object, and one stale name inside an already-commented-out line. `OutgoingEvents.ts`/`LightingAdapter.ts` verified line-for-line against old `outgoing-events.ts` (clean extraction, no edits). Zero logic/ordering/payload changes.
- **Live-binding semantics:** `trackVolumes`/`tracks` exposed as getters (read semantics of old `export let` preserved); mutated const arrays passed by reference. Old exports dropped from the grouped object (`timeoutId`, `keyLockEnabled`, `masterKey`, `phraseLeader`, `allAbletonClips`, `cleanUpPhraseLeaderEventListener`, `ATTRACTOR_STATE_CLIP_NAME` as import) verified to have had **zero external importers** in the old tree — safe surface narrowing.
- **Module-eval order:** `index.ts` still runs `dotenv.config()` before any backend module require (TS CJS emit preserves statement order); `LightingAdapter` env reads and the CSV read (`MusicDatabaseService`) occur at the same relative points as before; the pre-existing adapter↔event cycles resolve via call-time property access only.

## Scope / authorization (checklist item 1)

- Diff confined to `backend/**` (exception-covered), 5 `src/` import-path updates forced by the type split, docs, and the handoff note. No `sim/` code changes; `spec/` untouched (PR 3's slice untouched); no `.eslintrc` changes.
- `backend/package.json`, `backend/tsconfig.json`, root `package.json`, all lockfiles: untouched ✓. No dependencies added ✓. No credentials, no new IPs/ports/magic numbers ✓. Disallowed files (CSV, Arduino/, .env) untouched ✓. `git diff --check` clean ✓.

## Type split (checklist item 5)

- `backend/types.ts` → 14 one-type-per-file modules under `backend/type/`, bodies byte-identical to the old declarations; `interface WarpMarker` → `type` (type-level only); new `Maybe.ts` (`export type Maybe<T> = T | undefined;`) ✓.
- All import sites updated: `src/context/AbletonProvider.tsx`, `src/hook/useGrimoire.ts`, `src/type/SpellRecipeType.ts`, `src/util/ClipDatabaseUtil.ts`, `src/util/ColorUtil.ts`. Repo-wide grep: zero remaining code references to `backend/types`, `backend/utils/`, `backend/events/`, `backend/ableton-api`, `backend/key-transpositions`. `sim/` imports nothing from `backend/` at all (its mirrored types are the intentional ADR-001 contract copy, not duplication introduced here); the import-guard test is path-independent of this restructure and still enforces that.

## Green (checklist item 8)

- `yarn lint` ✓ · `yarn test` 48/48 ✓ · `yarn build` ✓ (run by this reviewer at 5b4ef0d)
- Simulator smoke: `yarn sim full-spell` boots, loads 133 clips, emits the expected event sequence (`ingredient_detected` → `master-key_changed` → `clip_started` → `volume_changed 0.6` → `tempo_changed`) ✓
- Copilot round: review present, **0 review threads** (clean) — but the PR body's Pipeline-status checkboxes still show `<sha>` placeholders (see should-fix 2).

## Findings

### Blocking

None.

### Should-fix

1. **Stale doc/profile paths not updated in this PR** — AC: "all stale file-path references in AGENTS.md/docs updated in the same PR as the move" (PR 1 precedent treated agent-profile paths as in scope):
   - `docs/ABLETON_INTEGRATION.md:18` — `utils/is-new-phrase-leader.ts` → `backend/service/PhraseLeaderService.ts`
   - `docs/ABLETON_INTEGRATION.md:29` — `utils/parse-csv.ts` → `backend/util/CsvUtil.ts`; binding names `RFIDToClipMap`/`ClipNameToInfoMap` → `MusicDatabaseService.rfidToClipMap`/`.clipNameToInfoMap`
   - `docs/DATA_MODEL.md:3` — `backend/types.ts` → `backend/type/`; `docs/DATA_MODEL.md:34` — `get-clip-from-rfid.ts` → `backend/service/MusicDatabaseService.ts`
   - `docs/CODING_GUIDELINES.md:209` — says logger "becomes `backend/util/logger.ts` when the migration lands"; actual landed path is `backend/util/LoggerUtil.ts`
   - `.claude/agents/audio-ableton-reviewer.md:16`, `.claude/agents/hardware-safety-reviewer.md:16`, `.claude/agents/creative-tech-integrator.md:17` — required-context file lists cite pre-migration backend paths
2. **PR #8 body Pipeline-status section unfilled** (`<sha>` placeholders, unticked boxes) — must record Copilot-clean @ 5b4ef0d, this review, and both specialist reviews before the gate; template-completeness is a gate requirement.

### Nits

1. `docs/ARCHITECTURE.md:15` — ASCII diagram row `| AbletonAdapter.ts: ...transposition|---->|` broke column alignment (line grew, pipes no longer line up).
2. `docs/ARCHITECTURE.md:38` — runtime-components text still says `QueueClip` (function is now `queueClip` on `AbletonAdapter`).
3. `backend/adapter/AbletonAdapter.ts:332` — commented-out line still uses old `ClipNameToInfoMap` name (moot once PR 3 removes commented-out code; noting for completeness).
4. **Layering (architecture note, faithful-preservation accepted):** `backend/service/PhraseLeaderService.ts:1` imports `AbletonAdapter` for `TRIGGER_ORDER`, so a "service" transitively evaluates `new Ableton(...)` at module load — against the guidelines' pure-service intent and the sim rule ("pure `backend/service/` code"). It exactly preserves the old dependency (`utils/is-new-phrase-leader.ts` → `ableton-api`), and fixing it (moving `TRIGGER_ORDER`/`KEY_LEADER_ORDER` out of the adapter) would exceed rename-only scope — correctly not done here. Same family: `MusicDatabaseService` does `fs.readFileSync` at module eval (file I/O in a service; faithful move), and `AbletonAdapter` retains business logic wholesale (explicitly acknowledged in the PR body per the ticket stop-condition against splitting logic). Suggest a small follow-up ticket: extract musical constants to their own module and revisit service purity.

## Required follow-up reviewers

- **audio-ableton-reviewer** — sign-off note absent at review time; **mandatory before merge** (AGENTS.md v0.4 exception terms). This verdict is conditional on it.
- hardware-safety-reviewer — already recorded: APPROVE @ 5b4ef0d.
