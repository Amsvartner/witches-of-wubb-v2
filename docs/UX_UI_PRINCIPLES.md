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
8. **Touch/display (confirmed, ADR-003; responsive amended 2026-07-15).** Primary viewport: **1024×1280 portrait touch** (a 1280×1024 panel rotated to portrait). Design-first for this exact viewport, but the layout must also **scale gracefully / responsively** to other sizes (supersedes the earlier "no responsive breakpoints needed"). Design for touch only — no hover states, generous hit areas. The screen sits inside a large physical grimoire; the background must visually extend the book (page texture, binding, margins).
9. **Main-screen modes (ADR-003 amended 2026-07-11 & 2026-07-15; ADR-006 amended 2026-07-11 & 2026-07-15; ADR-005).** No separate operator page/overlay — the main screen has three modes (**renamed 2026-07-15**): **play** (visitor; tempo/volume/key stay visible), **tutorial** (new, **as-yet-undesigned** — pending PRD definition), and **DJ** (extended per-pillar controls incl. clip selection). A **diagnostics panel** (formerly "debug mode") can be shown **in any mode** — **debug is no longer a mode**. The DJ mode is reached via a visible Settings modal (ADR-006 amended 2026-07-15, superseding hidden-gesture-only; covert-gesture variant open — WOW-006 §8.1); explicit close control while active; mode state hand-rolled (per-mode URL routes now wanted — ADR-005 amended, own follow-up ticket).
10. **Simulator/development mode (confirmed, ADR-001).** When running against the simulator, the UI should clearly label simulated state so nobody mistakes it for the live rig.

## Confirmed design direction (2026-07-09)

- Complete visual overhaul; **witchy/occult theme stays**; background = extension of the physical grimoire.
- Recipe suggestions AND random spell names removed entirely (`useGrimoire` goes).
- Visitor display is **category-centric**: per-pillar category icon + category name (no song/picture names), plus a category legend. Category colors come from `src/util/ColorUtil.ts` (single source of truth): Vox `red-700`, Bass `green-700`, Drums the custom **`drums-blue`** token (`#3559c0`, desaturated), Melody the custom **`melody-yellow`** token (`#dfa50a`, warm) — Drums/Melody retokenised from `-700` in WOW-007A; physical-LED re-verification pending.
- Volume stays a plain slider (hardware enforces max volume).
- Operator access: three main-screen modes (**play / tutorial / DJ** since the 2026-07-15 rename; debug is now a diagnostics panel available in any mode; tutorial undesigned/pending), the DJ mode reached via a visible Settings modal (ADR-003/006 amended; ADR-006 amended 2026-07-15 supersedes hidden-gesture-only, covert-gesture variant open — WOW-006 §8.1); hand-rolled mode state (ADR-005; per-mode URL routes now wanted — own follow-up ticket).
- Tempo/volume/key controls remain visitor-visible in play mode (confirmed 2026-07-11).

## Needs human design direction

- Concrete visual language within "witchy/occult": palette, typography pairing (Fondamento stays?), texture/illustration sources, motion style — options presented in WOW-006.
- Mode-access variant (A visible-only / B +covert gesture / C gated) and, if B, which themed element hosts the covert gesture (ADR-006 §8.1 / DESIGN_PROPOSAL_001 §8.1).
- Tutorial-mode design — the mode is named but has no requirements or design yet (needs a PRD definition first).
- Debug-panel presentation (log density, filtering, copy/export) within the confirmed content baseline.
