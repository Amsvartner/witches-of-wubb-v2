# WOW-031 — Backend clip-name matching uses two different normalizations (trim vs strip)

- Role: creative-tech-integrator (implementer)
- Date: 2026-07-12
- Branch: `feat/wow-031-clip-name-normalization`, stacked on `feat/wow-021-clip-cache-invalidation` (the tip of the WOW-014→032→018→020→021 chain, since `backend/adapter/AbletonAdapter.ts` overlaps)

## Ticket

WOW-031 — see `docs/TICKETS_002_BUGS.md`. This ticket has an explicit, unambiguous stop condition: _"before changing matching behavior, confirm the actual Live set naming convention with the human ... Stop conditions: Human cannot confirm the Live naming convention → stop; do not align normalizations on a guess."_ No pre-answered decision about Ableton Live Set clip naming exists anywhere in `docs/DECISIONS_NEEDED.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, or `docs/ABLETON_INTEGRATION.md` — checked all five before proceeding (general reviewer independently checked `ABLETON_INTEGRATION.md` too and confirmed the same: no mention of asterisks or naming convention, "observed from code" only). **This PR is a partial landing, opened as a draft, blocked on that human confirmation.**

## What "the Live set naming convention" actually means, precisely

There are two genuinely different things being compared in this codebase, and only one of them is what's blocked:

1. **Comparisons whose normalization doesn't depend on what's inside the Live Set** — the seven sites this PR unifies. **Correction, per audio-ableton-reviewer's independent provenance trace** (`docs/agent-notes/wow-031-audio-ableton-reviewer-signoff.md`): this is _not_ simply "CSV vs. CSV" as originally claimed here. 3 of the 5 `AbletonAdapter.ts` sites (`isClipPlaying`, the phrase-leader match, and the `clipNameToInfoMap` lookup) do involve a value ultimately sourced from `clip.raw.name` (via `playingClips[pillar].clipName`, itself set from `clip?.raw.name` inside the `playing_slot_index` listener). What actually makes unifying these seven sites safe regardless of the Live Set's naming convention is narrower and more precise than "no Ableton data involved": **the normalization regex applied at each of these seven sites is byte-for-byte unchanged by this PR** — pure code motion from an inline `.replace(/[* ]/g, '')`/`.replace(/[ ]/g, '')` to the identical pattern inside `ClipNameUtil.normalizeClipName`, regardless of which side (or both) of a given comparison happens to be Ableton-raw. No comparison's _outcome_ can change, because no comparison's _inputs_ changed — only where the regex text lives.
2. **The only two sites where the normalization itself is genuinely open to change**: `MemoizedClipIndex` and `FindAllClipsInLoop`, which use `.trim()` today and exist to _locate_ a clip slot in the actual loaded Live Set given a CSV clip name — the only place "what does a real clip name look like inside Ableton" could actually change matching _behavior_, not just refactor where existing logic lives. This is exactly what the ticket says not to guess about.

## What was done (safe, no-guess-required, fully landed)

All of category 1 above — five sites in `backend/adapter/AbletonAdapter.ts` (queue dedup, playing-clip match, phrase-leader match, queued-clip match, `clipNameToInfoMap` lookup from `playing_slot_index`) plus two sites in `backend/util/CsvUtil.ts` (`ClipNameToInfoMap` key generation, in both `parseCsv` and `enrichRecommendations`) — were already using variations of "strip normalization," just inconsistently:

- `AbletonAdapter.ts`'s five sites used `.replace(/[* ]/g, '')` (strips both asterisks and spaces) inline, repeated five times.
- `CsvUtil.ts`'s two sites used `.replace(/[ ]/g, '')` (strips spaces **only**, not asterisks) — a **third**, even narrower normalization the ticket's own description doesn't explicitly call out (it frames this as a two-way trim-vs-strip split; it's actually three-way).

Added `backend/util/ClipNameUtil.ts` (`normalizeClipName`, matching `.replace(/[* ]/g, '')` — the broader of the two pre-existing patterns) and pointed all seven of these sites at it. This is a **pure refactor** for `AbletonAdapter.ts`'s five sites (identical regex, just centralized) and a **behavior-preserving-for-current-data, latent-bug-fixing** change for `CsvUtil.ts`'s two sites — see below.

### Bonus finding: a real, currently-inert latent bug this closes

`CsvUtil.ts` built `ClipNameToInfoMap`'s keys by stripping spaces only (asterisks kept), while `AbletonAdapter.ts:441` (originally, now via the shared helper) looked that same map up by stripping **both** spaces and asterisks. If any CSV `Clip Name` ever contained an asterisk, the map would have been keyed with the asterisk still in it, but every lookup would strip it — a guaranteed key mismatch, silently returning `undefined` metadata for that clip's `playing_slot_index` resolution. **Verified empirically that this is inert today**: read the actual `Music Database.csv` directly (154 data rows) and confirmed zero rows contain a literal `*` anywhere, in any column, not just Clip Name. So this fix is a byte-for-byte no-op against current data, closing a bug that would otherwise silently reactivate the moment anyone adds an asterisk to a CSV clip name. Added a dedicated regression test for this (`backend/util/test/CsvUtil.test.ts`), mutation-tested by reverting to the old space-only regex and confirming it fails exactly as expected.

**Additional context confirming this is even more inert than initially stated, per general reviewer's finding**: `parseCsv`'s two-site fix is what actually matters (it runs on every backend startup, per `MusicDatabaseService.ts:20`). The _other_ `CsvUtil.ts` site this PR touches, `enrichRecommendations`, is currently **dead code** — its only call site (`MusicDatabaseService.ts:22-24`) is commented out, and this is already independently documented elsewhere in the codebase (`sim/test/music-database.test.ts`'s "does not attach recommendedClips — EnrichRecommendations is disabled in the real backend" test title). So half of this fix's `CsvUtil.ts` surface isn't just inert against current data — it isn't executed by the running backend at all today.

## What was deliberately NOT done (blocked)

The two trim-only sites — `MemoizedClipIndex` and `FindAllClipsInLoop` (`AbletonAdapter.ts`, both still `clip?.raw.name.trim() === clipName.trim()`) — are **unchanged**. These are the only sites where a CSV clip name is matched against Ableton's own live-reported clip name, and the ticket's own analysis is genuinely ambiguous about which direction is "correct" without knowing the real Live Set:

- If real Ableton clip names **never** contain asterisks or non-trivial internal spacing, today's trim-only matching is already correct, and aligning it to the fuller strip normalization would be a no-op — safe, but also pointless to guess at.
- If real Ableton clip names **do** contain asterisks (which the pervasive `[* ]`-stripping elsewhere in this file circumstantially suggests was a real, encountered problem for _some_ class of name at some point), then these two trim-only lookups are **currently silently broken** for those clips — `FindAllClipsInLoop` would return `[]`, and every caller (`queueClip`, `handleTimeout`, `stopOrRemoveClipFromQueue`) already has an empty-array guard, so the failure mode is "the clip can never be queued or found," not a crash — but it's a real, live, no-diagnostic-output functional bug in the core clip-triggering path.

I cannot tell which of these is true from the code, the CSV, or any doc in this repo — the CSV data says nothing about what's _inside Ableton's own Live Set file_, which is a separately human-maintained artifact.

### Supporting context for the human's decision (not a substitute for it)

- The real `Music Database.csv` contains **zero asterisks** anywhere, in any column (checked directly, all 154 rows).
- `sim/core/simulator.ts:58` **already independently implements** `const normalizeClipName = (clipName: string) => clipName.replace(/[* ]/g, '')` — the offline simulator, maintained separately per ADR-001, already converged on the fuller strip-normalization as "the" way to compare clip names. This is circumstantial (the sim's author may have been guarding against the same theoretical risk rather than an observed one), not proof either way, and `sim/` is out of this ticket's allowed files regardless — noted here only as context, not touched.

### The specific question for the human

**Do the actual clip names inside the Ableton Live Set (as they literally appear in Live's Clip View / the `.als` file — not the CSV) ever contain any of the following, in a way that could differ from the corresponding CSV `Clip Name` entry?**

- Asterisks, or spacing beyond simple leading/trailing whitespace (the original question — exactly what `ClipNameUtil.normalizeClipName` strips today).
- **Broadened per audio-ableton-reviewer's review** (`docs/agent-notes/wow-031-audio-ableton-reviewer-signoff.md`), since the human's attention is already needed here: smart/curly quotes (`'`/`'`) vs. straight quotes (`'`) — a common split when names get copy-pasted between apps, and the current regex (`[* ]`) wouldn't catch it either; non-breaking spaces (` `) — not matched by a literal-space regex; case differences.

- **If any of the above ever differs**: `MemoizedClipIndex` and `FindAllClipsInLoop`'s trim-only matching should switch to a normalization that also handles whichever of these is real — a follow-up change to this same PR (or a fast-follow ticket), and it _would_ change live matching behavior for those specific clips (in the direction of making them findable, where they currently silently aren't).
- **If none of the above is ever true**: today's trim-only lookups are already correct, this PR's refactor + latent-bug fix stands as the complete, sufficient fix for this ticket, and it can be marked ready for review as-is.

## Validation (of the landed portion)

- [x] `yarn lint` clean
- [x] `npx tsc --noEmit` (root) clean
- [x] `npx tsc --noEmit -p backend/tsconfig.json` clean
- [x] `yarn test` — 95/95 (84 + 11 new: 8 `ClipNameUtil` tests, 3 `CsvUtil` tests)
- [x] `yarn build` clean

All new tests independently mutation-tested: `ClipNameUtil.normalizeClipName`'s own tests are self-evidently load-bearing (each asserts a specific transformation); the two `CsvUtil.test.ts` tests targeting the latent-bug fix were verified by reverting `CsvUtil.ts` to the old space-only regex and confirming both fail exactly as predicted, then restoring.

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `Arduino/`, `.env` — N/A (read-only inspection of the CSV, no edits)
- [x] No new/renamed socket.io event names
- [x] No new dependencies
- [x] Clip-triggering path (musical mapping) — **audio-ableton-reviewer sign-off mandatory per this ticket's safety notes** — requested in PR; scope for this specific review is the landed refactor + latent-bug-fix only, since the actually-behavior-changing question (trim-only sites) is explicitly not part of this PR
- [x] The two sites where a live behavior change would actually occur (`MemoizedClipIndex`, `FindAllClipsInLoop`) are untouched — no live musical mapping/timing assumption changes in this PR

## Status

**DRAFT / BLOCKED.** Not ready for the standard gate — the ticket's own acceptance criteria require _both_ "single normalization helper used at all seven-plus comparison sites" (7 of the ~9 total sites are done; the 2 Live-matching sites are blocked) _and_ "human confirms the Live naming convention before merge." Requesting that confirmation via this PR's description. If the answer is "no asterisks in Live," this PR is otherwise complete and can be marked ready-for-review with no further code changes. If "yes," a follow-up commit on this same branch will align the two remaining sites and this note will be updated.
