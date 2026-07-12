# WOW-028 (PR #15, Arduino WiFi secrets) — test-engineer review

- Reviewer: test-engineer (Claude Sonnet 5, phase C / test-review, ticket pipeline)
- Date: 2026-07-12
- Review target: `git diff main...feat/wow-028-wifi-secrets` (PR #15)
- Base: `main` @ `7ba9d93` · Head: `feat/wow-028-wifi-secrets` @ `78fbce5` (local branch matches `origin/feat/wow-028-wifi-secrets`, `git status` clean)
- Ground truth: ticket WOW-028 (`docs/TICKETS_002_BUGS.md:235-247`), `AGENTS.md` v0.4, `docs/CODING_GUIDELINES.md` "Testing" section, test-engineer profile
- Method: read-only, no test code written (none applies — see below). Every claim in the PR body and the implementer's handoff (`docs/agent-notes/wow-028-creative-tech-integrator-wifi-secrets.md`) that falls in a test-engineer's lane was independently re-run, not trusted: `git grep`, `git check-ignore`, `yarn lint`, `yarn test`, `yarn build`, plus a live sanity check (see below).

## Verdict: **approve-with-nits**

No automated test is missing, and none is warranted as a blocking or should-fix requirement for this diff. The agent's own verification method is right-sized and independently reproduced clean. One PR-hygiene nit and two non-blocking, new-ticket-scope recommendations below.

---

## 1. Is "no new automated test" the correct posture? Yes — confirmed by reading the full diff, not assumed

`git diff main...feat/wow-028-wifi-secrets --stat` touches exactly 8 files:

```
.gitignore
Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino
Arduino/ArtnetWifiFastLED/secrets.h.example        (new)
Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino
Arduino/Unit_RFID_M5Core/secrets.h.example         (new)
docs/DECISIONS_NEEDED.md
docs/HARDWARE_INTEGRATION.md
docs/agent-notes/wow-028-creative-tech-integrator-wifi-secrets.md
```

Checked each category for a hidden testable seam rather than taking the ticket's word for it:

- **Zero TypeScript/JavaScript files.** `package.json`'s `"lint"` script is `eslint . --ext .ts,.tsx` — `.ino` and `.h`/`.h.example` files are structurally outside ESLint's extension filter, not merely unlinted by omission.
- **vitest can't reach this diff.** `vite.config.ts` has no `test.include` override, so vitest's default include pattern (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) applies; `.ino` files can never match it regardless of location.
- **No indirect TS/JS surface.** Repo-wide grep for any reference to `secrets.h` or Arduino-adjacent tooling outside `Arduino/` and prose docs (`docs/HARDWARE_INTEGRATION.md`, `docs/DECISIONS_NEEDED.md`, `docs/TICKETS_002_BUGS.md`, the two agent-notes) turned up nothing — no script, build step, `sim/`, or `backend/` code touches this. `src/`, `sim/`, and `backend/` are all completely unmodified by this diff.
- **The two new `secrets.h.example` files carry no logic.** They're byte-identical placeholder text (same git blob hash, `c0c5b89`, for both) — two `#define` lines each. Nothing to assert beyond "these two macros exist," which isn't a meaningful test.
- **`.gitignore`'s new line is declarative glob config, not code.** The correct verification tool for gitignore semantics is `git check-ignore`, which is what the implementer used. A vitest test wrapping the same command would add process without adding confidence.

Conclusion: there is no testable TypeScript/JS surface anywhere in this diff. The ticket's own "Required tests/checks" line (`docs/TICKETS_002_BUGS.md:241` — "grep for the removed strings; human compile/flash verification") is an accurate description of what this change needs, not a shortcut the implementer took.

## 2. Is the agent's own verification sufficient rigor for a security-fix PR of this shape? Yes — independently reproduced, one scope caveat noted (not a deficiency)

| Check                                                 | What I ran                                                                                                                     | My result                                                      | Matches implementer's claim?                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removed credential values gone from the tracked tree  | `git grep` for the removed active password and all three removed commented-out SSID/password pairs (7 distinct literals total) | 0 matches, all 7                                               | Yes                                                                                                                                                 |
| `secrets.h` is gitignored (both sketches)             | `git check-ignore -v Arduino/{Unit_RFID_M5Core,ArtnetWifiFastLED}/secrets.h`                                                   | Both matched by `.gitignore:30` (`Arduino/**/secrets.h`)       | Yes                                                                                                                                                 |
| `secrets.h.example` is NOT gitignored (both sketches) | Same, against the `.example` filename                                                                                          | Both exit 1 (not ignored)                                      | Yes                                                                                                                                                 |
| No real `secrets.h` exists anywhere, tracked or not   | `git ls-files \| grep -i secrets` + a raw filesystem `find Arduino -iname secrets.h`                                           | Only the two committed `.example` files exist anywhere on disk | Yes — my filesystem check is strictly stronger than a git-tracked-only check                                                                        |
| `yarn lint`                                           | `yarn lint`                                                                                                                    | Clean                                                          | Yes                                                                                                                                                 |
| `yarn test`                                           | `yarn test`                                                                                                                    | 13 files / 68 tests passed                                     | Yes, exact count match with the PR body                                                                                                             |
| `yarn build`                                          | `yarn build`                                                                                                                   | Succeeds, 160 modules transformed                              | Not claimed in the PR's Validation checklist, but CI (`.github/workflows/ci.yml:28-29`) runs it as a required step — ran it myself for completeness |

Also did a **live sanity check** beyond trusting `check-ignore`'s say-so: wrote a throwaway `Arduino/Unit_RFID_M5Core/secrets.h` with placeholder `#define` content, ran `git status --short` (showed nothing — proving the ignore rule works in practice), then deleted it.

**Assessment:** for a change of this exact shape — a mechanical literal→macro substitution across two files plus a companion gitignore rule — "grep for the known removed strings + `check-ignore` + green lint/test/build" is the correct and sufficient verification method. It is exhaustive for the specific risk this PR addresses: (a) do the known secret values still appear anywhere in the tracked working tree, and (b) can the new secret file be accidentally committed in the future. Both are binary, mechanically-decidable questions that the chosen tools answer completely; there is no partial-coverage risk the way there would be with, say, a behavioral change validated only by a few example test cases.

**Scope caveat (not a finding against this PR):** `git grep` — used by both the implementer and the hardware-safety-reviewer — searches tracked files by default (confirmed via `git grep --help`; untracked files require `--untracked` or `--no-index`). It would not see a credential sitting in an untracked file in some contributor's local checkout. That's inherent to any git-based check and outside this repo's blast radius; noting for precision only, since a security review is exactly the place precision like this belongs.

## 3. Test-strategy gaps worth flagging as a follow-up (not blocking)

### Recommended 1 — a regression-guard test for this exact bug class is feasible and cheap, but doesn't exist yet

This repo already has precedent for exactly this style of test: `sim/test/import-guard.test.ts` is a plain `fs`-based static-text scan (reads source files, regexes their import specifiers, asserts on the strings found) with **zero runtime execution, zero hardware, zero network** — it fails CI if `sim/` code imports a forbidden module, purely by reading source text. The same pattern could guard against WOW-028's bug class recurring:

1. A vitest test that reads every `Arduino/**/*.ino` and fails if it contains a `const char *(ssid|password) = "..."`-shaped literal that isn't the `WIFI_SSID`/`WIFI_PASSWORD` macro identifiers — this is precisely the class of regression this ticket fixes, and it's 100% mechanically detectable from source text; no compiler needed.
2. A companion assertion that every `.ino` which `#include`s `secrets.h` has a sibling `secrets.h.example` committed (protects WOW-030, which explicitly plans to extend this same `secrets.h` pattern to per-device IPs, and any future sketch, from silently shipping without a template).

Both checks would run under the existing `yarn test` with no new dependency, fully inside the safe-test envelope this role operates under.

**Not done here** — correctly so: it's outside WOW-028's allowed-files list (`docs/TICKETS_002_BUGS.md:239` lists no test path) and outside its "Required tests/checks" line, and per my role's own constraints I don't add test surface without a ticket. Proposing as a small, low-risk, high-leverage follow-up ticket: it's the one guard that would have automatically caught the original leak, going forward, in CI, without depending on a human or an agent remembering to grep.

### Recommended 2 — no secret-scanning coverage of `.ino`/header files anywhere in the toolchain (pre-existing, not introduced by this PR)

Checked for existing secret-scanning tooling: no gitleaks, detect-secrets, secretlint, or trufflehog anywhere in `package.json` or `.github/workflows/ci.yml`. Separately, the `lint-staged` config in `package.json` only matches `*.{js,jsx,ts,tsx}` and `*.{json,css,scss,md,yaml,yml}` — `.ino` and `.h`/`.h.example` extensions are outside both glob groups, so `.husky/pre-commit`'s `npx lint-staged` step gives **zero coverage of Arduino source today**, independent of this PR and unchanged by it.

This is a standing, repo-wide gap, not something WOW-028 introduced or worsened — if anything, WOW-028 is what surfaces it. A security-fix PR is a reasonable place to note it rather than let it go unrecorded. Recommendation 1 above (a targeted vitest guard) closes the specific known risk cheaply and fits this repo's existing test conventions; a general-purpose secret scanner would be belt-and-suspenders but is a new-dependency/CI-change decision requiring explicit human approval per `AGENTS.md`'s "Requires explicit human approval" list, not something to add unilaterally. Suggest logging as an option in `docs/DECISIONS_NEEDED.md` or a dedicated ticket if the human wants to consider it.

---

## Findings

### Blocking

None.

### Should-fix

None. This diff has no correctness defect from a test-engineering lens. The two Recommended items above are deliberately not classified as should-fix: neither is achievable within WOW-028's current ticket scope (adding a test file or a CI dependency isn't in its allowed-files list), so folding them into "fix this PR" framing would be inaccurate — the right vehicle is a follow-up ticket, not a request back to this PR's implementer.

### Nits

1. PR #15's body "Validation" checklist lists `yarn lint` and `yarn test` as green but omits `yarn build`, even though CI (`.github/workflows/ci.yml:28-29`) runs it as a required step and it passes cleanly (independently verified above, 160 modules transformed). Minor checklist-completeness gap, not a functional issue.

## Pipeline context (for the record — not new findings, not re-litigated here)

- **Copilot round:** complete, 0 comment threads (`gh api repos/Amsvartner/witches-of-wubb-v2/pulls/15/reviews`, submitted 2026-07-12T00:15:50Z @ `78fbce5`) — satisfies `AGENTS.md`'s gate that the Copilot round resolve before agent reviews proceed.
- **hardware-safety-reviewer:** APPROVE already recorded (`docs/agent-notes/wow-028-hardware-safety-reviewer-signoff.md`, same head SHA `78fbce5`) — covers the hardware/safety lens (per-device IP untouched, `WiFi.config`/`WiFi.begin` call sites untouched, no volume/strobe/flicker keywords anywhere in the diff, pillar IP map untouched). This note is scoped to test strategy only and does not re-verify that lens.
- Remaining gates per the ticket's "Suggested agent(s)" line (`docs/TICKETS_002_BUGS.md:245`) and both prior notes: the general reviewer pass, plus two human-only steps (credential rotation, compile/flash verification on one device of each type) that no agent can perform. Not new findings — already called out in the implementer's and hardware-safety-reviewer's notes.

---

**Verdict: approve-with-nits.** No automated test is missing or blocking; the agent's verification method (grep + check-ignore + green lint/test/build) is sufficient and was independently reproduced here. One PR-hygiene nit (checklist omission) and two non-blocking Recommended follow-ups (regression-guard test; secret-scanning tooling gap) logged above for a future ticket.
