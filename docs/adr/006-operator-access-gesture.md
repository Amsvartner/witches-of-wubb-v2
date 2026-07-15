# 006. Elevated-mode (dj/debug) access

Date: 2026-07-09
Status: accepted (amended 2026-07-11 — one gesture per mode; **amended 2026-07-15 — access moved to a visible Settings modal, superseding hidden-gesture-only; WOW-006**)

## Context

Visitors have full touch access to the screen; elevated modes (dj and debug) carry privileged controls (volume/tempo/key/simulated-tag and diagnostics) and must resist accidental or playful triggering. Options considered: long-press on a themed element, 5-tap corner pattern, two-finger long-press.

## Decision

_[Superseded for the primary access path by the **2026-07-15 amendment** below — retained as historical record. Mode access is now a visible Settings modal; a hidden gesture survives only if variant B is chosen.]_

Each elevated mode gets its **own separate hidden gesture** — e.g. distinct themed elements and/or hold durations — so entering dj mode and entering debug mode are independent gestures. The **press-and-hold (~3 seconds) on a themed visual element** principle applies to both (e.g. a wax seal or sigil integrated into the grimoire design; exact elements chosen in the design proposal). No visible affordance for visitors; the guide is taught the gestures. WOW-006 proposes the concrete gesture pair; human picks from mockups. Returning to normal mode: explicit close control, visible only while a mode is active.

## Consequences

- Harder to trigger accidentally than tap-count patterns; trivially teachable.
- The design proposal (WOW-006) must place both elements and specify hold durations + optional subtle feedback during each hold.
- Exiting an elevated mode: explicit close control visible only while that mode is active.

## Amendment 2026-07-15 — visible Settings-modal access (WOW-006)

**Context:** The human-approved primary visual reference (`docs/design/hexology-grimoire-concept-3.png`) and the layout wireframe (`Hex_layout_concept.svg`) both place **visible Help and Settings controls**, with the wireframe annotating Settings as "toggle a modal with more settings, such as which mode is visible." During WOW-006 review the human explicitly required the visible Help/Settings controls (their absence was called out as a defect).

**Amended decision:** Mode switching (normal / dj / debug) is reached through a **visible Settings modal**, not a hidden-gesture-only model. The original "no visible affordance / hidden press-and-hold to enter each mode" decision above is **superseded** for the primary access path. The explicit close/exit-while-active control is retained.

**Still open (WOW-006 HALT §8.1 — not decided here):** the exact access variant — **A** visible Settings modal only; **B** visible Settings modal **plus** a retained covert press-and-hold gesture (e.g. quick/covert debug entry); or **C** visible Settings modal with a confirm/long-press guard against casual visitor switching. If B is chosen, the earlier themed-element/hold-duration guidance above still applies to that one covert path. This variant is picked at the WOW-006 visual sign-off before WOW-007 slicing.

**Consequence:** the hidden-gesture asset/motif work is now conditional on variant B; the visible Settings/Help controls become part of the normal-mode chrome (design proposal §1/§6).
