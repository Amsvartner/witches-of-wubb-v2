# WOW-028 (Arduino WiFi secrets) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, phase E of the WOW ticket pipeline)
- Date: 2026-07-12
- Review target: `git diff main...feat/wow-028-wifi-secrets` (PR #15)
- Base: `main` @ 7ba9d93 (merge-base confirmed) · Head: `feat/wow-028-wifi-secrets` @ 78fbce5 (matches `origin/feat/wow-028-wifi-secrets` exactly, no ahead/behind)
- Ground truth: `AGENTS.md` v0.4 (WOW-028's Arduino/-touch is a ticket-scoped exception, per this review's framing — the allowed-files list is the approval), WOW-028 in `docs/TICKETS_002_BUGS.md`, `docs/CODING_GUIDELINES.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, reviewer profile
- Method: read-only, nothing edited or committed besides this note. Every claim below independently re-verified rather than trusted from the PR body or `docs/agent-notes/wow-028-creative-tech-integrator-wifi-secrets.md`'s self-report: full-tree grep for all 4 removed credential pairs at the branch tip, `git check-ignore` exercised against real throwaway files (not just the pattern text), `yarn lint`/`yarn test` run fresh at HEAD, PR review-thread state queried directly via `gh api graphql`. No compile/flash attempted — no agent has that capability, and it's correctly out of this ticket's scope.

## Verdict: **approve-with-nits**

- hardware-safety-reviewer: **APPROVE recorded** @ `78fbce5` (`docs/agent-notes/wow-028-hardware-safety-reviewer-signoff.md`) — this note was absent when this review began (it runs in parallel, per the pipeline design) and landed partway through; re-read in full once it appeared rather than left stale. Its findings (per-device IP untouched, `WiFi.config`/`WiFi.begin` call sites and retry/timeout logic untouched, zero volume/gain/strobe/flicker/brightness keyword hits anywhere in the diff, pillar IP map untouched, `.gitignore` behavior verified) independently corroborate §2, §3, and §6 of this review — same conclusions, reached separately. The gate condition this review would otherwise impose is therefore already satisfied. ✓
- test-engineer (phase C, informational cross-reference): **approve-with-nits** recorded @ `78fbce5` (`docs/agent-notes/wow-028-test-engineer-review.md`) — confirms no automated-test gap for this diff, independently re-ran `git grep`/`check-ignore`/lint/test **and `yarn build`** (see nit 4 below), and logs two non-blocking follow-up recommendations (a source-text regression-guard test for this bug class; a repo-wide secret-scanning tooling gap) correctly scoped as new-ticket material rather than fixes owed by this PR. Not re-litigated here.
- No blocking findings. Should-fixes below are process/doc-drift items outside the actual credential change — the security fix itself is correct, complete, and independently verified from three separate review passes (hardware-safety-reviewer, test-engineer, this review) that converge on the same facts.

## 1. Scope / authorization

All 8 changed files fall within WOW-028's allowed-files list, or the repo-wide agent-notes convention (`AGENTS.md` → "Agent workflow files": `docs/agent-notes/` is standard per-ticket handoff output, not something that needs separate listing):

| File                                                                      | Allowed?                               |
| ------------------------------------------------------------------------- | -------------------------------------- |
| `.gitignore`                                                              | explicit                               |
| `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino`                           | explicit                               |
| `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino`                         | explicit                               |
| `Arduino/Unit_RFID_M5Core/secrets.h.example` (new)                        | matches `Arduino/**/secrets.h.example` |
| `Arduino/ArtnetWifiFastLED/secrets.h.example` (new)                       | matches `Arduino/**/secrets.h.example` |
| `docs/DECISIONS_NEEDED.md`                                                | explicit                               |
| `docs/HARDWARE_INTEGRATION.md`                                            | explicit                               |
| `docs/agent-notes/wow-028-creative-tech-integrator-wifi-secrets.md` (new) | standard handoff convention            |

No drive-by changes. Confirmed untouched: `backend/**`, `src/**`, `src/assets/Music Database.csv`, `.env`, `backend/event/IncomingEvents.ts` (frozen pillar IP map), and — inside the two sketches themselves — the per-device `IPAddress ip(...)` lines are byte-identical to `main` in both files (that extraction is WOW-030's scope, correctly deferred). This diff is also the explicit ticket-scoped exception to AGENTS.md's "never modify `Arduino/` without approval" rule; the diff stays entirely inside the ticket's allowed-files list, so the exception holds.

## 2. Zero behavior change (independently verified, not just trusted)

Diffed both `.ino` files at `-U10` and separately grepped every WiFi-related symbol (`WiFi\.`, `ssid`, `password`, `WIFI_`) in old (`main`) vs. new (branch tip):

- `WiFi.config(ip)` — unchanged, same call, same `ip` value, both sketches.
- `WiFi.begin(ssid, password)` — unchanged signature; `ssid`/`password` are still the same-named `const char*`/`const char *` locals, only their initializers changed (string literal → macro from `secrets.h`).
- `while (WiFi.status() != WL_CONNECTED)` — unchanged, both sketches.
- `udp.begin(WiFi.localIP(), remotePort)` — unchanged.
- `Serial.println(ssid)` (`ArtnetWifiFastLED.ino` boot log) — unchanged; still prints whatever `ssid` resolves to (pre-existing behavior, see nit 3).
- `IPAddress ip(...)` — untouched, byte-identical to `main` in both files.
- The only structural change in either file: one `#include "secrets.h"` line, the credential block's initializers swapped literal→macro, comments updated, and the three commented-out (already-inert, non-executing) alternate-network blocks deleted outright. Confirmed via full-file diff that no other line differs from `main`.

This independently confirms the "zero behavior change" claim — the diff is credentials-source-only, nothing else moved.

## 3. Credential hygiene

Ran `git grep -F` across the full branch-tip tree for all 4 removed SSID/password pairs (the active pair plus the three commented-out alternates — 8 literal strings total, not reproduced here). Zero matches for any of the 7 non-SSID-name strings. The one exception: the active network's **name** (not its password) still appears in `docs/ARCHITECTURE.md:12`, `docs/PROJECT_BRIEF.md:22`, `docs/TICKETS_002_BUGS.md:238`, and two agent-notes files. Diffed each against `main` — byte-identical, **not introduced by this PR**. An SSID is broadcast in the clear by the AP itself regardless of repo contents, so its presence in prose docs isn't the leak this ticket closes (the password is); those files are also outside WOW-028's allowed-files list, so leaving them alone was correct, not an oversight.

`.gitignore` — verified behavior, not just the pattern text:

- `git check-ignore -v Arduino/Unit_RFID_M5Core/secrets.h` → `.gitignore:30:Arduino/**/secrets.h`, exit 0 (ignored).
- `git check-ignore -v Arduino/ArtnetWifiFastLED/secrets.h` → same rule, exit 0.
- `git check-ignore -v` on both `secrets.h.example` files → exit 1 in both cases (not ignored).
- Live test: `touch Arduino/Unit_RFID_M5Core/secrets.h && git status --short Arduino/` → empty output (the file did not surface as untracked); removed immediately after.

`.gitignore`'s new pattern is correct and confirmed by actual behavior, not just inspection.

## 4. Doc drift

Within the ticket's own allowed docs, both are accurate and internally consistent (read each file in full, not just the diff hunk):

- `docs/HARDWARE_INTEGRATION.md` — "Rules for agents" credentials line correctly updated; new "Flashing checklist (WOW-028)" section matches the actual `secrets.h`/`secrets.h.example` mechanics step for step; the RFID readers section no longer names the SSID inline and points at the rule above instead. No contradictions elsewhere in the file.
- `docs/DECISIONS_NEEDED.md` — new **Security** section matches AGENTS.md's "Standard Decision needed format" field-for-field (Decision needed / Why this matters / Options / Recommendation / Blocked until human confirms). Content is sound: correctly frames git-history scrubbing as optional post-rotation hygiene, not a hard requirement. The "Out of scope (parked)" WiFi line is updated to reflect landed status and cross-references correctly. (Nit 2 below: minor formatting deviation from the one other structured-template instance in the repo.)

Outside the ticket's allowed-files list, two now-stale statements remain (should-fix, not blocking — the implementer correctly left these files alone since they aren't in scope, but the gap is real):

- **`AGENTS.md:56`** — "**Arduino:** never modify `Arduino/` sketches (they run on installed hardware) without approval. They contain committed WiFi credentials — do not copy these anywhere else." The second sentence is false as of this PR. `AGENTS.md` is the root operating contract every agent reads first; leaving this stale risks a future agent treating the (now-fixed) leak as still live, or never discovering the `secrets.h` convention this ticket established.
- **`docs/ARCHITECTURE.md:32`** — "`Arduino/` — firmware for RFID readers (OSC sender) and LED nodes (Art-Net receiver). Deployed to hardware; contains committed WiFi credentials." Same staleness.

## 5. PR hygiene

`gh pr view 15` — body follows `.github/pull_request_template.md` section-for-section. Ticket/Summary/Changes/Out-of-scope/How-to-verify/Decisions-for-human are all filled with real, specific content; no leftover `<!-- -->` template comments.

- **Validation checklist** — all three boxes checked; the third (`Verified against simulator`) is correctly annotated `N/A` with reasoning rather than silently ticked as if it had run.
- **Safety checklist** — the `No changes under backend/, Arduino/...` box is correctly **left unchecked** with an explicit "N/A, approved exception" explanation — the honest way to handle this box given the ticket's approved exception, not silently ticked as if the standing rule were simply unbroken. The other four boxes are checked and match the diff (no socket.io event changes, no new deps, no volume/flicker path touched, docs updated in the same diff).
- **Pipeline status section — unfilled.** All four phase boxes plus Gate still show the template's raw placeholders (`pending`, `` `<sha>` ``), even though the Copilot round has already run and is verifiably clean: `gh pr view 15 --json reviews` shows exactly one review (Copilot, state `COMMENTED`, "Copilot reviewed 7 out of 8 changed files... and generated no comments"), and a direct GraphQL `reviewThreads` query against PR #15 returns `totalCount: 0`. The box should read something like "Copilot round: clean @ 78fbce5" per the template's own example text, not "pending". Should-fix, matching the same category of gap `docs/agent-notes/wow-011-reviewer-verdict-pr2.md` flagged (should-fix #2) — template completeness is a stated gate requirement (AGENTS.md: "A sparse PR body fails the gate").
- CI: `ci` check passing (`gh pr checks 15`).

## 6. Lint / test (run fresh at HEAD, not trusted from the PR body)

- `yarn lint` → clean. Only output is the pre-existing "React version not specified in eslint-plugin-react settings" warning, unrelated to this diff and present regardless.
- `yarn test` → **13 files / 68 tests passed**, matching the PR body's claim exactly. (The `useAbletonContext must be used within an AbletonProvider` stack trace in the console output is the expected negative-path assertion from `src/context/hook/test/useAbletonContext.test.tsx`, not a failure.)
- No Arduino test coverage exists or is expected — `.ino` files aren't reachable by the JS/vitest toolchain, consistent with the ticket not naming test-engineer among its suggested agents.

## Findings

### Blocking

None.

### Should-fix

1. **`AGENTS.md:56`** and **`docs/ARCHITECTURE.md:32`** both still assert `Arduino/` "contain[s] committed WiFi credentials" — false after this PR lands. Neither file is in WOW-028's allowed-files list (correctly not touched by this diff), so this needs a fast-follow docs-only PR (documentation-maintainer) or an explicit human scope-widen of this ticket, not a fix folded into this PR.
2. **PR #15's "Pipeline status" section is unfilled** — all boxes show template placeholders despite the Copilot round having already completed clean (0 review comments, 0 review threads, independently confirmed via `gh api graphql`), and both the hardware-safety-reviewer and test-engineer specialist notes having already landed (both @ `78fbce5`, both clean — see Verdict section above). Update it to record the Copilot-clean state, the specialist sign-offs, and this review before the gate runs.

### Nits

1. `.gitignore` still has no trailing newline (pre-existing condition; the PR's new lines inherit it — the diff shows `+Arduino/**/secrets.h` ending with "`\ No newline at end of file`"). Cosmetic only.
2. `docs/DECISIONS_NEEDED.md`'s new Security entry adds a blank line after each field label (`Decision needed:`, `Why this matters:`, etc.); the only other structured-template instance in the repo (`docs/UI_AUDIT.md:302`) has no blank line, matching AGENTS.md's literal template text exactly. Purely cosmetic — arguably renders more clearly as markdown.
3. `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino` still `Serial.println(ssid)`s the network name to serial at boot — pre-existing behavior, unchanged by this diff, out of this ticket's zero-behavior-change mandate. Worth a thought for whoever picks up WOW-029/WOW-030 (a live diagnostic print of the SSID over serial), but explicitly not a finding against this PR.
4. PR #15's "Validation" checklist lists `yarn lint` and `yarn test` as green but omits `yarn build`, even though CI runs it as a required step (`.github/workflows/ci.yml:29`). Independently ran it myself at HEAD: passes clean (`tsc && vite build`, 160 modules transformed, matches `docs/agent-notes/wow-028-test-engineer-review.md`'s figure exactly). Checklist-completeness gap only, not a functional issue — credit to the test-engineer note for first flagging this; re-verified independently here rather than copied.

## Required follow-up reviewers

- **hardware-safety-reviewer** — **satisfied.** APPROVE recorded @ `78fbce5` (`docs/agent-notes/wow-028-hardware-safety-reviewer-signoff.md`), landed partway through this review; read in full and cross-checked above. No further action needed on this front before the gate.
