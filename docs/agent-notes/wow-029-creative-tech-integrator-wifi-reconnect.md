# WOW-029 — LED firmware ignores Wi-Fi failure and never reconnects

- Role: creative-tech-integrator (implementer)
- Date: 2026-07-12
- Branch: `feat/wow-029-wifi-reconnect`, stacked on `feat/wow-028-wifi-secrets` (both touch `Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino`; the ticket's own "Dependencies" line also names this order explicitly)

## Ticket

WOW-029 — see `docs/TICKETS_002_BUGS.md`. `setup()` discarded `ConnectWifi()`'s return value and `loop()` never checked `WiFi.status()`, so a network blip mid-show left the LED node frozen until a manual power-cycle.

## This is a partial landing, per the ticket's own explicit instruction

Unlike most tickets in this run, WOW-029 doesn't just have a stop condition — it has a **ticket-defined partial-landing rule**, which takes priority over parking as a draft: _"Fallback-state decision unanswered → implement reconnection but stop before changing any visible LED behavior."_ No human is available in this unattended run to make the show-design call, and no pre-answered decision exists in `docs/DECISIONS_NEEDED.md` or elsewhere. So:

- **Implemented**: the reconnection logic itself — non-negotiable, ticket says to do this regardless of the decision.
- **Not implemented, recorded as Decision-needed per the ticket's own instruction**: what the LEDs visibly show during a mid-show outage, and the boot-time failure indicator. Both are genuinely "changing visible LED behavior."

This can still land as a normal (non-draft) PR, unlike WOW-031 — the ticket explicitly authorizes exactly this scope as a complete, mergeable unit of work; it isn't "half a fix waiting on an answer," it's "the whole fix the ticket allows without that answer."

## Fix

`Arduino/ArtnetWifiFastLED/ArtnetWifiFastLED.ino`:

1. **`setup()`**: now captures `ConnectWifi()`'s return value (previously discarded) into `wifiWasConnected`, and logs a serial message on boot-time failure. No LED change — the "surface... visibly (e.g. a distinct dim color)" part of the ticket's fix description is exactly the kind of visible-LED-behavior change the partial-landing rule defers.
2. **New `attemptWifiReconnect()`**: a non-blocking reconnect attempt, gated by a `millis()`-based timer with exponential backoff (1s → 2s → 4s → ... capped at 30s), so `loop()` never blocks waiting on `WiFi.begin()` the way `ConnectWifi()`'s original boot-time retry loop does (`delay(500)` in a spin-loop — fine once, at boot; would freeze `artnet.read()` from ever running again if reused inside `loop()`). Re-applies `WiFi.config(ip)` before `WiFi.begin()` to mirror `ConnectWifi()`'s original connection sequence exactly, so a reconnect ends up in the identical configured state as the original connection.
3. **`loop()`**: now checks `WiFi.status()` every iteration (cheap), tracks a `wifiWasConnected` transition flag so it only logs on actual state changes (not every loop iteration), calls `attemptWifiReconnect()` while disconnected, and resets the backoff interval back to 1s on a confirmed reconnect (so a _second_, later outage doesn't inherit a stale 30s-capped backoff from the previous one). `artnet.read()` is still called unconditionally every iteration exactly as before — it's a harmless no-op when there's no connection to read from, and this ensures Art-Net reception resumes immediately (no extra glue code needed) the instant `WiFi.status()` next reports connected.

**Zero LED-driving code touched**: `initTest()`, `onDmxFrame()`, and every `FastLED.show()`/`leds[...]` assignment are byte-for-byte unchanged. During an outage, the strip continues showing whatever frame Art-Net last set — exactly today's (buggy, but at-least-not-worse) behavior, not a regression, not yet the intended fix either.

## Decision recorded

Added a new "Hardware / firmware" section to `docs/DECISIONS_NEEDED.md` covering both open sub-decisions (mid-show fallback state: hold-last-frame / dim-ambient-fade / blank; boot-time failure indicator: distinct color / serial-only), with options and a recommendation for each, per the ticket's explicit instruction to "record as Decision-needed" rather than invent the answer. Also updated `docs/HARDWARE_INTEGRATION.md` (LED controllers section + Failure modes table) to describe the new reconnect behavior and point at the open decision.

## Why the reconnect logic itself doesn't need the decision

The ticket separates two concerns cleanly: _whether_ the node recovers from a network blip (a pure engineering/reliability question, answerable without any show-design input) and _what visitors see_ while it's recovering (a show-design question). Implementing the first without the second isn't a guess at the second — it's explicitly deferring it, with the strip's behavior in the meantime being "whatever it already does today" (hold-last-frame is the code's current, unintentional behavior; this PR doesn't change that, it just makes sure the node actually comes back afterward instead of staying dark/frozen forever).

## What could not be verified (agent limitation, per the ticket's own required-checks line)

Per the ticket: _"Required tests/checks: human bench test per above; agents limit themselves to code review (no compile/flash capability)."_ This PR has **not** been compiled or flashed — no Arduino toolchain was invoked, and no hardware was touched, per that instruction and the run's own standing "never touch real hardware" constraint. The logic was hand-traced carefully (see below) but a human bench test (kill the AP mid-stream, confirm automatic recovery without power-cycling; boot without Wi-Fi, confirm the serial log shows the failure) is still required before this is considered proven, exactly as the ticket specifies.

One specific implementation detail worth the human's attention during that bench test: `attemptWifiReconnect()` calls `WiFi.disconnect()` before re-issuing `WiFi.config(ip)` + `WiFi.begin(...)`, matching common ESP8266/ESP32 reconnect patterns — this is a standard idiom but its exact behavior can vary subtly by core version, and this is precisely the kind of thing that's easy to reason about but genuinely needs a real device to confirm.

## Out of scope / deliberately not done

- Any visible LED fallback/transition behavior — blocked, see above.
- Brightness/gamma changes, Art-Net protocol changes — explicitly out of scope per the ticket.
- The RFID sketch (`Unit_RFID_M5Core`) — WOW-030's territory.
- Compiling or flashing — agents don't have that capability for this ticket, per its own instruction.

## Validation

- [x] Code review (self): hand-traced `setup()`/`loop()`/`attemptWifiReconnect()` for the boot-success, boot-failure, mid-show-disconnect, and reconnect-after-outage paths.
- [x] Confirmed zero changes to any LED-driving code (`initTest`, `onDmxFrame`, all `FastLED.show()`/`leds[...]` call sites) via direct diff inspection.
- [ ] Compile — not attempted, agents lack this capability per the ticket.
- [ ] Flash / bench test — human action, required per the ticket's own acceptance criteria.

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `.env` — N/A
- [x] `Arduino/` changes — explicitly authorized by this ticket (code-only, no compile/flash)
- [x] No new/renamed OSC/Art-Net addresses, no pillar IP map changes
- [x] Reconnect/fallback transitions must not strobe — **hardware-safety-reviewer sign-off required per ticket** — requested in PR; scope for this review is the landed reconnection-logic-only change (confirming zero visible LED behavior change and no strobe/flicker risk in what _was_ touched), not a chosen fallback/transition (there isn't one yet)
- [x] No visible LED behavior change in this PR at all — the actual "must not strobe" concern applies to the eventual follow-up once the decision is answered, not to this PR's contents
