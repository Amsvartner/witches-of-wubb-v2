# 003. UI audience, display, and operator surface

Date: 2026-07-09
Status: accepted (amended 2026-07-09 — operator surface reopened)

## Context

The UI's audience and display hardware were unknown. Confirmed: a single touch screen (1280×1024 rotated to portrait → effective **1024×1280**), physically embedded in a very large grimoire prop. Visitors interact freely; one knowledgeable guide assists during shows. The current single page hides a cramped operator/debug panel behind an invisible button.

## Decision

- Design exclusively for 1024×1280 portrait touch.
- Visual direction: complete overhaul, keeping the witchy/occult theme; the background must read as an extension of the physical grimoire.
- The recipe/spell-suggestion section **and the random spell-name display are removed entirely** (amended: spell names confirmed removed 2026-07-09).
- The operator panel is redesigned and uncramped. **Amendment:** whether it becomes a separate page or a redesigned full-screen overlay is **reopened (TBD)** — the design proposal (WOW-006) explores both; human picks from mockups.
- Operator surface is opened via a **long-press (~3 s) on a themed element** (e.g. a wax seal/sigil) — see ADR-006. This holds for either page or overlay.

## Consequences

- Navigation between views is **hand-rolled** (ADR-005) — no router dependency either way.
- Design proposals target one fixed viewport; no responsive-breakpoint work needed.
- `use-grimoire` (recipes + spell names) is removed wholesale in the rework.
