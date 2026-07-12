# WOW-025 — test-engineer review (PR #21)

Date: 2026-07-12
Reviewer: test-engineer subagent
Branch: `feat/wow-025-csv-validation-tests` (reviewed `gh pr diff 21 --repo Amsvartner/witches-of-wubb-v2` and `git diff main..HEAD` directly on a local checkout of the branch)
Scope: read-only test-engineer review of a data-integrity validation suite. This PR is an intentional draft, titled `[BLOCKED]`, with expected-red CI: one assertion in the new suite must fail until a human corrects `src/assets/Music Database.csv` line 74. That red state is the ticket's own acceptance criterion (`docs/TICKETS_002_BUGS.md`, WOW-025: "fail on the current CSV until the human corrects line 74; after correction, full suite green"), not a defect in this PR — I have not treated it as one.

**Verdict: APPROVE-WITH-NITS**

---

## Required

None.

---

## Nits

1. **`Key in TRANSPOSITIONS` has a theoretical prototype-chain gap.** Flagged by GitHub Copilot's automated review on this PR (inline comment on `MusicDatabase.validation.test.ts` around the Key-transposition check); I independently agree it's valid. `KeyTranspositionService.TRANSPOSITIONS` is a plain object literal, so `row.Key in TRANSPOSITIONS` is true for both own and inherited keys — a Key value literally equal to `"toString"` or `"constructor"` would pass the check even though it isn't a real Camelot key. Zero real-world impact today (every Key in the CSV is Camelot notation like `"1A"`/`"6B"`), but for a suite whose entire purpose is catching silent wrong-data, `Object.hasOwn(KeyTranspositionService.TRANSPOSITIONS, row.Key)` would be the more defensible form.
2. **Two O(n²) spread-copy accumulations**, also flagged by Copilot (two separate inline comments) and also valid: the RFID-uniqueness and clip-name-uniqueness checks build per-key arrays via `[...(byX.get(key) ?? []), value]` on every row, copying the array each time instead of pushing into a mutable one. At ~150 CSV rows this is sub-millisecond regardless; worth fixing opportunistically, not worth a revision cycle on its own.
3. **The `--no-verify` justification is accurate but slightly oversold.** I read `.husky/pre-commit` and confirmed it does exactly what the commit message/PR body claim: `npx lint-staged` then `npm test` gated on `git diff --quiet HEAD $REF -- src` (effectively "any diff under `src/` vs. HEAD"). Given this ticket's acceptance criteria require one assertion to stay red, that gate is genuinely unsatisfiable for a commit adding a file under `src/`. However, the framing ("there's no fix available to an agent... no way to commit without bypassing the hook") overstates it slightly: `sim/` is a sibling of `src/` at the repo root, outside the hook's `-- src` pathspec, and `sim/test/music-database.test.ts` was one of the ticket's own two named alternative homes. A raw-row duplicate check placed there (reading the `csvText` that file already loads via `fs.readFileSync`, without routing through the collapsing `buildMusicDatabase` helper) would have avoided the hook entirely. This doesn't make the actual choice wrong — the dedicated `src/assets/test/` file is independently well-justified (it's the ticket's explicitly pre-approved third option, and it cleanly separates CSV-level integrity checks from consumer-specific map tests) — but the stated rationale would be more precise as "no way to commit _this file, in this location_" rather than implying no location anywhere avoided it. Not blocking: it's a single, clearly documented commit; lint-staged ran and passed before the test step blocked it; and I independently re-verified lint/tsc/build/the-other-73-tests are all green (below), so the bypass carried no hidden risk.

---

## Summary

Confirmed everything the PR and its agent-note claim, by running the checks myself rather than trusting the write-up. `yarn test src/assets/test/MusicDatabase.validation.test.ts` → 5 passed, 1 failed (6 total), failure naming both colliding RFIDs (`e280f3372000f00003effc41`, `e280f3372000f00003effc3f`) under stripped key `"FlashbackDrums10A135"`. Full `yarn test` → 73 passed, 1 failed (74 total), matching GitHub CI's actual failed run byte-for-byte. `yarn lint`, `npx tsc --noEmit`, `yarn build` all clean. `git diff main..HEAD` touches exactly two files (the test file and the agent-note), and `backend/util/CsvUtil.ts` / `src/util/ClipDatabaseUtil.ts` / `src/assets/Music Database.csv` are byte-identical to `main` — zero production or CSV changes, confirmed directly. The crux of the ticket — testing raw, uncollapsed CSV rows rather than a pre-built map that would hide the very collision it needs to catch — is correctly implemented: the test imports the same raw `~/assets/Music Database.csv` (`@rollup/plugin-dsv`, no dedup) that `ClipDatabaseUtil.ts` uses before folding rows into maps, and I confirmed both alternative homes the ticket suggested (`src/util/test/ClipDatabaseUtil.test.ts`, `sim/test/music-database.test.ts`) do operate on already-collapsed maps and would indeed have hidden the bug. All five ticket-named checks are present and genuine, not vacuous — I specifically exercised the icon-existence check's `fs.existsSync` logic against both a real and a fabricated filename to confirm it can actually fail. The valid-rows filter exactly mirrors `CsvUtil.parseCsv`'s own guard, and the cited "Wyvern Venom" reserved-row example checks out (plus I found over a dozen more rows the filter correctly excludes, which strengthens rather than weakens the case for it). No Required findings. Three Nits above, none blocking. The CSV still containing the duplicate is the ticket's intended, documented state — not a finding.

---

## Supporting detail

### Validation commands run

- `yarn test src/assets/test/MusicDatabase.validation.test.ts` → **5 passed, 1 failed (6 total)**, 599ms. Failure: `has a unique space-stripped clip name per row...`, diff shows `["FlashbackDrums10A135", ["e280f3372000f00003effc41", "e280f3372000f00003effc3f"]]`.
- `yarn test` (full repo suite) → **73 passed, 1 failed (74 total)**, 13/14 test files green. Cross-checked against GitHub Actions CI run `29177414467` (`gh run view 29177414467 --repo Amsvartner/witches-of-wubb-v2 --log-failed`) — identical failure, identical counts, identical RFID pair in the diff output. This also confirms CI runs independently of the local `.husky/pre-commit` hook: the workflow (`.github/workflows/ci.yml`) runs `yarn install --frozen-lockfile`, `yarn lint`, `yarn test`, `yarn build` as explicit steps with no git-hook invocation (hooks fire on `git commit`, which CI never performs against a checked-out PR head), and empirically the CI run reproduced the exact same single failure regardless of how the commit was made locally.
- `yarn lint` → clean (only the pre-existing, unrelated "React version not specified in eslint-plugin-react settings" warning).
- `npx tsc --noEmit` → clean, exit 0. Confirms the PR's claimed `TS2554` fix: grepped the test file and confirmed every `expect(...)` call is single-argument (no `expect(value, message)` remnants).
- `yarn build` → clean, `tsc && vite build` succeeds, 160 modules transformed.
- `git diff --stat main..HEAD` → exactly two files, both new, zero deletions: `docs/agent-notes/wow-025-test-engineer-csv-validation.md` and `src/assets/test/MusicDatabase.validation.test.ts` (167 insertions total).
- `git diff main -- backend/util/CsvUtil.ts src/util/ClipDatabaseUtil.ts "src/assets/Music Database.csv"` → **empty output**. Byte-identical to `main`; zero production/CSV changes, confirmed directly rather than taken on trust.

### Crux check — raw rows, not a collapsed map

Confirmed. `src/assets/test/MusicDatabase.validation.test.ts` imports `csv from '~/assets/Music Database.csv'` — the identical import `src/util/ClipDatabaseUtil.ts` uses, and specifically the raw form _before_ `ClipDatabaseUtil.ts` folds rows into `rfidToClipMap`/`clipNameToInfoMap` via `CsvUtil.parseCsv` (both maps are keyed by RFID or space-stripped clip name respectively, and both collapse same-key rows by last-write-wins — confirmed by reading `backend/util/CsvUtil.ts:21-40`, which unconditionally overwrites `ClipNameToInfoMap[clipName?.replace(/[ ]/g, '')]` with no collision check). The import itself goes through `@rollup/plugin-dsv` (`vite.config.ts:6,11`), a straightforward CSV-to-object-array parser with no deduplication — one object per data row.

I read both files the ticket offered as alternative homes to confirm the PR's stated reason for not using them:

- `src/util/test/ClipDatabaseUtil.test.ts` operates purely on `ClipDatabaseUtil.rfidToClipMap`/`clipNameToInfoMap` — the already-collapsed maps. `Object.keys(clipNameToInfoMap)` would show exactly one entry for `FlashbackDrums10A135` (whichever row parsed last), with no trace that two source rows contributed to it. A duplicate-detection test built on this map cannot see the collision.
- `sim/test/music-database.test.ts` operates via `buildMusicDatabase(csvText)` from `sim/core/music-database.ts`, which the PR states collapses the same way. The existing "Wyvern Venom" test in this file (confirmed at lines 28-31) already demonstrates the pattern of testing through the built map rather than raw rows.

Both claims check out. The dedicated `src/assets/test/` file (the ticket's own third named option) is the only one of the three that reads rows before any collapsing happens.

### Coverage vs. the five named checks

All five present in the 72-line test file, each a genuine check against real data (not vacuous):

1. **Unique RFID per row** — groups `validRows` by `RFID`, flags groups with length > 1. Passes today; the real CSV has no RFID collisions among valid rows.
2. **Unique space-stripped clip name per row** — same accumulation pattern keyed by `stripSpaces(row['Clip Name'])`. Fails today, exactly as the ticket requires.
3. **`Key` present in `KeyTranspositionService.TRANSPOSITIONS` when non-blank** — verified `TRANSPOSITIONS` (`backend/service/KeyTranspositionService.ts:1-343`) is a real exported object keyed by Camelot notation (`'6B'`, `'8B'`, etc.). Passes today. See Nit 1 re: `in` vs. `Object.hasOwn`.
4. **`Clip Type` present in the `ClipTypes` enum** — verified the enum (`backend/type/ClipTypes.ts`: `Vox`, `Melody`, `Bass`, `Drums`) and that line 74's actual CSV value is `Melody`, a real member — so this check correctly does _not_ additionally flag that row; only the name-collision check should, and does.
5. **Icon/Asset Name exists under `public/ingredients/` when non-empty** — confirmed this is a real filesystem check, not vacuous, by independently exercising the identical `fs.existsSync(path.join(process.cwd(), 'public', 'ingredients', name))` logic in a standalone node script against both a real filename (`potion_of_superior_healing.png` → `true`) and a fabricated nonexistent one (`definitely_missing_file_xyz.png` → `false`). The check can and does distinguish a real failure from a pass.

### Valid-rows filter

`validRows = rows.filter((row) => row['RFID']?.trim() && row['Clip Name']?.trim())` (test file line 13) is an exact mirror of `CsvUtil.parseCsv`'s own row guard (`backend/util/CsvUtil.ts:21`: `if (clipName?.trim() && rfid?.trim())`) — same two fields, same trim-then-truthy semantics, same fields gating map entry. This is the right scope: rows that never enter `RFIDToClipMap`/`ClipNameToInfoMap` in production can't corrupt those maps, so validating them serves no purpose and would produce false positives.

Confirmed the cited "Wyvern Venom" row exists exactly as the PR/agent-note describe: CSV line 28, RFID `e280f3372000f00003effc74`, `Clip Name` blank, already asserted in `sim/test/music-database.test.ts:28-31` ("RFID present but no clip assigned"). Beyond that one cited example, I found the filter matters considerably more broadly than claimed: the real CSV has over a dozen additional RFID-present/Clip-Name-blank rows (a run of tarot-card-themed placeholder rows near the end of the file, plus "Four of wisdom" and "The fool"). Without the outer `validRows` filter, the clip-name-uniqueness check would additionally explode with a mass false-positive collision at the empty-string key across all of these unrelated rows, on top of the one real bug. The scoping is correct, and if anything the PR under-sells how necessary it is.

Also verified the two lines the ticket and PR body reference by direct inspection of the raw CSV:

- **Line 72**: `e280f3372000f00003effc41,71,potion of superior healing,TRUE,,ROSHIMA,Flashback,Flashback Drums 10A 135,Drums,Drums (standard kit),1A,Minor,1,135,potion_of_superior_healing.png`
- **Line 74**: `e280f3372000f00003effc3f,73,bone powder,TRUE,,ROSHIMA,Flashback,Flashback Drums 10A 135,Melody,Synth,1A,Minor,1,135,bone_powder.png`
- **Line 95** (the naming-pattern comparison cited in the ticket): `e20042143c90641704c3c151,94,candle with stickers on it,FALSE,,ROSHIMA,Flashback,Flashback Bass 1A 135,Bass,Bass,1A,Minor,1,135,candlewstickers.png`

All match the ticket's and PR's descriptions exactly, including the ingredient names, types, and instrument fields.

### Agent-note cross-check

`docs/agent-notes/wow-025-test-engineer-csv-validation.md`'s claims — 5/6 pass, the specific RFID pair, line 72 ("potion of superior healing"/Drums) vs. line 74 ("bone powder"/Melody), the dedicated-file rationale over the two suggested existing files, zero production changes, the `TS2554`/`expect(value, message)` fix — all check out against direct inspection of the CSV, the source files, and my own test runs. No discrepancies found between what the note claims and what I independently verified.

### Pipeline note

GitHub Copilot's automated PR reviewer has already run on this PR (review `PRR_kwDOTPyclc8AAAABFuhHSA`, 3 inline comments) — folded into Nits 1 and 2 above rather than left for a separate round, since I was already reading the same lines. No comments from a human reviewer are present yet.
