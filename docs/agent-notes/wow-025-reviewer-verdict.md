# WOW-025 — reviewer verdict: PR #21 (`feat/wow-025-csv-validation-tests`)

Reviewed: `main...origin/feat/wow-025-csv-validation-tests` (single commit `14296c5`), against ticket WOW-025 (`docs/TICKETS_002_BUGS.md`), `AGENTS.md`, `docs/CODING_GUIDELINES.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`. Read-only review; nothing edited.

## Verdict: APPROVE-WITH-NITS

The diff is exactly what it claims to be, and every checkable claim in the PR body was independently reproduced. Nothing here blocks. Two should-fix items (disclosure accuracy, forward-looking process) and one cosmetic nit.

## Blocking

None.

## Should-fix

1. **"Documented in three places" is only true for two.** The commit message says the `--no-verify` use is "documented here, in the PR body, and in the run report." I read `docs/agent-notes/wow-025-test-engineer-csv-validation.md` in full and grepped it for `verify|hook|commit|husky|bypass|skip` — no hits. The run report never mentions the hook or the bypass. Commit message and PR body do cover it, in detail. Fix: either add a line to the agent-note, or stop claiming three places.
2. **Process note for future tickets, not this one.** A pre-commit hook bypass is the kind of thing this repo's stop-and-ask spirit (`AGENTS.md`: conflicting instructions) points toward surfacing to the human _before_ acting, not only disclosing after the fact in the commit message. This instance's substance held up under independent verification (see below), and the two alternatives the PR body rejects — `it.fails()` inversion and `.skip` — are both genuinely worse for the reasons given (green-today/red-after-fix is a backwards signal that depends on someone remembering to un-invert it; `.skip` hides the bug with no automatic flip at all). A third option, teaching `.husky/pre-commit` to allow a declared-expected failure, would itself be an out-of-scope shared-tooling change (not in this ticket's allowed files) and overkill for a one-off. So I agree `--no-verify` was the least-bad move available inside this ticket's scope — but the next ticket that hits this same conflict should default to asking first.

## Nits

1. PR body is missing the literal `## Out of scope / deliberately not done` heading required by `.github/pull_request_template.md`. The content substantively exists (under "Why this is a draft, and what unblocks it" and "Decisions / questions for the human"), so this is cosmetic, not a completeness problem in substance — but worth adding before this PR ever goes through the real gate.

## What I verified independently

- **Scope**: `git diff main...origin/feat/wow-025-csv-validation-tests --stat` touches exactly two files, both additive (no deletions): `src/assets/test/MusicDatabase.validation.test.ts` (72 lines) and `docs/agent-notes/wow-025-test-engineer-csv-validation.md` (95 lines, correctly named per `AGENTS.md`'s `wow-XXX-<role>-<topic>.md` convention). Matches the ticket's allowed files (`src/assets/test/**`) plus the standing agent-notes convention.
- **CSV untouched**: `git diff ... -- "src/assets/Music Database.csv"` is empty.
- **Parser/production code untouched**: `git diff ... -- "backend/util/CsvUtil.ts" "src/util/ClipDatabaseUtil.ts"` is empty.
- **No dependency changes**: diff stat confirms no `package.json`/lockfile touched.
- **No test-inversion tricks**: grepped the new test file for `.only`, `.skip`, `.todo`, `it.fails`, `xit`, `xdescribe` — none present. The failure is a real, unmodified assertion.
- **PR body accuracy — reran everything myself on the branch**:
  - `yarn test src/assets/test/MusicDatabase.validation.test.ts` → 5 pass, 1 fail. The failure names RFIDs `e280f3372000f00003effc41` and `e280f3372000f00003effc3f` under stripped key `FlashbackDrums10A135` — exact match to the PR body's claim.
  - `yarn test` (full suite) → 73 passed, 1 failed (74 total) — exact match.
  - `npx tsc --noEmit` → clean, exit 0.
  - `yarn lint` → clean, exit 0.
  - `yarn build` → clean, exit 0.
- **Import/architecture hygiene**: the new test's bare `backend/service/KeyTranspositionService`, `backend/type/ClipTypes`, `backend/type/CsvRow` imports resolve (tsc clean, tests pass) and match existing precedent — `src/util/ClipDatabaseUtil.ts` already imports `backend/util/CsvUtil`, `backend/type/ClipNameToInfoMapType`, `backend/type/RFIDToClipMapType` the same bare-alias way from `src/`. `ClipTypes` is a real runtime `enum` (correct as a value import, `Object.values(ClipTypes)` requires that); `CsvRow` is `Record<string, string>`.
- **The `--no-verify` claim itself**: read `.husky/pre-commit` on this branch — `npx lint-staged` then, unconditionally if `src/` changed, `npm test`, failing the commit on any red test. Since this ticket's acceptance criteria requires exactly one red test until a human edits the CSV, a normal commit could not succeed without either bypassing the hook or weakening the assertion. The commit message discloses `--no-verify` and the reasoning in detail; the PR body has a dedicated "A pre-commit hook note" section saying the same. Confirmed accurate (short of the "three places" overstatement above).
- **Draft/blocked hygiene**: `gh pr list --repo Amsvartner/witches-of-wubb-v2` shows labels are empty on all 21 PRs in this repo's history — never used in practice, even though `gh label list` shows the GitHub default set exists (none of which fit "blocked pending human data decision" well: closest are `invalid`/`wontfix`, neither accurate). `gh issue list` confirms Issues are disabled repo-wide, so a linked issue isn't an available option at all. `docs/DECISIONS_NEEDED.md` is scoped to cross-cutting product/architecture/deployment decisions (confirmed by reading it in full) and is not in this ticket's allowed files, so a DECISIONS_NEEDED.md entry would itself have been scope creep. Given all three of those, draft + `[BLOCKED]` title-prefix + an explanatory PR body section is not just adequate but the most expressive option this repo's actual conventions make available. No change needed.
- **Safety triage**: this diff touches no volume, lights, OSC/MIDI/Art-Net emission, timing, or mapping logic — it's a new read-only test file reading the existing CSV via the existing import path. No specialist (audio-ableton-reviewer / hardware-safety-reviewer) sign-off is required for _this_ diff. Note for later: the ticket's own safety note ("audio-ableton-reviewer sign-off on the corrected row") attaches to whatever future commit actually edits CSV line 74, not to this PR.

## Summary

One new, additive, read-only test file plus its matching agent-note; zero production/parser changes; CSV genuinely untouched. Every factual claim in the PR body that I could check — the 5/6 and 73/74 pass counts, the two named RFIDs, lint/tsc/build cleanliness, the hook's blocking behavior, the absence of test-inversion tricks, the import precedent — checked out exactly. The only real finding is a small overstatement in the disclosure trail (the "run report" doesn't actually mention the hook bypass, despite the commit message saying it does); everything else is process guidance for next time or template cosmetics. The PR remains correctly un-mergeable pending the human CSV decision — that's the intended state, not a defect.
