# WOW-028 (PR #15, wifi-secrets) — hardware-safety-reviewer sign-off

- Reviewer: hardware-safety-reviewer (Claude Sonnet 5)
- Date: 2026-07-12
- Review target: `git diff main...feat/wow-028-wifi-secrets` (PR #15)
- Base: `main` @ `7ba9d93` (= merge-base, branch is current) · Head: `feat/wow-028-wifi-secrets` @ `78fbce5` (local branch confirmed identical to `origin/feat/wow-028-wifi-secrets` @ `78fbce5`)
- Method: static only. No compile, no flash, no `yarn start-backend`, nothing sent to any hardware/network/Ableton target. Every claim in the implementer handoff (`docs/agent-notes/wow-028-creative-tech-integrator-wifi-secrets.md`) was re-verified independently against the git objects (`git diff`, `git grep`, `git check-ignore`, full-file reads), not taken on trust.

## Verdict: **APPROVE**

The diff is exactly what the ticket and PR description claim: a credentials-only source move on the two Arduino sketches, plus docs. No runtime behavior touched, no safety-relevant delta found anywhere in scope. One non-blocking observation at the end (not a finding against this diff).

---

## 1. Per-device static IP (`IPAddress ip(...)`) — PASS

- `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino:17` — `IPAddress ip(192, 168, 0, 65);` appears as an unmodified context line in the diff (no `+`/`-` prefix, confirmed by inspecting the raw diff text, not just the rendered view).
- `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino:37` — `IPAddress ip(192, 168, 0, 52);` likewise unmodified context.
- Both `// UPDATE ME!!!` comments immediately above them are also untouched.
- Confirms this diff does not encroach on WOW-030's scope.

## 2. `WiFi.config(ip)` / `WiFi.begin(ssid, password)` call sites and retry/timeout logic — PASS

- Neither call site appears in the diff at all (verified by grepping the full diff text for `WiFi.config`/`WiFi.begin` — the only hits are the untouched context lines covered under §1, i.e. zero `+`/`-` occurrences).
- Read both files in full at head to confirm the surrounding logic is intact and structurally identical to what's expected:
  - RFID sketch (`Unit_RFID_M5Core.ino:118-123`): `WiFi.config(ip); WiFi.begin(ssid, password);` followed by the blocking `while (WiFi.status() != WL_CONNECTED) { delay(1000); }` retry loop — present, unchanged.
  - LED sketch (`ArtnetWifiFastLED.ino:41-58`): same two calls inside `ConnectWifi()`, followed by the 20-attempt/500ms-interval timeout loop that returns `false` on failure — present, unchanged.
- Only the _source_ of `ssid`/`password` changed, from string literals to `WIFI_SSID`/`WIFI_PASSWORD` macros defined in the new `#include "secrets.h"`. The variables themselves (`const char *ssid`, `const char *password`), their declaration site, and every downstream use are otherwise identical.

## 3. RFID polling / OSC / Art-Net / FastLED / brightness / other runtime behavior — PASS

- Full-file read of `Unit_RFID_M5Core.ino` at head: `setup()` (RFID init, TX power, boot-tag OSC message), `loop()` (polling via `uhf.pollingMultiple`, successor-card logic, `/new/tag` and `/departed/tag` OSC emission) — all present at lines 110-325, none inside the diff hunk.
- Full-file read of `ArtnetWifiFastLED.ino` at head: `onDmxFrame` (universe 15 brightness passthrough at line 109, pixel buffer fill, `FastLED.show()`), `initTest()`, `artnet.setArtDmxCallback`, `loop()` (`artnet.read()`) — all present at lines 76-171, none inside the diff hunk.
- Each `.ino` diff is a single hunk (`@@ -16,6 +16,7 @@` for the RFID sketch, `@@ -6,10 +6,12 @@` for the LED sketch) located at the top of the file, touching only: one new `#include "secrets.h"` line, the removed credential/comment block, and the two replacement `ssid`/`password` declaration lines. Line counts match `gh pr view`'s per-file additions/deletions exactly (RFID: +5/-12; LED: +5/-3), so there is no second hunk elsewhere in either file.
- Keyword sweep of the entire diff text for `volume|gain|strobe|flicker|flash|blink|brightness`: zero hits on `volume`, `gain`, `strobe`, `flicker`, `blink`, `brightness`. The only `flash` hits are prose about firmware **flashing** (device programming — "Flashing checklist", "compile and flash", etc.), unrelated to visual flicker.

## 4. Pillar IP map (`backend/event/IncomingEvents.ts`) — PASS

- `git diff main...feat/wow-028-wifi-secrets --stat` touches exactly 8 files: `.gitignore`, both `.ino` sketches, both new `secrets.h.example` files, `docs/DECISIONS_NEEDED.md`, `docs/HARDWARE_INTEGRATION.md`, and the new agent-note. **Zero files under `backend/`.**
- Independently re-read `backend/event/IncomingEvents.ts` at current head: `IP_ADDRESS_TO_PILLAR_INDEX_MAP` (lines 13-18, `192.168.0.101`→0 … `192.168.0.104`→3) is exactly the frozen map documented in `AGENTS.md` and `docs/HARDWARE_INTEGRATION.md` — this ticket doesn't reach it, confirmed both by absence from the diff and by direct inspection.

## 5. Volume / gain / strobe / flicker / brightness anywhere in the diff — PASS (verified, not assumed)

- Ran the keyword sweep in §3 against the _entire_ diff (all 8 files, not just the sketches) — same result, zero hits on the hazard keywords outside of "flashing" firmware-programming prose.
- Read `backend/adapter/AbletonAdapter.ts`'s volume path for standing context (`setTrackVolume` at :397-402, auto-volume constant `0.6` at :322) — confirmed by §4 that `backend/` isn't part of this diff at all, so this path is untouched by construction, not merely by spot-check.
- `backend/event/OutgoingEvents.ts` and `backend/adapter/LightingAdapter.ts` (the LED/OSC emission path) were read in full as required context; neither appears in the diff. No new strobe-capable emission path introduced anywhere.

## 6. `.gitignore` scoping for `Arduino/**/secrets.h` — PASS

- Diff (`.gitignore`): adds a single line, `Arduino/**/secrets.h`, with a one-line comment. No other pattern changed.
- Verified with `git check-ignore -v`:
  - `Arduino/Unit_RFID_M5Core/secrets.h` → matched by `.gitignore:30:Arduino/**/secrets.h` (ignored).
  - `Arduino/ArtnetWifiFastLED/secrets.h` → matched by the same rule (ignored).
  - `Arduino/Unit_RFID_M5Core/secrets.h.example` → no match, exit code 1 (**not** ignored).
  - `Arduino/ArtnetWifiFastLED/secrets.h.example` → no match, exit code 1 (**not** ignored).
- `git ls-files | grep -i secrets.h$` returns nothing — no `secrets.h` (real or otherwise) is tracked anywhere in the repo; only the two `.example` templates are committed. `find Arduino -type f` confirms these are the only two sketches and the only four files under `Arduino/`.
- Both `secrets.h.example` files contain only generic placeholders (`"your-network-name"` / `"your-network-password"`) — no real value leaked into the committed template.

## 7. No credential string survives — PASS, with one non-blocking scope note

- `git grep` (tracked files) and a broader filesystem `grep` (including untracked) for the removed password and all three commented-out alternate-network SSID/password pairs: **zero matches anywhere in the tree**, in or out of `Arduino/`. I am not repeating the literal values here; they are described only, consistent with the ticket's own instruction and the implementer note's convention.
- The bare network **name** (no password) from the still-active network does still appear in a handful of pre-existing files: `docs/ARCHITECTURE.md:12`, `docs/PROJECT_BRIEF.md:22`, the WOW-028 ticket text itself in `docs/TICKETS_002_BUGS.md:238`, and two agent-notes (`wow-011-hardware-safety-reviewer-signoff.md:65`, the new `wow-028-creative-tech-integrator-wifi-secrets.md:27,33`). None of this is new to this diff (confirmed: none of those files appear in `git diff --stat`'s file list), and none of them is in WOW-028's allowed-files list — touching them would itself be scope creep under AGENTS.md guardrail #1. A bare SSID is also a materially different risk than a password: it is broadcast in the clear over the air to anything in radio range regardless of what's in GitHub, so its presence in docs is not an access vector the way the password was. **Not a blocker.** Optional follow-up for a documentation-maintainer pass if the human wants those stale mentions cleaned up, but that's out of this ticket's and this diff's scope.

---

## Supporting checks

- `git status --short` on the checked-out branch: clean — the working tree matches the commit exactly, no stray uncommitted state was reviewed by accident.
- Local `feat/wow-028-wifi-secrets` HEAD (`78fbce5`) matches `origin/feat/wow-028-wifi-secrets` HEAD (`78fbce5`) — reviewed the actual PR content, not a diverged local copy.
- `docs/DECISIONS_NEEDED.md` diff: adds a **Security** section recording the git-history-scrubbing question as an open decision (not performed, correctly left to the human) — appropriate per ticket item 3.
- `docs/HARDWARE_INTEGRATION.md` diff: updates the agent rules and RFID-reader section to stop naming the SSID in prose, and adds a "Flashing checklist (WOW-028)" pointing at rotated credentials and gitignore verification — consistent with the code change, no behavioral claims.
- Ticket item 4 ("do not change any behavior — this ticket is credentials-only") is satisfied: the entire runtime-reachable diff surface across both sketches is 10 lines total (5 add/12 del + 5 add/3 del), all within the credential-declaration block at the top of each file.

## Explicitly out of agent scope (unperformed, human step required)

- **No compile or flash verification was performed.** I have no compiler or hardware/flash access, and per the ticket this is explicitly a human-only step. The `#include "secrets.h"` / `WIFI_SSID` / `WIFI_PASSWORD` macro resolution has been reviewed for correctness by static inspection only (macro names match between the sketches and both `secrets.h.example` files) — it has **not** been built. This must happen, on one device of each type, before any venue redeploy, per the PR's own demo steps and `docs/HARDWARE_INTEGRATION.md`'s flashing checklist.
- Credential rotation (ticket item 1) and reflashing all four+ devices are human actions independent of this code review and are not verified or claimed complete here.

---

**Verdict: APPROVE.** Sign-off granted for merge of PR #15 under WOW-028's ticket scope. No safety-blockers, no major findings. One non-blocking documentation-scope observation (§7). Compile/flash verification and credential rotation remain required human steps before venue redeploy — this review covers the source-code change only.
