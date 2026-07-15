# PRD — UI rework and new features

Status: **confirmed scope v2** (human decisions 2026-07-09, incl. feature list). See ADR-001…005.

## Scope decision (ADR-004)

**Work is frontend-only.** The `backend/` folder contains the real backend code but is **read-only** this phase; the only backend-adjacent work is the **offline simulator** in `sim/` (ADR-001, port 3335). End-to-end testing is not done from this repo. Definition of done: **the UI works frontend-side and sends the correct API calls** (existing socket.io contract).

## Display context (ADR-003)

- Single touch screen, 1280×1024 physically, portrait → effective **1024×1280**.
- Monitor sits inside a very large physical **grimoire**; the UI background must read as an extension of the book.
- Visitors interact freely; one knowledgeable guide assists during shows.

## Confirmed features (2026-07-09)

**F1 — Dependency modernization.** Update libraries **not related to Ableton/ableton-js**, prioritizing ones with security concerns. Constraint: `socket.io-client` must stay wire-compatible with the backend's socket.io 4.6. Backend deps untouched. (Ticket: WOW-009.)

**F2 — Theme overhaul.** Complete redesign; witchy/occult, grimoire-extension background. "Hotter and easier to use."

**F3 — Category-centric display.** Replace per-clip pictures with **icons specific to the clip's category** (Vox/Melody/Bass/Drums), and show **category names instead of song/picture names** on the visitor display.

**F4 — Category legend.** Visible legend mapping the four categories to their icons/colors. Canonical colors live in `src/util/ColorUtil.ts` (`ColorUtil.getBackgroundColorFromType`): **Vox = red-700, Bass = green-700, Drums = blue-700, Melody = yellow-700** (Tailwind classes). Legend/icons key off this function; the redesign may restyle the values there, keeping it the single source of truth.

**F5 — Recipe & spell-name removal.** Recipe suggestions AND the random spell-name display are removed entirely (`RecipeBoxContainer`, `useGrimoire`).

**F6 — Operator surface as main-screen modes.** The separate operator page/overlay is dropped (decided 2026-07-11, ADR-003 amended). The main screen has three modes: **normal** (visitor experience; tempo/volume/key controls stay visible), **dj** (adds extended controls beside each pillar, incl. per-pillar clip selection moved out of the old debug panel), and **debug** (adds a small bottom panel with diagnostics only: API/socket-event log, versions, connection state). Each elevated mode is reached via a **visible Settings modal** (ADR-006 amended 2026-07-15, superseding hidden-gesture-only; whether a covert gesture is also kept is open — WOW-006 §8.1); mode state is hand-rolled — no router dependency (ADR-005).

## Non-goals

- Backend, Ableton, RFID, LED, lighting-server changes; musical logic of any kind.
- E2E/hardware testing from this repo.
- Volume-ceiling enforcement in software (hardware-limited; UI keeps a plain slider).
- Upgrading anything that breaks socket.io wire compatibility with the backend.

## Users and user stories

- As a **visitor**, I see a grimoire-styled display showing which categories are active on which pillars (icon + category name), matching the LED colors around me.
- As the **guide**, I open the visible **Settings** modal to switch to **dj mode**, revealing extended controls beside each pillar (clip selection / simulated tag placement) alongside the always-visible volume, tempo, and key controls; the same Settings modal opens **debug mode**'s diagnostic panel when something needs investigating.
- As a **developer/agent**, I run `yarn dev` against the `sim/` mock backend with scripted scenarios; no hardware.

## Functional requirements

- FR1: Main-screen modes (normal / dj / debug per ADR-003 amended): elevated modes reached via a visible Settings modal (ADR-006 amended 2026-07-15; covert-gesture variant open — WOW-006 §8.1), explicit close control while active; mode state hand-rolled (ADR-005).
- FR2: Visitor display shows per-pillar state as **category icon + category name** (not song/picture names); artist/song metadata may move to operator surface (designer's call).
- FR3: All current debug-modal functionality survives the split: per-pillar volume sliders, tempo, and key lock/master key remain in normal mode; simulate tag place/remove (per-pillar clip selection) moves to dj mode's per-pillar extended controls; the debug bottom panel carries diagnostics only (API/socket-event log, versions, connection state).
- FR4: Category legend visible on visitor display.
- FR5: `RecipeBoxContainer` and `useGrimoire` removed; no spell names anywhere.
- FR6: UI emits exactly the existing socket.io events (`set_track_volume`, `set_tempo`, `set_keylock_state`, `set_master-key`, `/new/tag`, `/departed/tag`, `get_*`); no new event names without approval.
- FR7: Simulator in `sim/` (ADR-001 amended): `sim/core/` plain-TS state/scenario module (vitest-importable, no socket.io) + `sim/server.ts` socket.io wrapper on port 3335; answers all `get_*`/`set_*`, accepts tag events, emits `ingredient_detected`/`ingredient_removed`/`timeout_warning` from scripted CSV-based scenarios; no ableton-js/OSC imports.

## Non-functional requirements

- 1024×1280 portrait touch; touch-friendly targets; no hover dependencies.
- Runs unattended all show day; recovers from WS disconnect.
- One object per pillar (max 4 concurrent clips).
- Dependency updates (F1) must leave `yarn build`, `yarn test`, `yarn lint` green.

## Accessibility

- WCAG AA contrast for operator-critical text; decorative type for theming only.
- Category legend supports color-independent identification (icon shapes, not color alone).
- Calm motion; no rapid flashing.

## Acceptance criteria (global)

- Correct socket.io calls verified against the simulator + mocked-socket vitest.
- Lint + tests green; reviewer sign-off; human demo steps per ticket (AGENTS.md demo requirement).

## Candidate features / awaiting human confirmation

(empty — F1–F6 above are confirmed; add future ideas here first)

## Open questions

Tracked in `DECISIONS_NEEDED.md` (dj/debug gesture pair, debug-panel extras, category colors to match LEDs, kiosk/browser setup).
