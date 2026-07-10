# UX / UI principles

Principles for the UI rework. These are working principles, not visual identity — identity belongs to the artists.

## Principles

1. **Clarity for non-technical operators.** Anyone staffing the show should read system state at a glance: which pillar plays what, tempo, key, connection health. No jargon-only states.
2. **Live performance safety.** No control should be able to cause a sudden loud change, silence-all, or visual shock with a single accidental tap. Confirm or gate destructive actions. Keep operator controls separated from any visitor-facing surface.
3. **Calm status display.** Ambient, steady presentation; state changes announce themselves without alarming visitors. Avoid rapid flashing — photosensitivity applies to screens too, not just LEDs.
4. **Fast recovery.** When something fails (reader offline, Ableton disconnect, WS drop), the UI should show it plainly and offer the safe recovery path. Target: an operator can diagnose "why is pillar 3 silent" in seconds. (Current reconnect behavior TBD.)
5. **Visible pillar/RFID/audio/LED state.** The four pillars are the mental model — the UI should mirror them, including detected tags, queued vs. playing clips, per-pillar volume, and (TBD) LED state.
6. **No hidden destructive controls.** The current hidden debug-modal trigger is acceptable for a debug tool but must not become the pattern for real operator controls.
7. **Accessible contrast and typography.** The decorative font (Fondamento) is thematic; pair it with a highly legible face for status/data. Meet WCAG AA contrast for operator-critical text. Respect reduced-motion preferences.
8. **Touch/display (confirmed, ADR-003).** Single fixed viewport: **1024×1280 portrait touch**. Design for touch only — no hover states, generous hit areas, no responsive breakpoints needed. The screen sits inside a large physical grimoire; the background must visually extend the book (page texture, binding, margins).
9. **Operator surface (ADR-003 amended, ADR-005/006).** Redesigned, uncramped operator surface — separate view vs. full-screen overlay decided from WOW-006 mockups; navigation hand-rolled. Opened via long-press (~3 s) on a themed element; explicit close control inside.
10. **Simulator/development mode (confirmed, ADR-001).** When running against the simulator, the UI should clearly label simulated state so nobody mistakes it for the live rig.

## Confirmed design direction (2026-07-09)

- Complete visual overhaul; **witchy/occult theme stays**; background = extension of the physical grimoire.
- Recipe suggestions AND random spell names removed entirely (`useGrimoire` goes).
- Visitor display is **category-centric**: per-pillar category icon + category name (no song/picture names), plus a category legend. Category colors come from `src/util/ColorUtil.ts`: Vox red, Bass green, Drums blue, Melody yellow (Tailwind -700 shades).
- Volume stays a plain slider (hardware enforces max volume).
- Operator access: long-press ~3 s on themed element (ADR-006); hand-rolled view switching (ADR-005).

## Needs human design direction

- Concrete visual language within "witchy/occult": palette, typography pairing (Fondamento stays?), texture/illustration sources, motion style — options presented in WOW-006.
- Operator surface: separate page vs. full-screen overlay (from WOW-006 mockups).
- What (if any) tempo/key state is visible on the visitor display vs. operator-only.
