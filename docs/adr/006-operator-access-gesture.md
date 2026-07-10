# 006. Operator surface opens via long-press on themed element

Date: 2026-07-09
Status: accepted

## Context

Visitors have full touch access to the screen; the operator surface carries volume/tempo/key/simulated-tag controls and must resist accidental or playful triggering. Options considered: long-press on a themed element, 5-tap corner pattern, two-finger long-press.

## Decision

**Press-and-hold (~3 seconds) on a themed visual element** (e.g. a wax seal or sigil integrated into the grimoire design; exact element chosen in the design proposal). No visible affordance for visitors; the guide is taught the gesture.

## Consequences

- Harder to trigger accidentally than tap-count patterns; trivially teachable.
- The design proposal (WOW-006) must place the element and specify hold duration + optional subtle feedback during the hold.
- Exiting the operator surface: explicit close control (visible there — operators are the only audience).
