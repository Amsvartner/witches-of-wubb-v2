# WOW-031 PR #29 (clip-name normalization, partial landing) — audio-ableton-reviewer sign-off

- Reviewer: audio-ableton-reviewer (Claude Sonnet 5, specialist sign-off phase of the WOW pipeline — **required** per this ticket's own safety notes: "changes how clips are located in the Live set — the core musical mapping. audio-ableton-reviewer sign-off mandatory.")
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #29 (draft), base `feat/wow-021-clip-cache-invalidation` @ `0fe8f6c2b6e553977dbe56b54d56358c8bf284cd`, head `feat/wow-031-clip-name-normalization` @ `5c73b4e0a3f77754c90d3bb8dbf9984159d2d023`.
- Method: read-only, no edits, no live hardware/Ableton. Traced the actual runtime provenance of every string operand at all 5 refactored comparison sites through `IncomingEvents.ts` and the `playing_slot_index` listener, rather than trusting the PR's own framing.

## Verdict: **APPROVE (approve-with-nits)** for what is actually in this diff

The landed portion does not change clip-triggering, clip-matching, transposition, phrase-leader, trigger-order, or timeout behavior. Safe to leave open as a blocked draft. Two non-blocking nits should be fixed before marking ready-for-review, and one operational risk (unrelated to the code itself) is flagged separately below.

## Important process/methodology note

Partway through this review, the local working tree's HEAD moved out from under the reviewer — `git reflog` showed `checkout: moving from feat/wow-031-clip-name-normalization to main` then `to feat/wow-029-wifi-reconnect`, caused by the orchestrator's own concurrent foreground work moving on to the next ticket (WOW-029) while this review was still running against the shared checkout. The reviewer caught this because file contents contradicted the PR diff, re-verified via `git rev-parse HEAD` + `git reflog`, and from that point on abandoned the `Read` tool against the working tree entirely — every finding below is sourced from `git show <pinned-sha>:<path>` against the exact base/head SHAs from `gh api`, which is immune to concurrent checkout changes. **Orchestrator's response**: this is a real, valid finding about how this run has been sequencing foreground branch-switches against still-running background reviewers. Holding off on further branch switches until all currently in-flight reviewers (for both WOW-031 and WOW-029) complete, and adopting isolated worktrees for background review subagents going forward to prevent recurrence, per the reviewer's own recommendation below.

## Point-by-point findings

**1. PR diff.** `gh pr diff 29` and an independent `git diff --stat` between the pinned base/head SHAs agree exactly: 6 files — `backend/adapter/AbletonAdapter.ts` (modified), `backend/util/ClipNameUtil.ts` (new), `backend/util/CsvUtil.ts` (modified), `backend/util/test/ClipNameUtil.test.ts` (new), `backend/util/test/CsvUtil.test.ts` (new), the standard agent-note (new). Nothing else changed.

**2. `MemoizedClipIndex` / `FindAllClipsInLoop` untouched.** Confirmed byte-for-byte via a full pinned read of `AbletonAdapter.ts` @ head. Both functions still do `clip?.raw.name.trim() === clipName.trim()` — trim-only, exactly as before. Neither appears in any diff hunk. These are the functions that actually resolve a CSV clip name to a real `Clip` object for `.fire()`/queueing — every call site that depends on them is unaffected. **Verdict: safe.**

**3. Do the 5 refactored `AbletonAdapter.ts` sites ever compare against `clip.raw.name`? — the PR's own safety narrative has a real, correctable inaccuracy.** Traced the actual runtime provenance of every operand at all 5 sites end to end:

| Site                       | LHS provenance                                                                                           | RHS provenance                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| queue dedup                | CSV                                                                                                      | CSV                                                                 |
| `isClipPlaying`            | **Ableton-raw** (`playingClip.clipName`, set from `clip?.raw.name` in the `playing_slot_index` listener) | CSV                                                                 |
| phrase-leader match        | **Ableton-raw**                                                                                          | **Ableton-raw** (`phraseLeader` always sourced from `playingClips`) |
| `isClipQueued`             | CSV                                                                                                      | CSV                                                                 |
| `clipNameToInfoMap` lookup | **Ableton-raw** (lookup key = `clip?.raw.name`, normalized)                                              | CSV (the map itself)                                                |

3 of 5 sites **do** involve Ableton-raw data, contradicting the agent-note's/PR body's claim that "both sides of every one of these comparisons originate from Music Database.csv." **This does not change the safety verdict**: at all 5 sites, the normalization regex applied to each operand is byte-for-byte unchanged by this PR (pure code motion from inline `.replace(/[* ]/g, '')` to the identical pattern inside `ClipNameUtil.normalizeClipName`). The safety argument that actually holds is "the regex didn't change," not "these sites never see Ableton data." Also confirmed the new `!== undefined` guards produce identical results to the old optional-chaining short-circuit in every case, given `clipName` is a non-optional `string` at the type level.

**4. Trigger order / key-leader order / transposition / phrase-leader / warp / BPM / category enums.** `git diff` between pinned base and head, scoped to `KeyTranspositionService.ts`, `PhraseLeaderService.ts`, `ClipTypes.ts`, `IncomingEvents.ts`, `MusicDatabaseService.ts`: zero output, all five files byte-identical. `TRIGGER_ORDER`/`KEY_LEADER_ORDER` untouched. **Verdict: confirmed zero musical-logic content in this diff.**

**5. `CsvUtil.ts` latent-bug-fix — collision risk.** Independently verified the CSV data claim: `git show 5c73b4e:"src/assets/Music Database.csv"` → 154 data rows, 0 asterisks anywhere, in any column. Given that, the old and new normalizations are mathematically guaranteed to produce byte-identical output for every current row — not just empirically inert, inert by construction. Forward-looking: yes, this broadens what can collide if a future CSV edit adds an asterisk whose stripped form matches another row (the PR's own `CsvUtil.test.ts` third test demonstrates exactly this, second-write-wins). Tempered by: (a) this collision _shape_ already existed structurally via the `AbletonAdapter.ts` convention this PR is CSV-aligning to, not a new risk invented here; (b) CSV edits are human-gated per `AGENTS.md`, outside this PR's reach.

**6. Is the human question complete?** Correctly scoped to exactly what `normalizeClipName` strips. Suggest broadening while the human's attention is already there: smart/curly vs. straight quotes (the PR's own test fixture uses a straight apostrophe — a real-world copy-paste split this regex wouldn't catch), non-breaking spaces (` `, not matched by `[ ]`), case differences. Also: a reassuring point _for_ the implementer's blocking decision — since `playingClips[pillar].clipName` only gets populated _after_ a clip has already successfully `.fire()`d via the trim-only `MemoizedClipIndex`/`FindAllClipsInLoop` gate, an asterisk-related mismatch would manifest as "clip silently never plays" _before_ it could ever reach the 3 Ableton-raw-touching sites — making those two functions the correct and sufficient single chokepoint to block on.

**7. Does this PR need mandatory sign-off on its own merits, separate from the eventual follow-up?** Yes — a reviewer taking "same regex, just centralized" at face value would have missed that 3 of 5 sites touch Ableton-raw data and that the PR's own written justification is wrong about which. The conclusion (safe) still holds, but for a different, more specific reason than the one written down. That gap is exactly what a specialist trace exists to catch, even on an ostensibly mechanical refactor.

## Nits (non-blocking, should be fixed before ready-for-review)

1. **Correct the provenance claim** in the agent-note and PR body — "both sides originate from CSV" is false for `isClipPlaying`, the phrase-leader match, and the `clipNameToInfoMap` lookup. The safety argument that actually holds is "the normalization regex is unchanged," not "these sites never see Ableton data."
2. **Broaden the human question** per finding 6 (quotes, non-breaking whitespace, case) while the human's attention is already on this.

## Process risk flagged to the human (not a musical-mapping finding, but material)

The shared checkout was moved to a different ticket's branch partway through this review by concurrent orchestrator activity. The reviewer recovered fully via pinned-SHA reads, so these findings are sound, but the same race could silently corrupt a less careful agent's work in this unattended pipeline. Recommended fix: isolated `git worktree` per concurrent background agent (the Agent tool's `isolation: "worktree"` option exists for exactly this).

## Summary

Landed diff (6 files): zero clip-triggering/matching/transposition/trigger-order/phrase-leader/timeout/category-enum logic touched; `MemoizedClipIndex`/`FindAllClipsInLoop` confirmed byte-for-byte untouched. CSV-side change verified inert against the real 154-row CSV by construction. One factual correction owed in the docs (3 of 5 sites touch Ableton-raw data, not CSV-only as claimed — though the actual code remains safe for an unaffected reason). **APPROVE (approve-with-nits)** — safe to leave open as a blocked draft exactly as structured; do not let anyone align `MemoizedClipIndex`/`FindAllClipsInLoop` on a guess.
