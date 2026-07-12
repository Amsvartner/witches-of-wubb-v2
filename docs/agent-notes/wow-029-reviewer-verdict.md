# WOW-029 PR #30 (Wi-Fi reconnect, no visible LED change) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, general review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote in this checkout)
- Review target: PR #30, base `feat/wow-028-wifi-secrets`, head `feat/wow-029-wifi-reconnect`.
- Method: read-only, no edits. Hand-compiled the `.ino` diff line by line (declaration order, type-checking `min()`'s arguments, brace/paren balance, `millis()` rollover safety) since no real compiler was available, being explicit about confidence level throughout rather than asserting certainty it didn't have.

## Verdict: **APPROVE-WITH-NITS**

The reconnection logic is sound, correctly scoped, and the "zero visible LED behavior change" claim holds up under direct scrutiny (confirmed no hunk touches `initTest()`, `onDmxFrame()`, or any `FastLED.show()`/`leds[...]` line). No confirmed defects. Two items in Required are pre-existing outstanding pipeline steps (specialist sign-off, human bench test), not defects in the diff — both already correctly marked unchecked in the PR's own Pipeline status.

## Required

1. **hardware-safety-reviewer sign-off** — required per the ticket's own safety note and reviewer rules before merge. _(Since resolved — see `docs/agent-notes/wow-029-hardware-safety-reviewer-signoff.md`, APPROVE.)_
2. **Human bench test per ticket acceptance criteria** — specifically prioritize "kill the AP mid-stream → confirm automatic recovery without power-cycling." See Finding 1.

## Findings

**1. [major, confidence: genuinely uncertain] Reconnect never re-arms the Art-Net UDP listener.** `artnet.begin()` is called exactly once, in `setup()` (`ArtnetWifiFastLED.ino:201`), never again. `attemptWifiReconnect()` cycles `WiFi.disconnect()` → `WiFi.config(ip)` → `WiFi.begin(...)` but never re-touches the `artnet`/underlying UDP socket. Whether the original UDP binding survives a full Wi-Fi disconnect/reconnect cycle on this core (ESP32-Arduino inferred from the `Serial.begin()` 6-arg signature at `:189`), or needs to be rebound, isn't determinable from source alone — depends on ESP32-Arduino/lwIP internals. Best-effort lean: "probably survives" (sockets bound to `INADDR_ANY` are typically interface-agnostic in lwIP), held with moderate, not high, confidence. **If wrong, the failure mode is silent and severe**: serial log says "reconnected," `WiFi.status()` genuinely reports connected, but `artnet.read()` never receives another packet and the LEDs stay frozen forever — the fix would appear to work in the log while failing at the one thing the ticket cares about most. This is exactly what the ticket's own bench-test criterion is designed to catch — not blocking on it, but it should be the **#1 thing the bench test watches for**: confirm LEDs actually resume following Art-Net frames post-reconnect, not just that the serial log says "reconnected." Suggested low-risk defensive fix **if the bench test shows a problem**: call `artnet.begin()` again inside the reconnect-transition branch in `loop()`, alongside the existing backoff reset.

**2. [minor, speculative]** Repeated `WiFi.disconnect()`/`WiFi.begin()` cycling over a long-duration outage (previously once at boot, now potentially every 1–30s for hours) — can't verify heap/stability safety from code alone. Recommend the bench test include at least one long-duration outage, not only a quick blip.

**3. [minor, speculative, for hardware-safety-reviewer's judgment]** WiFi TX current spikes during association now recur throughout a show instead of once at boot — not a new risk category, but a new frequency. _(Addressed — see hardware-safety-reviewer's Finding 1, same underlying concern, already flagged for the bench-test checklist.)_

**4. [minor]** `docs/HARDWARE_INTEGRATION.md`'s "resuming normal Art-Net reception automatically... no power-cycle needed" was stated as settled fact — per Finding 1, this is precisely the untested part of the fix. Suggest hedging until the bench test confirms it.

**5. [minor]** PR body was missing the literal `## How to verify (human demo steps)` heading required by `.github/pull_request_template.md` / `AGENTS.md:200`. Substance existed (folded into Validation), but the template heading itself was absent.

## Nits

- `wifiRetryIntervalMs` resets to `1000` on reconnect but `lastWifiRetryMs` doesn't — harmless, self-correcting, worst case a ~1s delay on a new outage starting within 1s of the previous one's last retry. Not worth fixing.
- Backoff cap has a named constant; the starting interval (`1000`) is an inline literal. Cosmetic only.
- `docs/DECISIONS_NEEDED.md`'s two "Options for X:" sub-headers vs. AGENTS.md's single literal "Options:" — a reasonable adaptation for a genuinely two-part decision, not worth changing.

## Verification detail (hand-compiled, confidence levels stated explicitly)

- **Declaration order**: all 4 new globals declared before every function referencing them — no forward-declaration issue.
- **`min(unsigned long, unsigned long)`**: both `min()` arguments are same-typed (`wifiRetryIntervalMs * 2` promotes to `unsigned long`) — the classic Arduino/ESP32 "ambiguous overload" error only arises from _mixed_-type calls, which this isn't. Confidence this compiles cleanly: high (~90-95%), not certain — no compiler run, consistent with the ticket's own agent limitation.
- **`millis()` rollover safety**: all four relevant variables are `unsigned long`, no mixed `int`/`long` — standard wraparound-safe idiom, correctly typed throughout.
- **Backoff sequence**: hand-traced 1000→2000→4000→8000→16000→32000(clamped to 30000)→stays 30000 — correct, no overflow, resets to 1000 exactly once per reconnect edge.
- **Unchanged-code claims**: confirmed directly from diff hunks, not just the PR description — no hunk touches `initTest()`, `onDmxFrame()`, or any `FastLED.show()`/`leds[...]` line; boot sequence order unchanged regardless of Wi-Fi outcome.
- **Hot-path cost when connected**: one `WiFi.status()` call + two cheap boolean checks + one bool store per iteration; `artnet.read()` remains unconditional and unwrapped.
- **File-wide brace/paren balance**: 27/27 braces, 104/104 parens — no structural syntax issue.
- **Scope**: all 4 changed files within the ticket's allowed files plus the standard agent-note convention. No credentials, CSV, or pillar-IP-map changes.
- **Partial-landing honesty**: no LED-visible behavior change found anywhere after deliberately looking for indirect paths (boot sequence ordering, brightness handling, added Serial I/O timing cost) — the only real change is Wi-Fi radio activity recurring during outages, a firmware-behavior change, not a visible-LED-behavior change, consistent with the PR's own framing.

## Summary

Solid, carefully-reasoned implementation doing exactly what the ticket's partial-landing rule authorizes and nothing more. No confirmed compile errors, logic bugs, scope violations, or dishonesty in the "zero visible LED behavior" claim after hand-tracing all state transitions and diffing byte-for-byte against the untouched LED-driving code. Finding 1 (whether the Art-Net UDP listener survives a Wi-Fi bounce) is the one thing worth real attention — flagged with appropriate uncertainty rather than asserted either way, and correctly identified as exactly what the mandated bench test should prioritize confirming.
