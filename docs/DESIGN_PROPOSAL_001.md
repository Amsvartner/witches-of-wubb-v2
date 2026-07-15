# Design Proposal 001 — Grimoire UI (visitor display + operator surface)

Ticket: **WOW-006** — Grimoire design proposal
Author: frontend-ui-designer
Status: **PROPOSAL — awaiting human/artist sign-off.** Docs-only; no code.
Depends on: WOW-004 (`docs/UI_AUDIT.md`), ADR-003/005/006 (amended), PRD F1–F6.
Canonical viewport: **1024 × 1280 portrait touch** (a 1280×1024 panel rotated to portrait). Design-first for this exact size; layout must also scale gracefully / responsively to other sizes.

---

## 0. How to read this document

This is a **design-direction proposal**, not an implementation spec and not code. Everything here is a recommendation for a human to accept, adjust, or reject before WOW-007 slicing begins.

- Sections **1–7** are the seven required design outputs from the ticket.
- Section **8** holds the **four HALT items** that require human/artist sign-off. They are presented as clearly-labelled options with trade-offs and are **deliberately not decided**. Look for the ⚠️ marker.
- All inline SVGs are **design artefacts** (diagrams drawn for this document). They are not app components and contain no product code.
- Where the concept images and the written requirements disagree, **the requirements win** (per the ticket). Deviations from the concept art are called out inline as **[Requirements over concept]**.

### Source-of-truth precedence used throughout

1. Functional requirements (PRD F1–F6 / FR1–FR7, UX_UI_PRINCIPLES, ADR-003/005/006).
2. The wireframe `docs/design/Hex_layout_concept.svg` — for placement, hierarchy, controls, modes.
3. `docs/design/visual-direction.md` — for the visual language.
4. The two concept PNGs — **mood / colour / atmosphere inspiration only.** AI-generated, internally inconsistent (they disagree on orientation and carry fake text/icons/controls). Language taken, artefacts discarded.

### Reference palette used for the mockups

The mockups below are drawn in **Palette Option A ("Obsidian & Gilt")** purely so the artefacts are legible and coherent. **The palette is HALT item 3 (§8.3) and is NOT decided.** Swapping in Option B or C should not change any layout, hierarchy, or component structure in this document.

### One tension to surface up front — category hue source

`src/util/ColorUtil.ts` is the **single source of truth** for category colour (PRD F4). Note it currently returns **Tailwind class names**, not hex — `getBackgroundColorFromType` maps **Vox → `bg-red-700`, Bass → `bg-green-700`, Drums → `bg-blue-700`, Melody → `bg-yellow-700`**. The hex values quoted throughout this doc (**Vox `#b91c1c`, Bass `#15803d`, Drums `#1d4ed8`, Melody `#a16207`**) are those Tailwind `-700` tokens **resolved against the default palette**, used here so the mockups render — if the Tailwind theme is ever customised, the tokens (the class names) remain the contract and the hex follows. The concept art instead paints Vocals pink/magenta and Melody amber. **Requirements win: this proposal uses the ColorUtil `-700` tokens** (they also match the LED colours the visitor sees around them, PROJECT*BRIEF). PRD F4 explicitly permits \_restyling the values inside that function* — so _whether_ to nudge those hues toward the concept art's pink/amber is a legitimate part of the palette sign-off (§8.3), but it stays a single-source-of-truth change, not per-component divergence.

**Critical a11y consequence, carried into §3 and §7:** the raw `-700` hues on a near-black page **fail WCAG AA for text** (e.g. blue-700 on the `#0e0b12` page ≈ 2.9:1 — see §7.2 for all four). So this system uses each category hue in **two roles**: the **`-700` fill** for medallions/LED-matching accents (recognition), and a **lightened `-300` tint** for any category _text_ (legibility). See §3.3 and §7.2.

---

## 1. Low-fidelity full-screen layout (1024 × 1280 portrait)

Structure and hierarchy only — no colour, texture, or type styling. This is the skeleton every later artefact inherits. It follows the wireframe: wordmark on top, a **2×2 pillar grid around a central cauldron focal point**, and a bottom status/settings band carrying tempo, key, and the legend.

**[Requirements over concept]** The concept art shows visible **Help** and **Settings** buttons top-right. Those are **omitted**: ADR-006 mandates _hidden gestures with no visible affordance for visitors_, so exposing operator entry as visible chrome would contradict the access model. Mode entry lives in the hidden gestures of §8.1, not in visible buttons.

<svg viewBox="0 0 1024 1280" width="100%" style="max-width:520px;background:#fbfbfd;border:1px solid #ccc" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui" role="img" aria-label="Low fidelity wireframe of the 1024 by 1280 portrait layout">
  <rect x="0" y="0" width="1024" height="1280" fill="#ffffff"/>
  <!-- page margin -->
  <rect x="24" y="24" width="976" height="1232" fill="none" stroke="#bbb" stroke-dasharray="4 4"/>
  <!-- header / wordmark -->
  <rect x="40" y="40" width="944" height="120" fill="#f2f2f5" stroke="#888"/>
  <text x="512" y="94" text-anchor="middle" font-size="34" fill="#333" letter-spacing="6">HEXOLOGY WORDMARK</text>
  <text x="512" y="126" text-anchor="middle" font-size="16" fill="#999">— clear space kept beneath the logo —</text>
  <!-- pillar grid: 2 columns with cauldron gutter -->
  <!-- row 1 -->
  <rect x="40" y="196" width="390" height="452" fill="#f7f7fa" stroke="#666"/>
  <rect x="594" y="196" width="390" height="452" fill="#f7f7fa" stroke="#666"/>
  <!-- row 2 -->
  <rect x="40" y="676" width="390" height="452" fill="#f7f7fa" stroke="#666"/>
  <rect x="594" y="676" width="390" height="452" fill="#f7f7fa" stroke="#666"/>
  <!-- pillar internal anatomy annotations (row1 left) -->
  <text x="60" y="228" font-size="17" fill="#444">Pillar 1 · header (number + category name)</text>
  <circle cx="235" cy="300" r="46" fill="#eee" stroke="#777"/>
  <text x="235" y="305" text-anchor="middle" font-size="13" fill="#777">category</text>
  <text x="235" y="322" text-anchor="middle" font-size="13" fill="#777">medallion</text>
  <text x="235" y="372" text-anchor="middle" font-size="15" fill="#555">CATEGORY NAME</text>
  <rect x="70" y="300" width="26" height="150" fill="#eee" stroke="#777"/>
  <text x="83" y="470" text-anchor="middle" font-size="12" fill="#777">vol</text>
  <rect x="70" y="470" width="330" height="34" fill="#eee" stroke="#999"/>
  <text x="235" y="492" text-anchor="middle" font-size="13" fill="#777">currently-playing state (category, no song name)</text>
  <rect x="70" y="516" width="330" height="110" fill="#f0f0f0" stroke="#aaa" stroke-dasharray="3 3"/>
  <text x="235" y="556" text-anchor="middle" font-size="13" fill="#999">queued indicator (count/pips — no titles)</text>
  <text x="235" y="586" text-anchor="middle" font-size="11" fill="#bbb">[dj mode reveals clip-select controls here]</text>
  <!-- other pillars: light label only -->
  <text x="614" y="228" font-size="17" fill="#444">Pillar 2 · same component</text>
  <text x="60" y="708" font-size="17" fill="#444">Pillar 3 · same component</text>
  <text x="614" y="708" font-size="17" fill="#444">Pillar 4 · same component</text>
  <!-- cauldron focal point -->
  <ellipse cx="512" cy="662" rx="88" ry="80" fill="#ededf2" stroke="#555"/>
  <text x="512" y="658" text-anchor="middle" font-size="15" fill="#555">CAULDRON</text>
  <text x="512" y="678" text-anchor="middle" font-size="13" fill="#888">shared focal point</text>
  <text x="512" y="760" text-anchor="middle" font-size="11" fill="#aaa">(hosts one hidden gesture — §8.1)</text>
  <!-- bottom settings + status band -->
  <rect x="40" y="1152" width="944" height="72" fill="#f2f2f5" stroke="#666"/>
  <rect x="52" y="1164" width="300" height="48" fill="#eee" stroke="#999"/>
  <text x="202" y="1193" text-anchor="middle" font-size="14" fill="#666">TEMPO (BPM slider) 75–155</text>
  <rect x="366" y="1164" width="150" height="48" fill="#eee" stroke="#999"/>
  <text x="441" y="1187" text-anchor="middle" font-size="13" fill="#666">auto-adjust</text>
  <text x="441" y="1203" text-anchor="middle" font-size="13" fill="#666">+ current key</text>
  <rect x="530" y="1164" width="442" height="48" fill="#eee" stroke="#999"/>
  <text x="751" y="1193" text-anchor="middle" font-size="14" fill="#666">KEY CONTROLS: Raise · Lower · Reset</text>
  <!-- legend strip -->
  <rect x="40" y="1232" width="944" height="16" fill="#fff" stroke="#bbb"/>
  <text x="512" y="1245" text-anchor="middle" font-size="12" fill="#888">LEGEND — Vocals · Melody · Bass · Drums (colour + icon)</text>
</svg>

**Information hierarchy (visitor priority, top to bottom):**

1. **Which category is active on which pillar** — biggest, most colour-saturated element (medallion + category name). This is the whole point of the visitor display.
2. **The cauldron** — shared focal anchor tying the four pillars together; ambient, non-interactive for visitors.
3. **Global musical state** — tempo, key — present but quiet, at the bottom.
4. **Legend** — persistent colour/icon key, smallest, always available.

**What is deliberately _absent_ from the visitor layout (F3/F5):** song titles, artist names, picture thumbnails, spell names, recipe suggestions. Clip/song identity only ever appears inside **dj mode** (operator).

---

## 2. Visual-direction mockup (applying `visual-direction.md`)

Normal mode, styled in Palette Option A. This applies the Hexology language: restrained near-black page reading as an open grimoire spread, fine gold detailing, thin decorative borders (not heavy fantasy frames), circular sample-type medallions, the central cauldron as focal point, and strong per-category colour. Decoration sits as a **subtle layer around a clean, conventional interface** — never competing with functional information (visual-direction "Design priorities").

<svg viewBox="0 0 1024 1280" width="100%" style="max-width:520px;border:1px solid #333" xmlns="http://www.w3.org/2000/svg" font-family="Georgia,serif" role="img" aria-label="Styled visual direction mockup of the normal mode screen">
  <defs>
    <radialGradient id="pageGlow" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#181320"/>
      <stop offset="60%" stop-color="#0e0b12"/>
      <stop offset="100%" stop-color="#080609"/>
    </radialGradient>
    <linearGradient id="binding" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1410"/><stop offset="1" stop-color="#0b0906"/>
    </linearGradient>
    <radialGradient id="cauldronGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#6b3fa0" stop-opacity="0.9"/>
      <stop offset="55%" stop-color="#3a2160" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#3a2160" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1280" fill="url(#pageGlow)"/>
  <!-- grimoire binding margins (background extends the physical book) -->
  <rect x="0" y="0" width="26" height="1280" fill="url(#binding)"/>
  <rect x="998" y="0" width="26" height="1280" fill="url(#binding)"/>
  <rect x="30" y="30" width="964" height="1220" fill="none" stroke="#c9a24b" stroke-opacity="0.5" stroke-width="1.5"/>
  <rect x="38" y="38" width="948" height="1204" fill="none" stroke="#c9a24b" stroke-opacity="0.25"/>
  <!-- wordmark -->
  <text x="512" y="96" text-anchor="middle" font-size="52" fill="#e6c877" letter-spacing="10" font-family="Fondamento,Georgia,serif">HEXOLOGY</text>
  <line x1="360" y1="122" x2="664" y2="122" stroke="#c9a24b" stroke-opacity="0.5"/>
  <circle cx="512" cy="122" r="4" fill="#e6c877"/>
  <!-- ===== pillar cards ===== -->
  <!-- Pillar 1 Vocals (active) -->
  <g>
    <rect x="44" y="196" width="386" height="446" rx="10" fill="#140f1a" stroke="#b91c1c" stroke-opacity="0.85" stroke-width="2"/>
    <text x="70" y="238" font-size="22" fill="#fca5a5" font-family="Fondamento,Georgia,serif">Pillar 1</text>
    <circle cx="237" cy="322" r="52" fill="#1c0f12" stroke="#b91c1c" stroke-width="3"/>
    <circle cx="237" cy="322" r="52" fill="none" stroke="#fca5a5" stroke-opacity="0.4" stroke-width="1"/>
    <path d="M237 300 v44 M225 310 v24 M249 310 v24 M215 318 v8 M259 318 v8" stroke="#fca5a5" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="237" y="404" text-anchor="middle" font-size="26" fill="#fca5a5" letter-spacing="3" font-family="Fondamento,Georgia,serif">VOCALS</text>
    <!-- volume slider -->
    <rect x="72" y="300" width="12" height="150" rx="6" fill="#241820"/>
    <rect x="72" y="360" width="12" height="90" rx="6" fill="#b91c1c"/>
    <rect x="70" y="352" width="16" height="16" rx="3" fill="#e6c877"/>
    <!-- currently playing state -->
    <rect x="72" y="470" width="330" height="40" rx="6" fill="#1b1016" stroke="#b91c1c" stroke-opacity="0.4"/>
    <circle cx="92" cy="490" r="5" fill="#22c55e"/>
    <text x="108" y="495" font-size="15" fill="#ece3d0" font-family="ui-sans-serif,system-ui">Playing</text>
    <!-- queued pips (no titles) -->
    <text x="72" y="542" font-size="12" fill="#9a9080" font-family="ui-sans-serif,system-ui">QUEUED</text>
    <circle cx="150" cy="537" r="6" fill="#b91c1c" fill-opacity="0.55"/>
    <circle cx="172" cy="537" r="6" fill="#b91c1c" fill-opacity="0.55"/>
    <!-- waveform -->
    <path d="M72 600 l14 -16 l14 22 l14 -30 l14 34 l14 -20 l14 12 l14 -24 l14 28 l14 -14 l14 18 l14 -22 l14 24 l14 -12 l14 14 l14 -8 l14 6" fill="none" stroke="#b91c1c" stroke-opacity="0.7" stroke-width="2"/>
  </g>
  <!-- Pillar 2 Melody (queued) -->
  <g>
    <rect x="594" y="196" width="386" height="446" rx="10" fill="#140f1a" stroke="#a16207" stroke-opacity="0.85" stroke-width="2"/>
    <text x="620" y="238" font-size="22" fill="#fcd34d" font-family="Fondamento,Georgia,serif">Pillar 2</text>
    <circle cx="787" cy="322" r="52" fill="#161006" stroke="#a16207" stroke-width="3" stroke-dasharray="6 5"/>
    <path d="M787 296 q-18 12 0 26 q18 14 0 26 M787 348 v14" stroke="#fcd34d" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="787" y="404" text-anchor="middle" font-size="26" fill="#fcd34d" letter-spacing="3" font-family="Fondamento,Georgia,serif">MELODY</text>
    <rect x="622" y="300" width="12" height="150" rx="6" fill="#241f14"/>
    <rect x="622" y="380" width="12" height="70" rx="6" fill="#a16207"/>
    <rect x="620" y="372" width="16" height="16" rx="3" fill="#e6c877"/>
    <rect x="622" y="470" width="330" height="40" rx="6" fill="#171206" stroke="#a16207" stroke-opacity="0.4"/>
    <circle cx="642" cy="490" r="5" fill="#a16207"/>
    <text x="658" y="495" font-size="15" fill="#cbb98f" font-family="ui-sans-serif,system-ui">Queued — starts next phrase</text>
  </g>
  <!-- Pillar 3 Bass (active) -->
  <g>
    <rect x="44" y="676" width="386" height="446" rx="10" fill="#140f1a" stroke="#15803d" stroke-opacity="0.85" stroke-width="2"/>
    <text x="70" y="718" font-size="22" fill="#86efac" font-family="Fondamento,Georgia,serif">Pillar 3</text>
    <circle cx="237" cy="802" r="52" fill="#0d1a11" stroke="#15803d" stroke-width="3"/>
    <path d="M243 782 q10 4 10 16 q0 12 -14 12 M243 782 v40 M231 826 h20" stroke="#86efac" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="237" y="884" text-anchor="middle" font-size="26" fill="#86efac" letter-spacing="3" font-family="Fondamento,Georgia,serif">BASS</text>
    <rect x="72" y="780" width="12" height="150" rx="6" fill="#16241a"/>
    <rect x="72" y="820" width="12" height="110" rx="6" fill="#15803d"/>
    <rect x="70" y="812" width="16" height="16" rx="3" fill="#e6c877"/>
    <rect x="72" y="950" width="330" height="40" rx="6" fill="#0f1a13" stroke="#15803d" stroke-opacity="0.4"/>
    <circle cx="92" cy="970" r="5" fill="#22c55e"/>
    <text x="108" y="975" font-size="15" fill="#ece3d0" font-family="ui-sans-serif,system-ui">Playing</text>
  </g>
  <!-- Pillar 4 Drums (empty) -->
  <g>
    <rect x="594" y="676" width="386" height="446" rx="10" fill="#0f0d13" stroke="#1d4ed8" stroke-opacity="0.35" stroke-width="2"/>
    <text x="620" y="718" font-size="22" fill="#6f7fa8" font-family="Fondamento,Georgia,serif">Pillar 4</text>
    <circle cx="787" cy="802" r="52" fill="#0b0f18" stroke="#1d4ed8" stroke-opacity="0.4" stroke-width="2"/>
    <circle cx="770" cy="792" r="4" fill="#3a4a6a"/><circle cx="804" cy="792" r="4" fill="#3a4a6a"/><circle cx="787" cy="812" r="4" fill="#3a4a6a"/>
    <text x="787" y="884" text-anchor="middle" font-size="26" fill="#5f6f95" letter-spacing="3" font-family="Fondamento,Georgia,serif">DRUMS</text>
    <text x="787" y="948" text-anchor="middle" font-size="14" fill="#6f7fa8" font-family="ui-sans-serif,system-ui">— awaiting an ingredient —</text>
  </g>
  <!-- Cauldron focal point -->
  <ellipse cx="512" cy="640" rx="150" ry="120" fill="url(#cauldronGlow)"/>
  <path d="M452 636 q60 40 120 0 l-14 66 q-46 26 -92 0 z" fill="#0c0a10" stroke="#c9a24b" stroke-opacity="0.6"/>
  <ellipse cx="512" cy="636" rx="60" ry="14" fill="#2a1840" stroke="#8a5cc0" stroke-opacity="0.7"/>
  <path d="M512 632 q-14 -30 4 -54 q14 -20 -2 -42" fill="none" stroke="#a678d8" stroke-opacity="0.7" stroke-width="3"/>
  <circle cx="512" cy="706" r="3" fill="#e6c877"/>
  <!-- bottom settings band -->
  <rect x="44" y="1150" width="936" height="70" rx="8" fill="#100c15" stroke="#c9a24b" stroke-opacity="0.4"/>
  <text x="60" y="1176" font-size="12" fill="#9a9080" font-family="ui-sans-serif,system-ui">TEMPO</text>
  <text x="150" y="1176" font-size="18" fill="#ece3d0" font-family="ui-sans-serif,system-ui">130 BPM</text>
  <rect x="60" y="1188" width="280" height="6" rx="3" fill="#241f14"/>
  <rect x="60" y="1188" width="150" height="6" rx="3" fill="#c9a24b"/>
  <circle cx="210" cy="1191" r="9" fill="#e6c877"/>
  <text x="392" y="1176" font-size="12" fill="#9a9080" font-family="ui-sans-serif,system-ui">AUTO-ADJUST KEY</text>
  <rect x="392" y="1186" width="52" height="24" rx="12" fill="#3a2a12"/><circle cx="430" cy="1198" r="10" fill="#e6c877"/>
  <text x="470" y="1176" font-size="12" fill="#9a9080" font-family="ui-sans-serif,system-ui">KEY</text>
  <text x="470" y="1206" font-size="26" fill="#ece3d0" font-family="Fondamento,Georgia,serif">D♭ <tspan font-size="13" fill="#fca5a5">MAJOR</tspan></text>
  <g font-family="ui-sans-serif,system-ui" font-size="12" fill="#ece3d0">
    <rect x="600" y="1170" width="110" height="42" rx="6" fill="#171019" stroke="#c9a24b" stroke-opacity="0.4"/><text x="655" y="1196" text-anchor="middle">Raise ▲</text>
    <rect x="720" y="1170" width="110" height="42" rx="6" fill="#171019" stroke="#c9a24b" stroke-opacity="0.4"/><text x="775" y="1196" text-anchor="middle">Lower ▼</text>
    <rect x="840" y="1170" width="128" height="42" rx="6" fill="#171019" stroke="#c9a24b" stroke-opacity="0.4"/><text x="904" y="1196" text-anchor="middle">Reset ⟳</text>
  </g>
  <!-- legend -->
  <g font-family="ui-sans-serif,system-ui" font-size="14">
    <circle cx="300" cy="1236" r="7" fill="#b91c1c"/><text x="314" y="1241" fill="#cbb98f">Vocals</text>
    <circle cx="410" cy="1236" r="7" fill="#a16207"/><text x="424" y="1241" fill="#cbb98f">Melody</text>
    <circle cx="520" cy="1236" r="7" fill="#15803d"/><text x="534" y="1241" fill="#cbb98f">Bass</text>
    <circle cx="620" cy="1236" r="7" fill="#1d4ed8"/><text x="634" y="1241" fill="#cbb98f">Drums</text>
  </g>
</svg>

**Language notes (what was taken vs. discarded from the concept art):**

- **Taken:** dark mystical page, fine gold hairline borders, circular medallions, central cauldron with a soft magical plume, per-category colour identity, ceremonial wordmark, "thin decorative borders not big fantasy frames."
- **Discarded (AI artefacts / concept inconsistencies):** landscape orientation of concept-1, the fake "Sensitivity/Transition time/Scale" settings panel, the "Global Queue" side panel with invented song rows, the pink-vocals/amber-melody hues (superseded by ColorUtil), the Help/Settings chrome, and any logo↔panel collisions. Cauldron kept **naturally proportioned** and the medallions kept **circular** per visual-direction's "Required corrections."

---

## 3. Design tokens

A token layer so the interface is built as a **coherent design system, not one illustration** (visual-direction "Expected approach"). Values below are the reference set (Palette Option A); the palette and type families are HALT items (§8.2, §8.3), but the **token _structure_ — the named roles — is the proposal and should survive whichever palette/type is chosen.**

### 3.1 Background surfaces

| Token                 | Role                                                           | Ref value (Option A)                |
| --------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `surface/page`        | The grimoire spread; whole-screen backdrop                     | `#0e0b12` → `#080609` radial        |
| `surface/binding`     | Left/right binding margins that extend the book                | `#1a1410` → `#0b0906`               |
| `surface/panel`       | Pillar card / settings-band fill                               | `#140f1a`                           |
| `surface/panel-inset` | Currently-playing / queued rows inside a card                  | `#1b1016` (hue-tinted per category) |
| `surface/overlay`     | dj/debug scrims (near-opaque, never see-through — fixes UI-05) | `#0b0910` @ 98–100%                 |
| `motif/gold-line`     | Hairline decorative borders & rules                            | `#c9a24b` @ 25–50%                  |
| `motif/gold-bright`   | Focal ornaments, active tick marks                             | `#e6c877`                           |

### 3.2 Pillar borders & geometry

| Token                                                                                            | Value                                                 |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `pillar/radius`                                                                                  | 10 px                                                 |
| `pillar/border-width`                                                                            | 2 px                                                  |
| `pillar/border` (idle)                                                                           | category hue @ 35%                                    |
| `pillar/border` (active)                                                                         | category hue @ 85% + inner 1px `-300` tint @ 40%      |
| `pillar/gap`                                                                                     | 24 px between cards; central cauldron gutter ≈ 164 px |
| All four cards share **identical structure and border geometry** (visual-direction requirement). |

### 3.3 Sample-type accents (dual-role — the a11y core)

| Category         | LED-match fill (`-700`, medallions/accents) | Text/label tint (`-300`, legible on page) | Icon (colour-independent shape) |
| ---------------- | ------------------------------------------- | ----------------------------------------- | ------------------------------- |
| **Vocals (Vox)** | `#b91c1c`                                   | `#fca5a5`                                 | Microphone + waveform           |
| **Melody**       | `#a16207`                                   | `#fcd34d`                                 | Treble clef / sine wave         |
| **Bass**         | `#15803d`                                   | `#86efac`                                 | Bass clef                       |
| **Drums**        | `#1d4ed8`                                   | `#93c5fd`                                 | Drum kit / dotted circle        |

> **Rule:** never render category _text_ in the raw `-700` hue on the dark page — it fails AA (§7.2). Use the `-300` tint for text; reserve `-700` for fills/borders/LED-matching. Icons must be **distinguishable by shape alone** (PRD accessibility — colour-independent identification).
>
> **Tint note:** the Melody text tint `#fcd34d` is Tailwind **amber-300**, deliberately chosen over true yellow-300 (`#fde047`) for a warmer, on-brand cast that still clears AA (≈ 13.5:1). The other three are the straight `-300` of their category hue.

### 3.4 Typography (reference; family choice = HALT §8.2)

| Token          | Role                                                      | Reference                                                 |
| -------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `type/display` | Wordmark, pillar/category names, key glyph                | Fondamento (decorative)                                   |
| `type/data`    | Status, tempo/BPM, connection, all operator-critical text | A highly legible sans (e.g. Inter) — **never** decorative |
| `type/label`   | Small caps section labels ("QUEUED", "TEMPO")             | Legible sans, letter-spaced                               |
| Sizes          | display 26–52 / data 15–18 / label 12 (see §7.3 minimums) |

Principle: decorative font is _thematic only_; every piece of **operator-critical** text uses the legible face (UX_UI_PRINCIPLES 7).

### 3.5 Buttons

| Token             | Value                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `btn/height`      | ≥ 56 px (touch; see §7.1)                                                                 |
| `btn/radius`      | 6 px                                                                                      |
| `btn/surface`     | `#171019`, border `motif/gold-line`                                                       |
| `btn/focus`       | 3 px `motif/gold-bright` ring, 2 px offset                                                |
| `btn/destructive` | Requires confirm-gate (key reset, clip stop) — never single-tap fire (UX_UI_PRINCIPLES 2) |

### 3.6 Sliders (tempo, per-pillar volume)

| Token                                                                                | Value                                                                              |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `slider/track`                                                                       | 6 px, `#241f14`                                                                    |
| `slider/fill`                                                                        | `motif/gold-line` (global tempo) or category `-700` (per-pillar volume)            |
| `slider/thumb`                                                                       | ≥ 44×44 px hit area (visually a gilt lozenge; fixes audit's unstyled native thumb) |
| Volume soft-clamp stays UI-only (0–0.7); ceiling is hardware-enforced (PRD non-goal) |

### 3.7 Queue rows

| State      | Visitor (normal)                          | Operator (dj)                            |
| ---------- | ----------------------------------------- | ---------------------------------------- |
| Queued     | category-hue pip(s) / count, **no title** | full clip name + remove (×) + stop (▶/■) |
| Row height | n/a                                       | ≥ 56 px, ≥ 8 px separation               |

### 3.8 Icon medallions

| Token                | Value                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `medallion/diameter` | 104 px (circular — required)                                                                                          |
| `medallion/ring`     | 3 px category `-700`; **active** adds soft outer glow, **queued** uses dashed ring, **empty** desaturates ring to 40% |
| `medallion/icon`     | category `-300` tint, 2.5–3 px stroke                                                                                 |

### 3.9 State colours (semantic)

| State             | Colour                                 | Used by                                    |
| ----------------- | -------------------------------------- | ------------------------------------------ |
| Focus             | `#e6c877`                              | focus ring, all interactive elements       |
| Active/playing    | `#22c55e` dot + category glow          | pillar currently-playing                   |
| Queued            | category hue @ 55%, dashed             | pillar queued                              |
| Paused            | `#9a9080`                              | pillar paused                              |
| Muted             | `#6b6472` + slash overlay              | pillar muted                               |
| Disabled/offline  | `#3a3540` desaturated + diagonal hatch | pillar unavailable / disconnected          |
| Connected (debug) | `#22c55e`                              | debug connection state                     |
| Warning           | `#b45309`                              | idle timeout warning (T-30s), reconnecting |
| Error/disconnect  | `#b91c1c`                              | WS/Ableton disconnect banner               |

> The **warning** and **error** tokens directly close audit blockers **UI-01** (silent disconnect) and **UI-17** (no idle-timeout affordance): the system now has named visual states for both.

### 3.10 Decorative motifs

Gold hairline corner flourishes on cards; a thin double-rule frame reading as the book's printed border; a soft cauldron plume (the _only_ animated ambient element); optional faint sigil/constellation watermark in the page backdrop at very low opacity. **Motion is calm and never flashing** (§7.4). Decoration is a subtle layer — it never overlaps or competes with status text (visual-direction "Do not copy").

---

## 4. Reusable pillar component — all important states

One component, four instances. This is the single most reused unit in the UI, so it carries an explicit state model. States required by the ticket: **focus, active, muted, paused, disabled, queued, empty**. The state sheet below shows each at reduced scale; anatomy is identical across all (same structure and border geometry — visual-direction requirement).

**Anatomy (top → bottom):** pillar-number header · circular category medallion · category name · vertical volume slider (left rail) · currently-playing status row · queued indicator · (dj mode only) extended controls drawer.

<svg viewBox="0 0 1040 620" width="100%" style="max-width:660px;background:#0b0910;border:1px solid #333" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pillar component state sheet showing empty, queued, active, paused, muted, disabled, and focus states">
  <style>
    .lbl{font-family:ui-sans-serif,system-ui;font-size:13px;fill:#cbb98f}
    .nm{font-family:Georgia,serif;font-size:15px;letter-spacing:2px}
    .st{font-family:ui-sans-serif,system-ui;font-size:11px;fill:#9a9080}
  </style>
  <!-- helper: 7 mini cards, 4 top / 3 bottom -->
  <!-- EMPTY -->
  <g transform="translate(20,20)">
    <rect width="230" height="260" rx="8" fill="#0f0d13" stroke="#1d4ed8" stroke-opacity="0.35" stroke-width="2"/>
    <text x="16" y="26" class="lbl" fill="#6f7fa8">Pillar 4</text>
    <circle cx="115" cy="110" r="40" fill="#0b0f18" stroke="#1d4ed8" stroke-opacity="0.4" stroke-width="2"/>
    <circle cx="103" cy="104" r="3" fill="#3a4a6a"/><circle cx="127" cy="104" r="3" fill="#3a4a6a"/><circle cx="115" cy="118" r="3" fill="#3a4a6a"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#5f6f95">DRUMS</text>
    <text x="115" y="212" text-anchor="middle" class="st">awaiting ingredient</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">EMPTY</text>
  </g>
  <!-- QUEUED -->
  <g transform="translate(270,20)">
    <rect width="230" height="260" rx="8" fill="#140f1a" stroke="#a16207" stroke-opacity="0.7" stroke-width="2"/>
    <text x="16" y="26" class="lbl" fill="#fcd34d">Pillar 2</text>
    <circle cx="115" cy="110" r="40" fill="#161006" stroke="#a16207" stroke-width="3" stroke-dasharray="6 5"/>
    <path d="M115 90 q-14 10 0 20 q14 12 0 20 M115 130 v10" stroke="#fcd34d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#fcd34d">MELODY</text>
    <text x="115" y="212" text-anchor="middle" class="st">queued · next phrase</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">QUEUED (dashed ring, calm pulse)</text>
  </g>
  <!-- ACTIVE -->
  <g transform="translate(520,20)">
    <rect width="230" height="260" rx="8" fill="#140f1a" stroke="#b91c1c" stroke-width="2"/>
    <circle cx="115" cy="110" r="46" fill="#b91c1c" fill-opacity="0.12"/>
    <text x="16" y="26" class="lbl" fill="#fca5a5">Pillar 1</text>
    <circle cx="115" cy="110" r="40" fill="#1c0f12" stroke="#b91c1c" stroke-width="3"/>
    <path d="M115 92 v36 M105 100 v20 M125 100 v20" stroke="#fca5a5" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#fca5a5">VOCALS</text>
    <circle cx="70" cy="206" r="5" fill="#22c55e"/><text x="115" y="211" text-anchor="middle" class="st">playing</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">ACTIVE (glow + green dot)</text>
  </g>
  <!-- PAUSED -->
  <g transform="translate(770,20)">
    <rect width="230" height="260" rx="8" fill="#140f1a" stroke="#15803d" stroke-opacity="0.7" stroke-width="2"/>
    <text x="16" y="26" class="lbl" fill="#86efac">Pillar 3</text>
    <circle cx="115" cy="110" r="40" fill="#0d1a11" stroke="#15803d" stroke-opacity="0.6" stroke-width="3"/>
    <rect x="106" y="96" width="6" height="28" fill="#9a9080"/><rect x="118" y="96" width="6" height="28" fill="#9a9080"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#86efac" opacity="0.7">BASS</text>
    <text x="115" y="212" text-anchor="middle" class="st">paused</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">PAUSED (static, pause glyph)</text>
  </g>
  <!-- MUTED -->
  <g transform="translate(145,320)">
    <rect width="230" height="260" rx="8" fill="#140f1a" stroke="#b91c1c" stroke-opacity="0.6" stroke-width="2"/>
    <text x="16" y="26" class="lbl" fill="#fca5a5">Pillar 1</text>
    <circle cx="115" cy="110" r="40" fill="#1c0f12" stroke="#6b6472" stroke-width="3"/>
    <path d="M115 92 v36 M105 100 v20 M125 100 v20" stroke="#6b6472" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <line x1="80" y1="78" x2="150" y2="142" stroke="#e6c877" stroke-width="3"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#9a9080">VOCALS</text>
    <text x="115" y="212" text-anchor="middle" class="st">muted · slider at 0</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">MUTED (slash overlay)</text>
  </g>
  <!-- DISABLED / OFFLINE -->
  <g transform="translate(405,320)">
    <rect width="230" height="260" rx="8" fill="#0d0c10" stroke="#3a3540" stroke-width="2"/>
    <defs><pattern id="hatch" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="10" stroke="#2a2730" stroke-width="3"/></pattern></defs>
    <rect x="2" y="2" width="226" height="256" rx="8" fill="url(#hatch)" opacity="0.5"/>
    <text x="16" y="26" class="lbl" fill="#6b6472">Pillar 4</text>
    <circle cx="115" cy="110" r="40" fill="#141319" stroke="#3a3540" stroke-width="3"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#6b6472">DRUMS</text>
    <text x="115" y="208" text-anchor="middle" class="st" fill="#b91c1c">disconnected</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">DISABLED (hatch + reason)</text>
  </g>
  <!-- FOCUS -->
  <g transform="translate(665,320)">
    <rect x="-4" y="-4" width="238" height="268" rx="11" fill="none" stroke="#e6c877" stroke-width="3"/>
    <rect width="230" height="260" rx="8" fill="#140f1a" stroke="#15803d" stroke-width="2"/>
    <text x="16" y="26" class="lbl" fill="#86efac">Pillar 3</text>
    <circle cx="115" cy="110" r="40" fill="#0d1a11" stroke="#15803d" stroke-width="3"/>
    <path d="M121 92 q10 4 10 16 q0 12 -14 12 M121 92 v40" stroke="#86efac" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#86efac">BASS</text>
    <text x="115" y="212" text-anchor="middle" class="st">focused (dj interaction)</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">FOCUS (gilt ring, 3px)</text>
  </g>
</svg>

### State model (how a pillar moves between states)

| State        | Trigger / source                                        | Distinguished by (non-colour cue too)                  |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------ |
| **empty**    | no tag detected on pillar                               | dim ring, "awaiting ingredient", desaturated name      |
| **queued**   | `ingredient_detected` / `clip_queued`                   | **dashed** medallion ring + calm pulse + "next phrase" |
| **active**   | `clip_started` / `clip_playing`                         | filled glow + green ● + waveform motion                |
| **paused**   | operator pause (dj)                                     | **pause glyph**, static, name dimmed                   |
| **muted**    | volume at 0 / mute toggle                               | **slash overlay** across medallion, greyed name        |
| **disabled** | WS/backend/Ableton unavailable (general "disconnected") | **diagonal hatch** + explicit reason text              |
| **focus**    | touch/keyboard focus (operator)                         | 3px gilt ring outside the card                         |

Every state has a **shape/text cue in addition to colour** so it survives colour-blindness and the dim installation lighting (PRD accessibility). This is the reusable contract WOW-007 builds against.

> **Contract note (disabled state):** the current socket contract has **no distinct per-pillar "reader offline" signal** — the frontend can only observe a general WS/backend/Ableton disconnect. So the disabled state is specified against that **general "disconnected"** condition. If a per-pillar reader-status signal is wanted, it is a **contract addition** to be raised (and approved) as part of WOW-007, not something this design assumes exists.

---

## 5. Full-screen composition from the reusable pillar component

The same pillar component, instantiated four times, composed into the full normal-mode screen — annotated to show the component boundaries and the shared regions (wordmark, cauldron, settings band, legend) that are _not_ part of the pillar component.

<svg viewBox="0 0 1024 1280" width="100%" style="max-width:520px;background:#0b0910;border:1px solid #333" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui" role="img" aria-label="Full screen composition annotated to show four instances of the pillar component around shared regions">
  <rect x="0" y="0" width="1024" height="1280" fill="#0c0a12"/>
  <!-- shared: wordmark -->
  <rect x="40" y="36" width="944" height="120" rx="6" fill="#0f0d16" stroke="#c9a24b" stroke-opacity="0.3" stroke-dasharray="5 4"/>
  <text x="512" y="104" text-anchor="middle" font-size="40" fill="#e6c877" letter-spacing="8" font-family="Fondamento,Georgia,serif">HEXOLOGY</text>
  <text x="512" y="140" text-anchor="middle" font-size="12" fill="#9a9080">shared region · wordmark (not part of pillar component)</text>
  <!-- four pillar-component instances -->
  <g stroke="#e6c877" stroke-dasharray="6 4" stroke-width="1.5" fill="none">
    <rect x="44" y="196" width="386" height="446" rx="10"/>
    <rect x="594" y="196" width="386" height="446" rx="10"/>
    <rect x="44" y="676" width="386" height="446" rx="10"/>
    <rect x="594" y="676" width="386" height="446" rx="10"/>
  </g>
  <g font-size="13" fill="#e6c877">
    <text x="60" y="220">‹PillarCard #1 · Vocals›</text>
    <text x="610" y="220">‹PillarCard #2 · Melody›</text>
    <text x="60" y="700">‹PillarCard #3 · Bass›</text>
    <text x="610" y="700">‹PillarCard #4 · Drums›</text>
  </g>
  <g font-size="13" fill="#8f8676">
    <text x="60" y="244">medallion · name · volume · status · queue</text>
    <text x="610" y="244">same structure, category = Melody</text>
    <text x="60" y="724">same structure, category = Bass</text>
    <text x="610" y="724">same structure, category = Drums</text>
  </g>
  <!-- category swatches to make instances legible -->
  <rect x="52" y="256" width="370" height="6" fill="#b91c1c"/>
  <rect x="602" y="256" width="370" height="6" fill="#a16207"/>
  <rect x="52" y="736" width="370" height="6" fill="#15803d"/>
  <rect x="602" y="736" width="370" height="6" fill="#1d4ed8"/>
  <!-- shared: cauldron -->
  <ellipse cx="512" cy="640" rx="120" ry="100" fill="#2a1840" fill-opacity="0.25"/>
  <path d="M462 640 q50 34 100 0 l-12 56 q-38 22 -76 0 z" fill="#0c0a10" stroke="#c9a24b" stroke-opacity="0.5"/>
  <text x="512" y="770" text-anchor="middle" font-size="12" fill="#9a9080">shared region · cauldron focal point</text>
  <!-- shared: settings band -->
  <rect x="44" y="1150" width="936" height="70" rx="8" fill="#0f0d16" stroke="#c9a24b" stroke-opacity="0.3"/>
  <text x="512" y="1180" text-anchor="middle" font-size="13" fill="#cbb98f">shared region · TEMPO · AUTO-ADJUST · KEY · KEY CONTROLS</text>
  <text x="512" y="1204" text-anchor="middle" font-size="12" fill="#9a9080">(visitor-visible in normal mode — ADR-003 amended)</text>
  <!-- shared: legend -->
  <g font-size="13">
    <circle cx="330" cy="1238" r="6" fill="#b91c1c"/><text x="342" y="1243" fill="#cbb98f">Vocals</text>
    <circle cx="430" cy="1238" r="6" fill="#a16207"/><text x="442" y="1243" fill="#cbb98f">Melody</text>
    <circle cx="530" cy="1238" r="6" fill="#15803d"/><text x="542" y="1243" fill="#cbb98f">Bass</text>
    <circle cx="620" cy="1238" r="6" fill="#1d4ed8"/><text x="632" y="1243" fill="#cbb98f">Drums</text>
  </g>
</svg>

**Composition rules:**

- The **four dashed boxes are the same component** with a `category` prop (Vocals/Melody/Bass/Drums) and a `state` prop (from §4). Nothing pillar-specific is hardcoded per corner — the only per-instance inputs are category and live state.
- **Shared, non-pillar regions:** wordmark, cauldron, settings band, legend. These are composed _around_ the four instances by the screen container.
- **Responsive behaviour (ADR-003 amended):** the 2×2 grid is the design-first layout at 1024×1280. Below the target (e.g. narrower windows), the grid reflows to a single column with the cauldron moving to a slim banner and the settings band stacking; above it, max-widths cap the content and the binding margins widen. The pillar component itself is fluid (percentage widths, `min` touch sizes), so reflow never resizes touch targets below the §7.1 floor.

---

## 6. Normal / DJ / Debug mode specifications

Three modes on **one screen** (ADR-003 amended; no separate page/overlay, ADR-005 hand-rolled state). dj and debug are **additive layers** over normal — normal is always the base. Each elevated mode has its **own hidden gesture** (the gesture _pair_ is HALT §8.1) and an **explicit close control visible only while active** (ADR-006).

### 6.1 Normal mode (visitor experience — the default)

- **Shows:** everything in §2/§5 — four pillar medallions + category names, per-pillar volume, currently-playing/queued state (no titles), cauldron, tempo slider, auto-adjust-key toggle + current key, key controls (Raise/Lower/Reset), legend.
- **Hides:** all clip/song identity, all diagnostics, all mode chrome.
- **Interactivity:** tempo, per-pillar volume, and key controls **remain visitor-visible and operable** (ADR-003 amended, human-confirmed 2026-07-11 — this resolves the audit's open "do these move to operator?" question: they **stay**). Destructive-ish controls (key reset) still get a confirm-gate per UX_UI_PRINCIPLES 2.
- **Entry/exit:** it is the base state; there is nothing to enter or close.

### 6.2 DJ mode (operator — extended per-pillar controls)

Adds, **beside each pillar**, an extended controls drawer. This is where the old debug modal's per-pillar clip control **moves to** (FR3; dissolving `DebugModalContainer`, closing audit UI-04/UI-05/UI-06).

- **Adds per pillar:** clip/sample selection (open the samples menu — search + filter by category/BPM/key, multi-select, sortable headers, per the wireframe's samples-modal annotations); play/pause; the queued list **with clip names**, each row with stop (■) and remove (×); simulated tag place/remove (the sim path). Song/artist metadata surfaces **here only** (FR2 "may move to operator surface — designer's call"; this proposal puts it in dj mode).
- **Keeps visible:** the whole normal-mode surface underneath (tempo/volume/key stay live).
- **Safety:** clip start/stop and tag actions get a **confirm-gate or an explicit "armed" affordance** — no single accidental tap fires a real Ableton trigger (UX_UI_PRINCIPLES 2; fixes audit UI-04).
- **Entry:** hidden gesture #1 (§8.1) — press-and-hold ~3 s on a themed element with subtle progress feedback.
- **Exit:** a persistent, clearly-labelled **"Exit DJ mode"** control shown only while dj mode is active (top-corner or settings-band). Also auto-times-out to normal after N minutes of no operator input (proposed safeguard so a walk-away doesn't leave operator controls exposed to visitors — value TBD, flag for review).

<svg viewBox="0 0 460 300" width="100%" style="max-width:420px;background:#0b0910;border:1px solid #333" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui" role="img" aria-label="DJ mode per-pillar extended controls drawer detail">
  <rect width="460" height="300" fill="#0c0a12"/>
  <text x="16" y="26" font-size="13" fill="#e6c877">DJ mode · Pillar 1 extended drawer (detail)</text>
  <rect x="16" y="40" width="428" height="240" rx="8" fill="#140f1a" stroke="#b91c1c" stroke-opacity="0.7"/>
  <circle cx="60" cy="86" r="26" fill="#1c0f12" stroke="#b91c1c" stroke-width="2"/>
  <text x="98" y="82" font-size="15" fill="#fca5a5" font-family="Georgia,serif">VOCALS</text>
  <text x="98" y="100" font-size="12" fill="#9a9080">now: “Ice Ice Vocals” · +2 queued</text>
  <rect x="30" y="122" width="180" height="44" rx="6" fill="#171019" stroke="#c9a24b" stroke-opacity="0.4"/>
  <text x="120" y="149" text-anchor="middle" font-size="13" fill="#ece3d0">＋ Select clip…</text>
  <rect x="222" y="122" width="100" height="44" rx="6" fill="#171019" stroke="#c9a24b" stroke-opacity="0.4"/>
  <text x="272" y="149" text-anchor="middle" font-size="13" fill="#ece3d0">▮▮ Pause</text>
  <rect x="334" y="122" width="100" height="44" rx="6" fill="#171019" stroke="#c9a24b" stroke-opacity="0.4"/>
  <text x="384" y="149" text-anchor="middle" font-size="12" fill="#fcd34d">Sim tag ⌾</text>
  <!-- queue rows with titles -->
  <rect x="30" y="176" width="404" height="40" rx="5" fill="#1b1016"/>
  <text x="44" y="201" font-size="13" fill="#ece3d0">Vocal Hook 07</text>
  <rect x="352" y="184" width="34" height="24" rx="4" fill="#241820"/><text x="369" y="201" text-anchor="middle" font-size="12" fill="#ece3d0">■</text>
  <rect x="394" y="184" width="34" height="24" rx="4" fill="#241820"/><text x="411" y="201" text-anchor="middle" font-size="12" fill="#fca5a5">×</text>
  <rect x="30" y="222" width="404" height="40" rx="5" fill="#1b1016"/>
  <text x="44" y="247" font-size="13" fill="#ece3d0">Vocal Chop 14</text>
  <rect x="352" y="230" width="34" height="24" rx="4" fill="#241820"/><text x="369" y="247" text-anchor="middle" font-size="12" fill="#ece3d0">■</text>
  <rect x="394" y="230" width="34" height="24" rx="4" fill="#241820"/><text x="411" y="247" text-anchor="middle" font-size="12" fill="#fca5a5">×</text>
</svg>

### 6.3 Debug mode (operator — diagnostics only)

Adds a **small panel docked to the bottom** with diagnostics **only** — no clip/performance controls (those are dj mode). This is the confirmed baseline (ADR-003, PRD FR3); extras are HALT §8.4.

- **Shows (confirmed baseline):** rolling **log of API calls + socket events**; **connection state** (WS connected/disconnected, last event timestamp, reconnect status — closes audit UI-01); **versions** (app build, backend/contract if available); the **SIMULATED badge** when running against `sim/` (UX_UI_PRINCIPLES 10 — currently absent, audit finding). An **idle-timeout indicator** reflecting `timeout_warning` (closes audit UI-17) belongs here too.
- **The debug panel itself adds no performance controls** — no clip controls, and it contributes no volume/tempo/key controls of its own. (The normal-mode base tempo/volume/key controls remain visible above the ≤ 30% dock, per the §6.4 matrix; debug is an additive diagnostics layer, not a replacement surface.)
- **Entry:** hidden gesture #2 (§8.1) — a _different_ element/duration from dj, so the two are unambiguous.
- **Exit:** explicit **"Close debug"** control on the panel; the panel is a bottom dock that does not obscure the pillar grid.
- **Presentation:** monospaced, dense but readable log; newest at bottom, auto-scroll with a pause-on-touch; the panel occupies ≤ 30% of screen height so the visitor grid remains legible above it.

<svg viewBox="0 0 460 210" width="100%" style="max-width:420px;background:#0b0910;border:1px solid #333" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,monospace" role="img" aria-label="Debug mode bottom diagnostic panel detail">
  <rect width="460" height="210" fill="#0c0a12"/>
  <text x="16" y="24" font-size="12" fill="#e6c877" font-family="ui-sans-serif">Debug mode · bottom diagnostic dock (detail)</text>
  <rect x="12" y="34" width="436" height="164" rx="6" fill="#0f0d15" stroke="#c9a24b" stroke-opacity="0.35"/>
  <circle cx="30" cy="56" r="6" fill="#22c55e"/><text x="44" y="60" font-size="12" fill="#ece3d0" font-family="ui-sans-serif">WS connected · sim :3335</text>
  <rect x="250" y="46" width="90" height="22" rx="11" fill="#3a2a12"/><text x="295" y="61" text-anchor="middle" font-size="11" fill="#fcd34d" font-family="ui-sans-serif">SIMULATED</text>
  <text x="352" y="60" font-size="11" fill="#9a9080" font-family="ui-sans-serif">v2.3.1 · contract 4.6</text>
  <line x1="20" y1="74" x2="440" y2="74" stroke="#241f14"/>
  <text x="24" y="94" font-size="11" fill="#86efac">12:04:07  ← clip_started {pillar:0, bpm:130}</text>
  <text x="24" y="112" font-size="11" fill="#93c5fd">12:04:07  → set_tempo 130</text>
  <text x="24" y="130" font-size="11" fill="#86efac">12:04:09  ← ingredient_detected {pillar:1}</text>
  <text x="24" y="148" font-size="11" fill="#fcd34d">12:06:41  ⚠ timeout_warning (T-30s)</text>
  <text x="24" y="166" font-size="11" fill="#9a9080">12:06:44  ← clip_queued {pillar:1}</text>
  <rect x="352" y="176" width="86" height="18" rx="4" fill="#171019"/><text x="395" y="189" text-anchor="middle" font-size="10" fill="#ece3d0" font-family="ui-sans-serif">Close debug</text>
</svg>

### 6.4 Mode matrix

| Capability                                          | normal  |     dj     |   debug    |
| --------------------------------------------------- | :-----: | :--------: | :--------: |
| Category medallions + names, legend, cauldron       |    ●    |     ●      |     ●      |
| Tempo / per-pillar volume / key controls            |    ●    |     ●      |     ●      |
| Song/clip names & metadata                          |    —    |     ●      |     —      |
| Per-pillar clip select / play / pause / sim-tag     |    —    |     ●      |     —      |
| Diagnostics log / connection / versions / SIMULATED |    —    |     —      |     ●      |
| Entry                                               | default | gesture #1 | gesture #2 |
| Explicit close control                              |   n/a   |     ●      |     ●      |

> Modes are **not mutually exclusive by requirement**, but this proposal recommends **one elevated mode active at a time** (entering debug closes dj and vice-versa) to keep the operator's mental model simple. Flag for confirmation — an operator _could_ want the diagnostic dock visible while DJ-ing.

---

## 7. Touch, contrast, typography, motion & viewing-distance guidance

Installation context: a public, unattended touch kiosk in a **dim** room, embedded in a physical grimoire, read at roughly **arm's length to ~1 m**. That drives every number below.

### 7.1 Touch targets

- **Minimum 44×44 px** for any control (WCAG 2.5.5 AAA), **target 56×56 px** for primary operator controls given the dim, public, gloved-or-hurried context. This fixes the audit's `h-6` (24 px) toggle and unstyled native slider thumbs (UI-05).
- **≥ 8 px spacing** between adjacent targets; dj-mode queue rows ≥ 56 px tall.
- **Touch-only — no hover-gated affordances** (UX_UI_PRINCIPLES 8). Nothing critical may depend on `:hover`.
- Sliders get an enlarged invisible hit area around the visible gilt thumb.

### 7.2 Contrast (WCAG AA for operator-critical text)

- **Operator-critical text** (tempo/BPM, key, connection state, log, any status) must meet **AA: 4.5:1** normal, **3:1** large (≥ 24 px or ≥ 19 px bold). Verify with a checker on the final palette.
- **The category-hue caution (from §0/§3.3):** raw `-700` category colours on the near-black page **fail AA as text**. Rough estimates on `#0e0b12` (verify with a checker before quoting downstream): Vox `#b91c1c` ≈ 3.0:1, Bass `#15803d` ≈ 3.9:1, Melody `#a16207` ≈ 4.0:1, Drums `#1d4ed8` ≈ 2.9:1 — **all four fall short of the 4.5:1 body-text bar, with Drums the lowest**. **Therefore category text uses the `-300` tints** (`#fca5a5`/`#fcd34d`/`#86efac`/`#93c5fd`, all ≥ 4.5:1 on the page); the `-700` hues are used only for **fills/borders/LED-match**, where 3:1 non-text contrast (WCAG 1.4.11) is sufficient.
- **Non-text caveat — Drums ring:** at ≈ 2.9:1, the Drums `-700` (`#1d4ed8`) is marginally **under** the 3:1 threshold for a category/state-encoding border or medallion ring (1.4.11). WOW-007's automated contrast pass must verify the Drums ring/border specifically and, if it fails, lighten it (e.g. an inner `-300` stroke) so the category indicator clears 3:1.
- **Decorative type is exempt** from the data-contrast rule but the wordmark still clears 3:1.
- **Do not rely on colour alone** — every category and every pillar state carries an icon/shape/text cue (§4; PRD accessibility).
- Fold an automated contrast pass (axe-core / Lighthouse) into WOW-007 acceptance, since the current baseline had unverified low-contrast labels (audit UI-16).

### 7.3 Typography & legibility at distance

- **Two families:** decorative `type/display` for atmosphere; legible `type/data` sans for all status/data (UX_UI_PRINCIPLES 7). Family choice is HALT §8.2.
- **Minimum sizes** at this viewing distance: data/status **≥ 15 px**, small-caps labels **≥ 12 px**, pillar/category names **≥ 24 px** (they're primary visitor info — larger is better), key glyph large. No tiny text (visual-direction "Do not copy: tiny text").
- Category names sit directly under their medallion so **icon + name + colour** reinforce each other (three redundant cues).

### 7.4 Motion & photosensitivity

- **No rapid flashing / strobe — ever** (UX_UI_PRINCIPLES 3; hardware-safety principle applies to screens too). Nothing flashes faster than ~1 Hz, and nothing high-contrast flashes at all.
- Ambient motion is limited to: the **cauldron plume** (slow drift), a **calm pulse** on queued medallions (gentle opacity, ≥ 1 s cycle), and a subtle waveform on active pillars.
- **`prefers-reduced-motion`: respected** — replace all ambient animation with static states (fixes audit UI-15's total absence of reduced-motion handling). Queued state must remain distinguishable **without** the pulse (the dashed ring carries it).
- State changes "announce themselves without alarming visitors" (UX_UI_PRINCIPLES 3): cross-fades, not cuts.

### 7.5 Recovery & status visibility (closes audit blockers)

- **Disconnect (UI-01):** a persistent, non-flashing **warning/error banner** (tokens §3.9) appears on WS/Ableton drop in _all_ modes, with the affected pillar(s) shown in the **disabled** state (§4). An operator should diagnose "why is pillar 3 silent" in seconds (UX_UI_PRINCIPLES 4).
- **Idle timeout (UI-17):** at `timeout_warning` (T-30s) a calm warning appears; when the system returns to attractor state the pillars visibly clear.
- **SIMULATED badge (UX_UI_PRINCIPLES 10):** always visible (subtly) when connected to `sim/`, prominent in debug mode.

---

## 8. HALT items — require human/artist sign-off (NOT decided here)

The four items below are visual-identity / access decisions reserved for the human and artists. Each is presented as options with trade-offs. **None is pre-decided.** WOW-007 slicing is blocked on these four choices.

### 8.1 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — dj-mode & debug-mode gesture pair (NOT decided)

Constraints (fixed): each elevated mode has its **own** hidden gesture; both are **press-and-hold ~3 s on a themed element** with subtle progress feedback; **no visible affordance** for visitors; the two must be **distinguishable** so an operator never enters the wrong one; explicit close while active (ADR-006).

| Option                                    | dj gesture                                                         | debug gesture                                                     | What distinguishes them              | Trade-offs                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **A — two distinct seals**                | 3 s hold on a **wax seal** at the bottom-left of the settings band | 3 s hold on a **small sigil/eye** on the cauldron                 | Different location + different motif | Two learnable spots; both feel "in-world"; cauldron is central so easy to reach; low accidental-trigger risk       |
| **B — same element, two durations**       | 3 s hold on the **cauldron sigil**                                 | **6 s** hold (or 3 s + second tap) on the **same** cauldron sigil | Duration, not location               | One spot to teach; but two durations on one element are easy to confuse and harder to signal via progress feedback |
| **C — corner bookmark vs. binding clasp** | 3 s hold on a **ribbon bookmark** (top-right ornament)             | 3 s hold on the **binding clasp** (left margin)                   | Opposite corners, distinct ornaments | Both peripheral (away from visitor-touched centre → fewer accidents); slightly less discoverable for the operator  |

**Progress feedback (applies to whichever option):** a gold ring fills clockwise around the held element over the hold duration; completing triggers the mode, releasing early cancels with no state change. Recommendation to consider: **Option A** (distinct location _and_ motif is the most confusion-proof), but **this is the artists' call.**

### 8.2 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — typography (NOT decided)

Fondamento is the current display face. Question: keep it, and what legible face pairs with it for data?

| Option                               | Display face                                                                              | Data/legible face      | Trade-offs                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **A — keep Fondamento**              | Fondamento (as today)                                                                     | Inter (or system sans) | Zero new display asset; Fondamento is calligraphic/thematic; Inter is highly legible for status/log       |
| **B — heavier ceremonial display**   | A blackletter-adjacent or engraved serif (e.g. a Cinzel/UnifrakturCook-class face)        | Inter / Source Sans    | Stronger "grimoire" wordmark impact; risk of lower legibility for names; new font asset + licensing check |
| **C — single humanist-serif system** | One legible serif with decorative caps (e.g. Cormorant) for display, same family for data | same family            | Most cohesive, fewer files; less overt "occult" flavour; caps must be verified legible at name sizes      |

All options keep the **hard rule**: operator-critical text (tempo, key, connection, log) uses the **legible** face only, never the decorative one. Recommendation to consider: **Option A** (Fondamento already in the repo and on-brand) unless the artists want a bolder wordmark — **their call.**

### 8.3 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — palette within the witchy/occult direction (NOT decided)

Category hues are constrained to `ColorUtil` (`-700`, LED-matching) but **PRD F4 permits restyling those values in that one function**, and the surrounding page/gold/ink palette is open. Three directions:

| Option                                      | Page / surface                                                            | Gold / detailing                         | Ink / data text                         | Category treatment                                                                                         | Mood                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **A — "Obsidian & Gilt"** (used in mockups) | near-black `#0e0b12`→`#080609`                                            | warm gold `#c9a24b`/`#e6c877`            | warm off-white `#ece3d0`                | ColorUtil `-700` fill + `-300` text tints, unchanged                                                       | Restrained, classic grimoire; matches concept art's "black + fine gold"                                         |
| **B — "Ink & Verdigris"**                   | very dark green-black `#0b1210`                                           | aged brass + verdigris `#8fae8f` accents | parchment `#e8e0cc`                     | keep `-700` but shift page-hue so greens/blues sit more naturally                                          | Alchemical, herbal-witch; risks muddying Bass/Drums against a greenish page — verify contrast                   |
| **C — "Candlelit Parchment panels"**        | black page, but pillar _panels_ use a dark-parchment inset `#171019`→warm | gold `#c9a24b`                           | ink brown-black on the parchment insets | ColorUtil hues restyled slightly warmer (Vox→toward concept pink, Melody→toward amber) to sit on parchment | Closest to the concept art's warmth; the ColorUtil restyle must stay single-source and re-verified against LEDs |

Whatever is chosen must keep **AA data contrast** (§7.2) and keep the **`-700` fill / `-300` text** dual-role. If Option C's ColorUtil restyle is chosen, the LED colours the visitor sees in the room should be re-checked for match (PROJECT_BRIEF). Recommendation to consider: **Option A** (safest contrast + closest to the stated "black with fine gold" language) — **artists decide.**

### 8.4 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — debug-panel extras beyond baseline (NOT decided)

Confirmed baseline (not in question): API/socket-event log, versions, connection state. Proposed **optional** extras — pick any subset:

| Extra                                                  | Value                                       | Cost/risk                                        |
| ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------ |
| **Log filtering** (by event type / direction / pillar) | Faster triage of "why is pillar 3 silent"   | More UI in a small panel; keep it one-line chips |
| **Copy / export log**                                  | Hand a log to a developer after a show      | Clipboard/file affordance; trivial               |
| **Pause auto-scroll / freeze**                         | Read a line without it scrolling away       | Small toggle                                     |
| **Clear log**                                          | Reset noise mid-show                        | Must not clear anything but the view buffer      |
| **Event counters / rate**                              | Spot a flood or a silent socket at a glance | Minor computation                                |
| **Last-N filter / search**                             | Find a specific event                       | Text input on a touch kiosk is slow — weigh it   |

Recommendation to consider: **log filtering + copy/export + pause-scroll** as the useful trio; search is low-value on a touch kiosk. **Human decides the subset.**

---

## 9. Traceability — how this improves on the audit baseline

| Audit finding (WOW-004)                                                 | Addressed by                                                                                                   |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **UI-01** silent disconnect (blocker)                                   | §3.9 warning/error tokens, §4 disabled state, §6.3 connection state, §7.5                                      |
| **UI-03/UI-13** invisible single-tap operator trigger                   | §6/§8.1 hidden press-and-hold gestures with progress feedback; operator entry no longer a bare tap target      |
| **UI-04** unconfirmed clip triggers                                     | §3.5, §6.2 confirm-gate / armed affordance                                                                     |
| **UI-05/UI-06** debug modal overflow / see-through / non-existent class | Modal **dissolved**; clip control → dj drawer, diagnostics → bottom dock (§6.2/§6.3); `surface/overlay` opaque |
| **UI-07/UI-14** a11y labels not reflecting state                        | §4 state model with explicit text/shape cues per state                                                         |
| **UI-15** no reduced-motion                                             | §7.4 `prefers-reduced-motion` respected; queued state legible without pulse                                    |
| **UI-16** unverified low contrast                                       | §7.2 AA rule + `-300` text tints + automated pass in WOW-007                                                   |
| **UI-17** idle timeout unhandled                                        | §6.3 idle-timeout indicator, §7.5                                                                              |
| SIMULATED not labelled (principle 10)                                   | §3.9 + §6.3 SIMULATED badge                                                                                    |
| Song/artist on visitor screen (F3)                                      | Removed from visitor surface; lives only in dj mode (§6.2)                                                     |
| Recipe/spell removal (F5)                                               | Not present anywhere in this design                                                                            |

## 10. Open questions carried for WOW-007 (non-HALT)

- **DJ auto-timeout to normal** after operator inactivity — proposed safeguard (§6.2); confirm value or drop.
- **Concurrent debug + dj** — this proposal recommends one-elevated-mode-at-a-time (§6.4); confirm.
- **Samples-menu scope in dj mode** — the wireframe specifies search + category/BPM/key filters + sortable headers + multi-select; confirm this full scope for the first implementation or slice a minimal version first.
- **Responsive floor** — smallest size the reflow (§5) must support; the target is fixed at 1024×1280 but the graceful-scaling range needs a stated min/max for WOW-007 acceptance.

---

_End of Design Proposal 001. Proposal only — no code, no visual-identity decisions made. The four ⚠️ HALT items in §8 require human/artist sign-off before WOW-007._
