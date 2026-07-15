# 003. UI audience, display, and operator surface

Date: 2026-07-09
Status: accepted (amended 2026-07-11 — operator surface resolved: mode-based main screen; amended 2026-07-15 — responsive/graceful scaling required, see Consequences)

## Context

The UI's audience and display hardware were unknown. Confirmed: a single touch screen (1280×1024 rotated to portrait → effective **1024×1280**), physically embedded in a very large grimoire prop. Visitors interact freely; one knowledgeable guide assists during shows. The current single page hides a cramped operator/debug panel behind an invisible button.

## Decision

- Design exclusively for 1024×1280 portrait touch.
- Visual direction: complete overhaul, keeping the witchy/occult theme; the background must read as an extension of the physical grimoire.
- The recipe/spell-suggestion section **and the random spell-name display are removed entirely** (amended: spell names confirmed removed 2026-07-09).
- The operator panel is redesigned and uncramped. **Amendment 2026-07-11 (human decision, supersedes the reopened page-vs-overlay question — the answer is neither):** the main screen has **three modes**:
  - **normal** — the visitor experience. Tempo/volume/key controls remain visible here (human-confirmed 2026-07-11).
  - **dj** — normal plus **extended controls beside each pillar**, including per-pillar clip selection (moved out of the old debug panel).
  - **debug** — normal plus a **small panel at the bottom** with diagnostic info only: a log of API calls and socket events, versions, connection state. No clip/performance controls — those require dj mode.
- Mode switching is gated by **separate hidden gestures per mode** — see ADR-006 (amended). Exact gestures/elements proposed in WOW-006; human picks from mockups.

## Consequences

- Mode state is **hand-rolled** (ADR-005) — plain React state, no router dependency.
- There is no separate operator page/overlay to design or route to; dj/debug are additive layers on the main screen. The old full-screen debug modal (`DebugModalContainer`) is dissolved: clip selection moves to dj mode's per-pillar controls, diagnostics move to debug mode's bottom panel.
- Design proposals are **designed-first** for the fixed 1024×1280 portrait viewport, but the layout must also **scale gracefully / responsively** to other sizes. **Amendment 2026-07-15 (human decision):** supersedes the original "no responsive-breakpoint work needed" wording — responsive behaviour is now a requirement, not out of scope. The canonical dimensions and portrait orientation are unchanged.
- `use-grimoire` (recipes + spell names) is removed wholesale in the rework.
