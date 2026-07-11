# 006. Each elevated mode (dj/debug) is entered via its own separate hidden gesture

Date: 2026-07-09
Status: accepted (amended 2026-07-11 — one gesture per mode)

## Context

Visitors have full touch access to the screen; elevated modes (dj and debug) carry privileged controls (volume/tempo/key/simulated-tag and diagnostics) and must resist accidental or playful triggering. Options considered: long-press on a themed element, 5-tap corner pattern, two-finger long-press.

## Decision

Each elevated mode gets its **own separate hidden gesture** — e.g. distinct themed elements and/or hold durations — so entering dj mode and entering debug mode are independent gestures. The **press-and-hold (~3 seconds) on a themed visual element** principle applies to both (e.g. a wax seal or sigil integrated into the grimoire design; exact elements chosen in the design proposal). No visible affordance for visitors; the guide is taught the gestures. WOW-006 proposes the concrete gesture pair; human picks from mockups. Returning to normal mode: explicit close control, visible only while a mode is active.

## Consequences

- Harder to trigger accidentally than tap-count patterns; trivially teachable.
- The design proposal (WOW-006) must place both elements and specify hold durations + optional subtle feedback during each hold.
- Exiting an elevated mode: explicit close control visible only while that mode is active.
