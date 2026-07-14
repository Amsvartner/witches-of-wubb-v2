# WOW-029 PR #30 (Wi-Fi reconnect, no visible LED change) — hardware-safety-reviewer sign-off

- Reviewer: hardware-safety-reviewer (Claude Sonnet 5, specialist sign-off phase of the WOW pipeline — **required** per this ticket's own safety notes: "reconnect/fallback transitions must not strobe — hardware-safety-reviewer sign-off required on the chosen fallback and transition behavior (visitor-facing light).")
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #30, base `feat/wow-028-wifi-secrets`, head `feat/wow-029-wifi-reconnect`.
- Method: read-only, no edits, no live hardware. Independently pulled both full file versions via `git show origin/<branch>:<path>` (immune to local checkout state) and diffed content-level extractions of every LED-driving function and call site, rather than trusting the PR's claims.

## Scope confirmed

Full file list touched (via `gh pr view --json files`): `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino` (+63/-1), `docs/DECISIONS_NEEDED.md` (+31/0), `docs/HARDWARE_INTEGRATION.md` (+2/0), the standard agent-note (new). Nothing under `backend/`, `src/`, the CSV, or `Unit_RFID_M5Core` is touched.

## Verification methodology (independently confirmed, not taken on faith)

Pulled both full file versions independently and ran isolated content-level comparisons:

- `initTest()` function body: extracted from both versions, diffed → **IDENTICAL**.
- `onDmxFrame()` function body: extracted from both versions, diffed → **IDENTICAL**.
- `ConnectWifi()` function body: extracted from both versions, diffed → **IDENTICAL**.
- Every `FastLED.show()` call site and every `leds[...]` assignment: extracted by content (line numbers stripped), diffed → **IDENTICAL** (same 7 call sites: `initTest()`'s 4-color test sequence, `onDmxFrame()`'s brightness-set branch, `onDmxFrame()`'s frame-complete branch).
- `setup()` call-order sequence: identical — `Serial.begin` → `ConnectWifi()` → `artnet.begin()` → `FastLED.addLeds` → `initTest()` → `memset` → `artnet.setArtDmxCallback`. Only change: capturing `ConnectWifi()`'s return value and one conditional serial log on failure. `initTest()` remains unconditional, called exactly once, same relative position as before.

This independently confirms the PR's central claim: **zero LED-driving code was touched.**

## Point-by-point findings

**1. Volume:** N/A — no `backend/` file touched.

**2. Light / strobe (core question):** No strobe-capable path exists in this diff. All LED-driving code verified byte-for-byte unchanged (above). No new code anywhere writes to `leds[]` or calls `FastLED.show()`. The ticket's "must not strobe" concern genuinely does not apply to this diff.

**3. Live commands:** New code only calls `WiFi.disconnect()`/`WiFi.config()`/`WiFi.begin()` — Wi-Fi association, not OSC/MIDI/Art-Net/serial emission. This node only receives Art-Net (`artnet.read()`, unconditional, unchanged); it emits nothing outward. The Arduino-modification approval gate here is the ticket itself, whose allowed-files list matches exactly what was touched.

**4. Configs:** No pillar IP map, port, or WiFi-credential changes. `ip`/`ssid`/`password` are read, not modified. `secrets.h` untouched.

**5. Indirect effects of the new reconnect logic:**

- **Blocking/stutter:** No `delay()` calls anywhere in the new code. `WiFi.begin()`/`WiFi.disconnect()`/`WiFi.config()` are non-blocking (unlike `ConnectWifi()`'s deliberate blocking loop, which the new code explicitly avoids reusing). The `millis()`-gated rate limit correctly uses rollover-safe unsigned subtraction. `artnet.read()` still runs unconditionally immediately after. No blocking/stutter risk found.
- **`initTest()` interaction:** Confirmed clean — `wifiWasConnected` is written before `initTest()` runs but doesn't gate it in any way. No double-init or interaction risk.
- **Power/brownout → LED flicker:** The one point that cannot be fully cleared by static review alone — see Finding 1.

## Findings

| #   | Severity                                                                              | Location                                                     | Hazard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Mitigation                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Minor                                                                                 | `attemptWifiReconnect()`                                     | During a prolonged outage, `WiFi.disconnect()`/`WiFi.begin()` now fire repeatedly (every 1s→30s backoff interval) instead of once at boot. Wi-Fi radio TX bursts are a known current-draw spike source on ESP8266/ESP32. Whether the LED strip (144×WS2812, up to ~8.6A at full white) shares a power rail/regulator with the ESP closely enough for this to visibly affect brightness is genuinely undocumented — LED-node PSU topology isn't specified anywhere in this repo. This is a _frequency_ increase of an already-existing mechanism (the same `WiFi.begin()` already happens once at boot pre-PR), not a new one, and touches zero LED code. | Not a blocker (code-only, no LED path involved, and the ticket already mandates a human bench test). Recommend explicitly adding to that bench test: observe the strip during an extended, multi-cycle simulated outage for any brightness glitch correlated with reconnect attempts, not just confirm reconnection succeeds. |
| 2   | Advisory / forward-looking (no fallback code exists yet — not a finding on this diff) | `docs/DECISIONS_NEEDED.md`, mid-show Option 2 recommendation | If the eventual "fade to dim ambient" fallback is a naive per-loop-iteration toggle rather than a debounced state machine, a marginal/flaky signal could cause repeated connect→drop→reconnect cycles as fast as ~1s apart (per this PR's own backoff start), reading as pulsing over many cycles rather than a clean single transition.                                                                                                                                                                                                                                                                                                                 | Advisory for the follow-up ticket only: that fallback's transition should have its own hysteresis/debounce distinct from the Wi-Fi-level backoff, and its own strobe-safety review should explicitly test a flapping/marginal-signal scenario.                                                                                |

No safety-blockers. No major findings.

## Advisory view on the recorded Decision-needed entry (non-binding — not a sign-off on unimplemented code)

- **Mid-show recommendation** (fade to dim ambient after 3–5s grace period): sound in principle — a one-shot, monotonic fade to a static dim state is not a strobe pattern under any photosensitivity heuristic (targets rapid _repeated_ alternation, not a single directional transition). Finding 2 (flap-debounce) is the one risk worth flagging now.
- **Boot-time recommendation** (distinct static dim color, held indefinitely): sound — a static, non-blinking held color carries no inherent strobe risk regardless of the exact color/brightness chosen.
- This is commentary on the _shape_ of the recommendations only — neither is implemented anywhere in the current tree. Whichever PR eventually implements either one needs its own independent hardware-safety review against the actual code; this paragraph does not pre-clear that future diff.

## Verdict: **APPROVE**

For what is actually in PR #30 — the Wi-Fi reconnection logic only — this is safe to leave open and safe to eventually merge from a hardware-safety perspective. Zero LED-driving code changed (independently verified), no strobe-capable path exists anywhere in the diff, no new blocking behavior introduced into `loop()`, `initTest()`'s one-time boot sequence untouched and unconditional as before. The single residual item (power-rail/brownout coupling) is a hardware-topology unknown, not a code defect, and is already covered by the bench test the ticket independently mandates before flashing.

**Forward-looking note for the human**: when the actual fallback-state implementation lands, it requires its own separate hardware-safety-reviewer sign-off — this sign-off does not extend to it. Flag Finding 2 (flap-debounce) to whoever picks that ticket up.
