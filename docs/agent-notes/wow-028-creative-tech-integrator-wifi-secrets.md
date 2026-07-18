# WOW-028 — creative-tech-integrator handoff (code move only)

Date: 2026-07-12
Executor: Claude Sonnet 5 (creative-tech-integrator role, unattended `/ship-feature` pipeline)
Branch: `feat/wow-028-wifi-secrets`
Scope: credentials-only code move. **Zero behavioral change** — same SSID/password values are used at runtime, just no longer hardcoded in source.

## What changed

- `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino`: added `#include "secrets.h"`; replaced the active `ssid`/`password` literals and all three commented-out alternate-network credential pairs with `WIFI_SSID`/`WIFI_PASSWORD` macros sourced from `secrets.h`. The commented-out blocks are deleted entirely (not just secrets-ified) per ticket item 2.
- `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino`: same pattern — `#include "secrets.h"`, literals replaced with the macros.
- New `Arduino/Unit_RFID_M5Core/secrets.h.example` and `Arduino/ArtnetWifiFastLED/secrets.h.example`: placeholder `WIFI_SSID`/`WIFI_PASSWORD` `#define`s, committed as the template.
- `.gitignore`: added `Arduino/**/secrets.h` (does not match `secrets.h.example`, verified with `git check-ignore`).
- `docs/HARDWARE_INTEGRATION.md`: updated the "Rules for agents" credentials line to reflect the new secrets.h scheme; added a "Flashing checklist (WOW-028)" section; removed the plaintext SSID mention in the RFID readers section (pointed at the new rule instead).
- `docs/DECISIONS_NEEDED.md`: added a **Security** section with a Decision-needed entry on git-history scrubbing (BFG/`git filter-repo`) for the leaked credentials now that they're rotated + removed from source; updated the "Out of scope (parked)" WiFi line to reflect current status and cross-reference.

## What did NOT change (by design)

- No real `secrets.h` was created on disk (even untracked) — not needed for this deliverable, agents can't compile/flash to use it anyway, and it avoids one more place the (soon-to-be-rotated) leaked password would exist. The human creates their own `secrets.h` per sketch from `secrets.h.example`, filled with the **rotated** credentials, at flash time.
- No behavior change: both sketches still connect to the same network with the same credentials at runtime, just sourced from an external gitignored header instead of inline literals.
- `IPAddress ip(...)` per-device static IPs untouched — that's WOW-030's scope.
- Pillar IP map (`backend/event/IncomingEvents.ts`) untouched.
- No git-history rewrite performed — recorded as an open Decision-needed instead, per ticket item 3.

## Human-only parts (not done here, by design)

1. **Rotate the `wubb-net` password.** Also treat the two commented-out networks' credentials as leaked if they're real home/venue networks — this PR removed those lines but the values already existed in git history before this change.
2. **Compile and flash** both sketch types with a real `secrets.h` (from `secrets.h.example`) containing the rotated credentials. Agents have no compiler/flash access — this PR is a source-code-only change and has not been compiled.
3. **Decide** the git-history-scrubbing question in `docs/DECISIONS_NEEDED.md` → Security.

## Verification performed (agent-side, non-hardware)

- `git grep` across the working tree for the removed literal values (active + all three commented-out pairs): zero matches. Only the network _name_ `wubb-net` (not the password) still appears in a few pre-existing, out-of-scope docs (`docs/ARCHITECTURE.md`, `docs/PROJECT_BRIEF.md`, ticket text, a prior agent-note) — SSIDs are broadcast in the clear over the air by design and are not the credential being rotated; those files aren't in this ticket's allowed-files list.
- `git check-ignore -v` confirms `Arduino/**/secrets.h` is ignored per sketch, and `secrets.h.example` is not.
- `yarn lint` — clean (Arduino `.ino` files aren't linted by ESLint; no JS/TS changed).
- `yarn test` — 13 files / 68 tests passed, unaffected (no test touches Arduino).
- No compile/flash verification — out of agent scope, called out above.

## How to verify (human demo steps)

1. `git diff main...feat/wow-028-wifi-secrets -- Arduino/` — confirm no plaintext SSID/password literals remain in either `.ino` file, and that both now read `WIFI_SSID`/`WIFI_PASSWORD` from `secrets.h`.
2. In each sketch directory, `cp secrets.h.example secrets.h` and fill in the rotated credentials; confirm `git status` does **not** list the new `secrets.h` (gitignored).
3. Open both sketches in the Arduino IDE and compile (human-only — verifies the `#include "secrets.h"` resolves and macros are used correctly). Flash one device of each type per `docs/HARDWARE_INTEGRATION.md` → "Flashing checklist (WOW-028)" and confirm it still joins the network and behaves identically to before.
