# Design Proposal 001 — Grimoire UI (visitor display + operator surface)

Ticket: **WOW-006** — Grimoire design proposal
Author: frontend-ui-designer
Status: **PROPOSAL — awaiting human/artist sign-off.** Docs-only; no code.
Depends on: WOW-004 (`docs/UI_AUDIT.md`), ADR-003/005/006 (amended), PRD F1–F6.
Canonical viewport: **1024 × 1280 portrait touch** (a 1280×1024 panel rotated to portrait). Design-first for this exact size; layout must also scale gracefully / responsively to other sizes.

---

## ⛔ Visual status (human review 2026-07-15 — REQUEST CHANGES)

The first-round **high-fidelity visual mockup was rejected** by the human/artists. This revision:

- **Structural / specification work** (layout, hierarchy, pillar anatomy, modes, states, touch, accessibility, motion, responsive, socket-contract constraints, sequencing): **under review — retained as proposals.**
- **Visual mockup (old §2 inline SVG):** **rejected and removed.** No inline SVG in this document is a visual design; the remaining SVGs are **structural diagrams only** (see the diagram disclaimer below).
- **Typography:** old Fondamento recommendation **withdrawn**; three new directions proposed with rendered specimens — **awaiting human choice** (§3.4 / §8.2).
- **Iconography:** improvised SVG icons **rejected**; a coherent icon strategy is proposed — **awaiting human choice** (§3.3 / asset inventory §3.11).
- **Primary visual direction:** the human-selected graphic-occult concept **`docs/design/hexology-grimoire-concept-3.png`** (§2).
- **WOW-007 implementation:** **blocked** pending human visual approval; the first UI ticket is a limited **visual-fidelity spike (WOW-007A)**.

### 🔒 Visual-fidelity gate

> **Human visual approval is required before implementation tickets beyond the visual spike (WOW-007A) may begin. Structural reviewers, accessibility reviewers, Copilot, and documentation reviewers cannot grant visual-art-direction approval on behalf of the human/artists.** Completeness of this document does **not** constitute visual approval.

### 📐 Diagram disclaimer (applies to every inline SVG below)

Every inline SVG in this document is a **low-fidelity structural diagram** — one of: _layout diagram_, _component-anatomy diagram_, or _interaction/state diagram_. They exist to communicate **geometry, placement, hierarchy, and state logic only.** Their glyphs, "icons", type, colour fills, and ornament are **neutral placeholders, not final art** — the approved look and quality bar is the reference image in §2, and the concrete assets are specified in the asset inventory (§3.11). No hand-drawn SVG in this doc may be treated as approved iconography, illustration, typography, or ornamentation.

---

## 0. How to read this document

This is a **design-direction proposal**, not an implementation spec and not code. Everything here is a recommendation for a human to accept, adjust, or reject before WOW-007 slicing begins.

- Sections **1–7** are the seven required design outputs from the ticket.
- Section **8** holds the **four HALT items** that require human/artist sign-off. They are presented as clearly-labelled options with trade-offs and are **deliberately not decided**. Look for the ⚠️ marker.
- All inline SVGs are **low-fidelity structural diagrams** (see the diagram disclaimer above). They are not app components, not visual designs, and contain no product code.
- Two authorities, never conflated (per `docs/design/visual-direction.md`): the **wireframe + requirements** govern layout/placement/controls; the **primary reference image (§2)** governs visual style and quality. Where a concept image and the requirements disagree on _layout_, **the requirements win**; deviations are marked **[Requirements over concept]**.

### Source-of-truth precedence used throughout

1. **Product requirements and the existing socket contract** (PRD F1–F6 / FR1–FR7, UX_UI_PRINCIPLES, ADR-003/005/006).
2. **The wireframe `docs/design/Hex_layout_concept.svg`** — for layout, placement, controls, information hierarchy, and modes.
3. **The primary visual reference `docs/design/hexology-grimoire-concept-3.png`** (§2) — the human-approved authority for **visual style and quality**. No longer "mood only": it is the art-direction target and quality bar. Its AI-generated text, exact spacing, invented controls, and distorted proportions are **non-literal** (see §2).
4. **Written implementation constraints** (this document; `docs/design/visual-direction.md`).

The landscape concept `hexology-grimoire-concept.png` is **secondary mood reference only** and not a layout or quality target.

### Reference palette used in the diagrams

The diagrams below are drawn in **Palette Option A ("Obsidian & Gilt")** purely so the structural artefacts are legible. **The page palette is HALT item 3 (§8.3) and is NOT decided.** (Category hues are separate and mostly settled: Vocals red per spec, Bass green, Drums blue; only Melody amber-vs-yellow is open — §3.3/§8.3.) Swapping palettes changes no layout, hierarchy, or component structure here.

### One tension to surface up front — category hue source

`src/util/ColorUtil.ts` is the **single source of truth** for category colour (PRD F4). Note it currently returns **Tailwind class names**, not hex — `getBackgroundColorFromType` maps **Vox → `bg-red-700`, Bass → `bg-green-700`, Drums → `bg-blue-700`, Melody → `bg-yellow-700`**. The hex values quoted throughout this doc (**Vox `#b91c1c`, Bass `#15803d`, Drums `#1d4ed8`, Melody `#a16207`**) are those Tailwind `-700` tokens **resolved against the default palette**, used here so the structural diagrams render — if the Tailwind theme is ever customised, the tokens (the class names) remain the contract and the hex follows. The concept art instead paints Vocals pink/magenta and Melody amber. **Requirements win: this proposal uses the ColorUtil `-700` tokens** (they also match the LED colours the visitor sees around them, `PROJECT_BRIEF`). **Vocals stays red per the original spec — the reference's pink does not apply** (human, decided 2026-07-15). The only category hue still open is **Melody** (amber vs yellow-700), decided at the §8.3 sign-off as a single-source-of-truth change inside `ColorUtil`, not per-component divergence.

**Critical a11y consequence, carried into §3 and §7:** the raw `-700` hues on a near-black page **fail WCAG AA for text** (e.g. blue-700 on the `#0e0b12` page ≈ 2.9:1 — see §7.2 for all four). So this system uses each category hue in **two roles**: the **`-700` fill** for medallions/LED-matching accents (recognition), and a **lightened `-300` tint** for any category _text_ (legibility). See §3.3 and §7.2.

---

## 1. Low-fidelity full-screen layout (1024 × 1280 portrait)

Structure and hierarchy only — no colour, texture, or type styling. This is the skeleton every later artefact inherits. It follows the wireframe: wordmark on top, a **2×2 pillar grid around a central cauldron focal point**, and a bottom status/settings band carrying tempo, key, and the legend.

**Visible Help + Settings (corrected 2026-07-15).** The approved reference (§2) **and** the wireframe both place visible **Help** and **Settings** controls top-right, and the wireframe annotates Settings as "toggle a modal with more settings, such as which mode is visible." The earlier revision omitted these on an ADR-006 reading ("hidden gestures, no visible affordance"); the human review reversed that — **Help and Settings are present.** Mode access is therefore via the **visible Settings modal** (wireframe-authoritative), which **supersedes the hidden-gesture-only reading of ADR-006** (now **ADR-006 amended 2026-07-15**). Whether a hidden gesture is _also_ retained as a secondary/again-covert path is an open access-model question (§8.1). See "remaining human choices" in the PR.

<svg viewBox="0 0 1024 1280" width="100%" style="max-width:520px;background:#fbfbfd;border:1px solid #ccc" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui" role="img" aria-label="Low fidelity wireframe of the 1024 by 1280 portrait layout">
  <rect x="0" y="0" width="1024" height="1280" fill="#ffffff"/>
  <!-- page margin -->
  <rect x="24" y="24" width="976" height="1232" fill="none" stroke="#bbb" stroke-dasharray="4 4"/>
  <!-- header / wordmark -->
  <rect x="40" y="40" width="944" height="120" fill="#f2f2f5" stroke="#888"/>
  <text x="512" y="94" text-anchor="middle" font-size="34" fill="#333" letter-spacing="6">HEXOLOGY WORDMARK</text>
  <text x="512" y="126" text-anchor="middle" font-size="16" fill="#999">— clear space kept beneath the logo —</text>
  <!-- visible Help + Settings (wireframe + reference) -->
  <rect x="760" y="52" width="98" height="44" fill="#eaeaef" stroke="#888"/>
  <text x="809" y="79" text-anchor="middle" font-size="15" fill="#555">? Help</text>
  <rect x="872" y="52" width="112" height="44" fill="#eaeaef" stroke="#888"/>
  <text x="928" y="79" text-anchor="middle" font-size="15" fill="#555">⚙ Settings</text>
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
  <text x="235" y="492" text-anchor="middle" font-size="13" fill="#777">Currently playing (name in dj; state-only in normal — F3)</text>
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
  <text x="512" y="760" text-anchor="middle" font-size="11" fill="#aaa">(clickable — plays a random SFX, per wireframe)</text>
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

## 2. Primary visual reference (approved direction and quality bar)

The first-round hand-drawn "visual-direction mockup" has been **removed**. The approved visual direction is the human-selected concept image below — it is the **quality bar and art-direction target**, not loose mood inspiration. _(Updated 2026-07-15: the reference image was replaced by the human with a higher-fidelity render, `hexology-grimoire-concept-3.png`, superseding the earlier `-concept-2`.)_

![Hexology — Primary visual reference (approved direction and quality bar): portrait graphic-occult concept, near-black ground, antique-gold engraved linework, ceremonial HEXOLOGY wordmark, central cauldron with magenta plume, four symmetrical pillar panels in magenta/amber/green/blue.](design/hexology-grimoire-concept-3.png)

**`docs/design/hexology-grimoire-concept-3.png` — Primary visual reference — approved direction and quality bar.**

> **Two authorities (see `docs/design/visual-direction.md`):** this image is the authority for **visual style and quality**. The **wireframe (`Hex_layout_concept.svg`) + product requirements** remain the authority for **placement, controls, text, hierarchy, and proportions**. Where they disagree on layout, the wireframe/requirements win; where the question is "how should it look and how polished must it be," this image wins.

### Qualities the implementation MUST preserve

- **Visual hierarchy** — wordmark → four pillars → central cauldron → global controls/legend, with generous negative space.
- **Adult, ceremonial tone** — otherworldly and sophisticated; never cute, storybook, or game-asset.
- **Restrained antique-gold linework** on a **near-black** ground; engraved / screen-printed feel.
- **Black negative space** as an active design element (not filled with clutter or glossy gradient).
- **Symmetrical pillar geometry** — four identical ornate frames, circular category medallions.
- **Category-colour accents** — one strong hue per category. **Note [Requirements over reference]:** the category _hues_ follow `ColorUtil`/PRD F4, **not** the reference's palette — in particular **Vocals is red, not the reference's pink** (human, 2026-07-15). Bass = green, Drums = blue; Melody (amber vs yellow) is open (§3.3 / §8.3).
- **Central cauldron emphasis** — a professionally illustrated/engraved focal object with a magical plume, naturally proportioned.
- **A clear distinction between decoration and functional controls** — ornament frames the data; controls stay obviously operable.

### Aspects that are NOT literal requirements (do not copy)

- Any **AI-generated text / values** (e.g. the `79%`, `Db MAJOR +7A`, "2 waiting" strings) — placeholder only; real content obeys the contract and PRD F3/F5.
- **Exact spacing and proportions** — the wireframe governs placement.
- **Fake or extra controls** invented by the image generator.
- **Exact ornamental details** — match the _family_ and quality, not every filigree.
- Any **distorted proportions** (squashed cauldron, uneven frames, colliding logo).

### What this reference now depicts (new in `-concept-3`)

The updated reference is a fuller render and usefully concretises several elements: **potion-tube vertical volume sliders** with gem/diamond thumbs (a stronger treatment than a plain rail); a **"Current status" field** per pillar (PLAYING / QUEUED); a **queued indicator** shown as **colour pips + "N waiting"** with **no track titles** (this is F3-friendly — it conveys state without song identity); a **per-pillar waveform**; the **current key with transpose amount** (`Db MAJOR +7A`); and the visible **Help / Settings**, tempo, auto-adjust-key toggle, key controls, and legend. These are consistent with the spec and can be treated as the intended _normal-mode_ visual.

> **Icon note (resolved 2026-07-15 — human):** this reference draws **Melody as a sine-wave** and **Bass as a hexagram**, but the **icon spec keeps the conventional, immediately-recognisable set: mic / treble-clef / bass-clef / drum-kit** (§3.3). The reference's sine-wave/hexagram are treated as **art-license, not the icon spec** — matching the human's rule that no arbitrary occult symbol may stand in for a music category. Follow the reference for _everything else_ (tone, colour, ornament, cauldron, frames); follow §3.3 for the category icons.

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

> **⚠️ Pillar border/frame is illustrative — several options to choose from (HALT §8.5).** The ornate frame in the reference image (and the 2px hue border in these diagrams) is **an example, not the decided treatment**. The human wants **several border/frame styles to choose from** — see the options in **§8.5**. Whatever is picked, all four pillars must share the **same** frame (symmetry requirement) and it must not compete with the data (visual-direction rejection list).

### 3.3 Sample-type accents (dual-role — the a11y core)

| Category         | Category hue (direction)                                    | ColorUtil fill (`-700`) | Text tint (`-300`) | Icon meaning (icon system — §3.11)      |
| ---------------- | ----------------------------------------------------------- | ----------------------- | ------------------ | --------------------------------------- |
| **Vocals (Vox)** | **red** — original spec; **overrides the reference's pink** | `#b91c1c` (red-700)     | `#fca5a5`          | Vintage / clear **microphone**          |
| **Melody**       | amber / orange vs yellow-700 — **open (§8.3)**              | `#a16207` (yellow-700)  | `#fcd34d`          | **Treble clef**                         |
| **Bass**         | **green** (already aligned)                                 | `#15803d`               | `#86efac`          | **Bass clef**                           |
| **Drums**        | **blue** (already aligned)                                  | `#1d4ed8`               | `#93c5fd`          | **Drum kit / snare** (clear percussion) |

> **Category-hue direction:** **Vocals = red** per the **original spec** (PRD F4 / `ColorUtil` red-700) — this **overrides the reference image's pink** (human, 2026-07-15). It is a **[Requirements over reference]** case: category colour follows the requirements/contract, not the concept art (the reference remains the authority for _everything else_). **Bass = green** and **Drums = blue** already match `ColorUtil`. **Melody** is the one open category-colour question — the reference leans amber/orange vs `ColorUtil`'s yellow-700 (`#a16207`); resolve at the §8.3 sign-off and re-verify against the physical pillar LEDs. `ColorUtil` stays the single source of truth; keep the **saturated fill / lighter text** dual-role for AA (§7.2).
>
> **Icon set decided (2026-07-15):** the conventional **mic / treble-clef / bass-clef / drum-kit** set above is the spec, chosen over the reference image's sine-wave (Melody) / hexagram (Bass) so each icon is immediately recognisable as its music category (see §2). The four category meanings must be **immediately recognisable** and drawn from **one coherent icon system** (matching stroke weight, detail, optical scale, circular medallion presentation) — see the icon strategy in **§3.11**. **No arbitrary occult symbol** may stand in for a music category, and **no hand-authored primitive path** (like the placeholder glyphs in this doc's diagrams) may ship as a final icon.
>
> **Colour rule:** never render category _text_ in the raw `-700` hue on the dark page — it fails AA (§7.2). Use the `-300` tint for text; reserve `-700` for fills/borders/LED-matching. Every category must also be **distinguishable by icon shape alone** (PRD accessibility — colour-independent identification).
>
> **Tint note:** the Melody text tint `#fcd34d` is Tailwind **amber-300**, deliberately chosen over true yellow-300 (`#fde047`) for a warmer, on-brand cast that still clears AA (≈ 13.5:1). The other three are the straight `-300` of their category hue.

### 3.4 Typography (token roles only; family choice = HALT §8.2 — **Fondamento withdrawn**)

This section defines **roles**, not the final families. **Fondamento is no longer recommended** for any role (human review 2026-07-15). The three candidate directions — each with a named display + UI face, licensing, and **rendered specimens** — are in **§8.2** and the specimen page `docs/design/typography-specimens.html`. No pairing is chosen here.

| Token          | Role                                                                        | Direction                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `type/display` | Wordmark, pillar/category names, major headings, key glyph                  | Sophisticated **engraved / ceremonial / editorial / cinematic** face (§8.2) — decorative use limited to logo, category names, major headings |
| `type/data`    | Status, tempo/BPM, connection, queue rows, logs, all operator-critical text | A **highly legible** UI face — **never** the decorative one                                                                                  |
| `type/label`   | Small-caps section labels ("QUEUED", "TEMPO")                               | The legible UI face, letter-spaced                                                                                                           |
| Sizes          | display 26–52 / data 15–18 / label 12 (see §7.3 minimums)                   |                                                                                                                                              |

Principles (UX_UI_PRINCIPLES 7): the display face is **adult, not playful** — **no novelty blackletter, handwritten, faux-medieval, or whimsical calligraphic** UI text; decorative type is limited to logo / category names / major headings; **every** operator-critical string uses the legible UI face; both faces must read at installation distance.

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
| `medallion/icon`     | from the coherent icon system (§3.11), category `-300` tint — **not** a hand-drawn primitive                          |

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

### 3.11 Icon strategy & asset inventory

The improvised SVG icons from the first round are **rejected**. Icons and primary artwork must be produced as real assets to the §2 quality bar — **not** hand-authored primitive paths, and **not** a generic icon pack that looks like an ordinary dashboard.

**Icon strategy — the category medallion set (microphone / treble clef / bass clef / drum kit).** One coherent system, matching stroke weight, detail, optical scale, circular medallion presentation, legible at final physical size. Two acceptable routes; the choice is a HALT-adjacent decision for the human:

1. **A properly-licensed cohesive SVG icon family** that actually contains all four music meanings (a microphone, a treble clef, a bass clef, and a clear percussion/drum-kit mark) in one consistent style — record the exact family, version, and licence (e.g. SIL OFL / MIT / CC-BY) and its repo-use suitability. Note: general UI icon sets (Lucide, Phosphor, Tabler, Material Symbols) reliably cover _microphone_ and _drums_ but **usually lack true treble/bass clefs**, so a pure-pack route often can't stay coherent → route 2 is likely.
2. **A bespoke icon-asset task** (four engraved medallion icons drawn to the §2 style by the artists/designer), with **clearly-labelled neutral placeholders** used until those assets exist. **Placeholders must never be presented as approved final iconography.**

> The diagrams in this document use neutral placeholder glyphs only. **No icon in this document is approved.**

**Asset inventory** (produced to the §2 quality bar before/within WOW-007A where marked; format is a recommendation for the implementer):

| Asset                                       | Format                                                             | Static/animated | Notes                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Hexology wordmark / logo                    | **SVG** (crisp at any size)                                        | static          | Ceremonial engraved wordmark; the display-face treatment (§8.2)                                                                    |
| Central cauldron                            | **transparent PNG/WebP** (illustrated/engraved) or high-detail SVG | static base     | **Must look professionally illustrated/engraved** — a primitive CSS/SVG pot is not acceptable as final art; naturally proportioned |
| Cauldron smoke / magical plume              | **CSS or SVG/Lottie**                                              | animated (calm) | Slow drift; reduced-motion → static (§7.4); never flashing                                                                         |
| Four category icons (mic/treble/bass/drums) | **SVG**                                                            | static          | The coherent set above; circular medallion presentation                                                                            |
| Symmetrical pillar border / frame           | **SVG or CSS**                                                     | static          | One frame, four identical instances; antique-gold linework                                                                         |
| Shared ornamental dividers                  | **SVG or CSS**                                                     | static          | Hairline rules / flourishes between regions                                                                                        |
| Hidden-gesture / mode motifs                | **SVG**                                                            | subtle feedback | Only if a covert gesture is retained alongside the visible Settings (§8.1)                                                         |
| Background texture (optional)               | **CSS gradient or tiled WebP**                                     | static          | Faint sigil/constellation at very low opacity; never a broad glossy gradient                                                       |

---

## 4. Reusable pillar component — all important states

One component, four instances. This is the single most reused unit in the UI, so it carries an explicit state model. States required by the ticket: **focus, active, muted, paused, disabled, queued, empty**. The state sheet below shows each at reduced scale; anatomy is identical across all (same structure and border geometry — visual-direction requirement).

**Anatomy (top → bottom):** pillar-number header · circular category medallion · category name · vertical volume slider (left rail) · currently-playing status row · queued indicator · (dj mode only) extended controls drawer.

> **This is an interaction/state diagram** — geometry and state cues only. Medallion glyphs are **neutral placeholders**, not the final icons (icon system = §3.11); the look/quality bar is §2.

<svg viewBox="0 0 1040 620" width="100%" style="max-width:660px;background:#0b0910;border:1px solid #333" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pillar component state diagram showing empty, queued, active, paused, muted, disabled, and focus states; medallion glyphs are placeholders">
  <style>
    .lbl{font-family:ui-sans-serif,system-ui;font-size:13px;fill:#cbb98f}
    .nm{font-family:Georgia,serif;font-size:15px;letter-spacing:2px}
    .st{font-family:ui-sans-serif,system-ui;font-size:11px;fill:#9a9080}
  </style>
  <!-- helper: 7 mini cards, 4 top / 3 bottom -->
  <!-- EMPTY (no sample present → NO category identity: no colour, no name, no icon) -->
  <g transform="translate(20,20)">
    <rect width="230" height="260" rx="8" fill="#0f0d13" stroke="#3a3540" stroke-width="2"/>
    <text x="16" y="26" class="lbl" fill="#6b6472">Pillar 4</text>
    <circle cx="115" cy="110" r="40" fill="#121016" stroke="#3a3540" stroke-width="2" stroke-dasharray="4 4"/>
    <text x="115" y="116" text-anchor="middle" class="st" fill="#5a5560">?</text>
    <text x="115" y="176" text-anchor="middle" class="st" fill="#5a5560">no category yet</text>
    <text x="115" y="212" text-anchor="middle" class="st">awaiting ingredient</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">EMPTY (no type)</text>
  </g>
  <!-- QUEUED -->
  <g transform="translate(270,20)">
    <rect width="230" height="260" rx="8" fill="#140f1a" stroke="#a16207" stroke-opacity="0.7" stroke-width="2"/>
    <text x="16" y="26" class="lbl" fill="#fcd34d">Pillar 2</text>
    <circle cx="115" cy="110" r="40" fill="#161006" stroke="#a16207" stroke-width="3" stroke-dasharray="6 5"/>
    <path d="M115 92 l16 18 l-16 18 l-16 -18 z" fill="none" stroke="#fcd34d" stroke-width="2" stroke-linejoin="round"/>
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
    <path d="M115 92 l16 18 l-16 18 l-16 -18 z" fill="none" stroke="#fca5a5" stroke-width="2" stroke-linejoin="round"/>
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
    <path d="M115 92 l16 18 l-16 18 l-16 -18 z" fill="none" stroke="#6b6472" stroke-width="2" stroke-linejoin="round"/>
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
    <path d="M115 92 l16 18 l-16 18 l-16 -18 z" fill="none" stroke="#86efac" stroke-width="2" stroke-linejoin="round"/>
    <text x="115" y="176" text-anchor="middle" class="nm" fill="#86efac">BASS</text>
    <text x="115" y="212" text-anchor="middle" class="st">focused (dj interaction)</text>
    <text x="115" y="250" text-anchor="middle" class="lbl" fill="#e6c877">FOCUS (gilt ring, 3px)</text>
  </g>
</svg>

### State model (how a pillar moves between states)

| State        | Trigger / source                                        | Distinguished by (non-colour cue too)                                             |
| ------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **empty**    | no tag detected on pillar                               | neutral (grey) medallion, **no category icon/name/colour**, "awaiting ingredient" |
| **queued**   | `ingredient_detected` / `clip_queued`                   | **dashed** medallion ring + calm pulse + "next phrase"                            |
| **active**   | `clip_started` / `clip_playing`                         | filled glow + green ● + waveform motion                                           |
| **paused**   | operator pause (dj)                                     | **pause glyph**, static, name dimmed                                              |
| **muted**    | volume at 0 / mute toggle                               | **slash overlay** across medallion, greyed name                                   |
| **disabled** | WS/backend/Ableton unavailable (general "disconnected") | **diagonal hatch** + explicit reason text                                         |
| **focus**    | touch/keyboard focus (operator)                         | 3px gilt ring outside the card                                                    |

Every state has a **shape/text cue in addition to colour** so it survives colour-blindness and the dim installation lighting (PRD accessibility). This is the reusable contract WOW-007 builds against.

> **Contract note (disabled state):** the current socket contract has **no distinct per-pillar "reader offline" signal** — the frontend can only observe a general WS/backend/Ableton disconnect. So the disabled state is specified against that **general "disconnected"** condition. If a per-pillar reader-status signal is wanted, it is a **contract addition** to be raised (and approved) as part of WOW-007, not something this design assumes exists.

---

## 5. Full-screen composition from the reusable pillar component

The same pillar component, instantiated four times, composed into the full normal-mode screen — annotated to show the component boundaries and the shared regions (wordmark, cauldron, settings band, legend) that are _not_ part of the pillar component.

> **This is a layout/composition diagram** — dashed boxes mark component boundaries; fills, glyphs, and the cauldron shape are placeholders, **not** visual design. The look/quality bar is §2.

<svg viewBox="0 0 1024 1280" width="100%" style="max-width:520px;background:#0b0910;border:1px solid #333" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui" role="img" aria-label="Full screen composition annotated to show four instances of the pillar component around shared regions">
  <rect x="0" y="0" width="1024" height="1280" fill="#0c0a12"/>
  <!-- shared: wordmark -->
  <rect x="40" y="36" width="944" height="120" rx="6" fill="#0f0d16" stroke="#c9a24b" stroke-opacity="0.3" stroke-dasharray="5 4"/>
  <text x="512" y="104" text-anchor="middle" font-size="40" fill="#e6c877" letter-spacing="8" font-family="Georgia,serif">HEXOLOGY</text>
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

Three modes on **one screen** (ADR-003 amended; no separate page/overlay, ADR-005 hand-rolled state). dj and debug are **additive layers** over normal — normal is always the base. **Mode is selected from the visible Settings modal** (the wireframe annotates the Settings button as "toggle a modal with more settings, such as which mode is visible"). This **supersedes the earlier hidden-gesture-only access model of ADR-006** (**ADR-006 amended 2026-07-15**); whether a covert gesture is _also_ retained is the open access-model question in §8.1. Each elevated mode keeps an **explicit close/exit control visible only while active**.

### 6.1 Normal mode (visitor experience — the default)

- **Shows:** everything in §2/§5 — four pillar medallions + category names (empty pillars show **no category**), per-pillar volume, **Currently-playing** (state-only in normal — no clip name, F3) + queued state (no titles), cauldron, tempo slider, auto-adjust-key toggle + **current key** (+ key difference), key controls (Raise/Lower/Reset), legend, and the visible **Help** and **Settings** controls (Settings opens the mode/settings modal).
- **Hides:** clip/song **names**, all diagnostics. (Mode chrome is reached through the visible Settings modal, not hidden.)
- **Interactivity:** tempo, per-pillar volume, and key controls **remain visitor-visible and operable** (ADR-003 amended, human-confirmed 2026-07-11 — this resolves the audit's open "do these move to operator?" question: they **stay**). Destructive-ish controls (key reset) still get a confirm-gate per UX_UI_PRINCIPLES 2.
- **Entry/exit:** it is the base state; there is nothing to enter or close.

### 6.2 DJ mode (operator — extended per-pillar controls)

Adds, **beside each pillar**, an extended controls drawer. This is where the old debug modal's per-pillar clip control **moves to** (FR3; dissolving `DebugModalContainer`, closing audit UI-04/UI-05/UI-06).

- **Adds per pillar:** clip/sample selection (open the samples menu — search + filter by category/BPM/key, multi-select, sortable headers, per the wireframe's samples-modal annotations); play/pause; the queued list **with clip names**, each row with stop (■) and remove (×); simulated tag place/remove (the sim path). Song/artist metadata surfaces **here only** (FR2 "may move to operator surface — designer's call"; this proposal puts it in dj mode).
- **Keeps visible:** the whole normal-mode surface underneath (tempo/volume/key stay live).
- **Safety:** clip start/stop and tag actions get a **confirm-gate or an explicit "armed" affordance** — no single accidental tap fires a real Ableton trigger (UX_UI_PRINCIPLES 2; fixes audit UI-04).
- **Entry:** selected from the **Settings modal** (visible Settings button → "DJ mode"). Optional covert gesture is the open access-model question (§8.1).
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
- **Entry:** selected from the **Settings modal** (visible Settings button → "Debug mode"), distinct from the DJ entry.
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

| Capability                                          | normal  |       dj       |     debug      |
| --------------------------------------------------- | :-----: | :------------: | :------------: |
| Category medallions + names, legend, cauldron       |    ●    |       ●        |       ●        |
| Visible Help + Settings controls                    |    ●    |       ●        |       ●        |
| Tempo / per-pillar volume / key controls            |    ●    |       ●        |       ●        |
| Currently-playing (state only, no name)             |    ●    | ● (with name)  |       ●        |
| Song/clip names & metadata                          |    —    |       ●        |       —        |
| Per-pillar clip select / play / pause / sim-tag     |    —    |       ●        |       —        |
| Diagnostics log / connection / versions / SIMULATED |    —    |       —        |       ●        |
| Entry                                               | default | Settings modal | Settings modal |
| Explicit close control                              |   n/a   |       ●        |       ●        |

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

### 8.1 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — mode-access model (NOT decided)

The approved reference (§2) and the wireframe both show **visible Help + Settings** controls, with **Settings** hosting mode switching. This **reverses the earlier "hidden gesture, no visible affordance" model** (**ADR-006 amended 2026-07-15**). The layout now uses the visible Settings modal as the primary mode-access path. Open question: should access be **only** the visible Settings modal, or should a **covert gesture also** be retained (e.g. to reach debug without a visitor noticing)?

| Option                                                                | Access to dj / debug                                                                                               | Trade-offs                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **A — visible Settings modal only** _(matches reference + wireframe)_ | Tap **Settings** → choose Normal / DJ / Debug in the modal                                                         | Simplest, discoverable, matches the approved art; but any visitor can open Settings and see/switch modes |
| **B — visible Settings + a covert gesture**                           | Settings modal for normal operation **plus** one press-and-hold gesture on a themed element for quick/covert debug | Keeps an operator "back door"; but reintroduces the ADR-006 hidden-affordance complexity for one path    |
| **C — Settings modal, gated**                                         | Settings opens, but switching to dj/debug requires a confirm / long-press inside the modal                         | Prevents accidental visitor mode-switches while staying visible; slightly slower for the operator        |

**If any covert gesture is retained (B):** press-and-hold ~3 s on a themed element with a gold progress ring; release-to-cancel. Recommendation to consider: **Option C** (visible per the approved reference, but guarded against casual visitor switching) — **this is the human/artists' call.** (The move to visible Settings-modal access is already recorded in **ADR-006, amended 2026-07-15**; only the A/B/C variant remains open.)

### 8.2 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — typography (NOT decided; **Fondamento rejected**)

**Fondamento is withdrawn** and must not be the final display face (human review 2026-07-15). The desired display direction is **sophisticated — engraved, ceremonial, editorial, or cinematic; adult, not playful** — with decorative use limited to the wordmark, category names, and major headings, and a **highly legible** UI face for all controls/status/queue/log/tempo/key. **Excluded:** novelty blackletter, handwritten, faux-medieval, whimsical calligraphic faces.

Three genuinely different directions. **All faces below are SIL OFL / open-licensed and repo-embeddable** (verify current licence text at vendoring time; self-host, do not hotlink). **Rendered specimens: `docs/design/typography-specimens.html`** — it shows, at intended sizes on the near-black ground: **HEXOLOGY** wordmark, **PILLAR 1**, **VOCALS / MELODY / BASS / DRUMS**, **130 BPM**, **Auto-adjust key**, **Queued samples**, and a **debug-log line**.

| Option                                | Display face (OFL)             | UI / data face (OFL) | Why it matches the §2 reference                                                                                                               |
| ------------------------------------- | ------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Inscriptional (engraved caps)** | **Cinzel**                     | **Inter**            | Roman inscriptional capitals read as engraved stone/metal — closest to the reference's engraved HEXOLOGY; Inter is maximally legible for data |
| **B — Editorial Garamond**            | **Cormorant Garamond**         | **Source Sans 3**    | High-contrast old-style serif — refined, cinematic, "antique book plate"; elegant category names; Source Sans keeps controls quiet            |
| **C — Ceremonial small-caps**         | **Marcellus** (or Spectral SC) | **IBM Plex Sans**    | Softer humanist ceremonial caps — otherworldly but warm; Plex Sans gives a slightly technical, instrument-panel feel to the data              |

Sizes to render (per §7.3): wordmark ~52 px, pillar/category names ~26 px, data 15–18 px, labels 12 px, log ~11–12 px monospace-or-sans. **Hard rule (all options):** operator-critical text uses the **legible UI face only**. No option is chosen — **the artists pick after viewing the specimens.**

### 8.3 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — palette within the witchy/occult direction (NOT decided)

**Category colour direction: red Vocals · Melody (open) · green Bass · blue Drums.** `ColorUtil` stays the **single source of truth** (`getBackgroundColorFromType` maps Vox→`bg-red-700`, Melody→`bg-yellow-700`, Bass→`bg-green-700`, Drums→`bg-blue-700`). **Vocals stays red per the original spec — the reference's pink does not apply** (human, 2026-07-15; **[Requirements over reference]**). **Bass green / Drums blue already align.** The **only open category hue is Melody** — the reference leans amber/orange vs today's yellow-700 (`#a16207`); if amber is chosen it is a **deliberate one-line restyle inside `ColorUtil`** (PRD F4), applied in implementation and **confirmed against the physical pillar LED colours before finalising** (PROJECT_BRIEF). The surrounding page/gold/ink palette is open — three directions:

| Option                                       | Page / surface                                                            | Gold / detailing                         | Ink / data text                         | Category treatment                                                                    | Mood                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **A — "Obsidian & Gilt"** (used in diagrams) | near-black `#0e0b12`→`#080609`                                            | warm gold `#c9a24b`/`#e6c877`            | warm off-white `#ece3d0`                | ColorUtil `-700` fill + `-300` text tints, unchanged                                  | Restrained, classic grimoire; matches concept art's "black + fine gold"                                             |
| **B — "Ink & Verdigris"**                    | very dark green-black `#0b1210`                                           | aged brass + verdigris `#8fae8f` accents | parchment `#e8e0cc`                     | keep `-700` but shift page-hue so greens/blues sit more naturally                     | Alchemical, herbal-witch; risks muddying Bass/Drums against a greenish page — verify contrast                       |
| **C — "Candlelit Parchment panels"**         | black page, but pillar _panels_ use a dark-parchment inset `#171019`→warm | gold `#c9a24b`                           | ink brown-black on the parchment insets | ColorUtil hues on parchment (Vocals stays **red**; only Melody may warm toward amber) | Closest to the concept art's warmth; any hue change stays single-source in `ColorUtil` and re-verified against LEDs |

Whatever is chosen must keep **AA data contrast** (§7.2) and keep the **fill / lighter-text** dual-role (a `-700`-style saturated fill for medallions/LED-match, a lighter tint for any category text). **Category hues follow the spec — Vocals red, Bass green, Drums blue; only Melody's amber-vs-yellow is open — independent of the page palette chosen here.** Recommendation to consider: **Option C ("Candlelit Parchment")** or **A ("Obsidian & Gilt")** — both sit closest to the reference's warm black-and-gold engraving; whichever is picked, re-verify category hues against the LEDs. **Artists decide.**

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

### 8.5 ⚠️ HUMAN/ARTIST SIGN-OFF REQUIRED — pillar border/frame style (NOT decided)

The border/frame around the pillars in the reference image is **an example, not the decided treatment** (human, 2026-07-15). Below are several styles to choose from. **Constraints (fixed):** all four pillars share the **same** frame (symmetry requirement); the frame must not compete with the data (rejection list); it must leave room for the medallion, name, status, queue, and volume tube; and it must hold up at the 1024×1280 viewport and scale down responsively. These will be shown as real rendered options in the **WOW-007A** spike; the descriptions below are the starting set — the human may request more.

| Option                        | Description                                                                                     | Trade-offs                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **A — Ornate engraved frame** | The reference's look: gold corner flourishes + a double-rule border, arched top                 | Most "grimoire"; richest; risks competing with data if too heavy; most asset work |
| **B — Thin double-rule**      | Two fine gold hairlines with small corner ticks; no heavy ornament                              | Clean, legible, cheap to build; less ceremonial                                   |
| **C — Corner-flourish only**  | Plain rounded card with ornament **only at the four corners**, sides bare                       | Ceremonial accent without a busy full border; good data legibility                |
| **D — Etched panel / inset**  | No drawn border; the pillar is a subtly lighter/inset engraved panel with a soft gold edge-glow | Very clean, modern-occult; relies on surface contrast; may read less "framed"     |
| **E — Arched niche / shrine** | A tall arched "niche" silhouette (like an altar recess) framing each pillar                     | Strong theming and verticality; harder to keep symmetric across four; more art    |

No option is chosen — **the artists pick (and may ask for more variants)**; the pick is rendered for real in WOW-007A before sign-off.

---

## 9. Traceability — how this improves on the audit baseline

| Audit finding (WOW-004)                                                 | Addressed by                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **UI-01** silent disconnect (blocker)                                   | §3.9 warning/error tokens, §4 disabled state, §6.3 connection state, §7.5                                                  |
| **UI-03/UI-13** invisible single-tap operator trigger                   | §6/§8.1 mode access via the visible Settings modal (optionally guarded/covert); no bare single-tap enters an operator mode |
| **UI-04** unconfirmed clip triggers                                     | §3.5, §6.2 confirm-gate / armed affordance                                                                                 |
| **UI-05/UI-06** debug modal overflow / see-through / non-existent class | Modal **dissolved**; clip control → dj drawer, diagnostics → bottom dock (§6.2/§6.3); `surface/overlay` opaque             |
| **UI-07/UI-14** a11y labels not reflecting state                        | §4 state model with explicit text/shape cues per state                                                                     |
| **UI-15** no reduced-motion                                             | §7.4 `prefers-reduced-motion` respected; queued state legible without pulse                                                |
| **UI-16** unverified low contrast                                       | §7.2 AA rule + `-300` text tints + automated pass in WOW-007                                                               |
| **UI-17** idle timeout unhandled                                        | §6.3 idle-timeout indicator, §7.5                                                                                          |
| SIMULATED not labelled (principle 10)                                   | §3.9 + §6.3 SIMULATED badge                                                                                                |
| Song/artist on visitor screen (F3)                                      | Removed from visitor surface; lives only in dj mode (§6.2)                                                                 |
| Recipe/spell removal (F5)                                               | Not present anywhere in this design                                                                                        |

## 10. Open questions carried for WOW-007 (non-HALT)

- **DJ auto-timeout to normal** after operator inactivity — proposed safeguard (§6.2); confirm value or drop.
- **Concurrent debug + dj** — this proposal recommends one-elevated-mode-at-a-time (§6.4); confirm.
- **Samples-menu scope in dj mode** — the wireframe specifies search + category/BPM/key filters + sortable headers + multi-select; confirm this full scope for the first implementation or slice a minimal version first.
- **Responsive floor** — smallest size the reflow (§5) must support; the target is fixed at 1024×1280 but the graceful-scaling range needs a stated min/max for WOW-007 acceptance.
- **Help content** — what the visible Help control presents (visitor-facing explainer vs operator quick-reference); wireframe shows the button but not its contents.
- **ADR-006 amendment** — the visible Settings-modal mode access (§6/§8.1) supersedes the earlier hidden-gesture-only model and must be written up as an ADR-006 amendment before WOW-007 slicing.

---

_End of Design Proposal 001. Proposal only — no code, no visual-identity decisions made. The four ⚠️ HALT items in §8 require human/artist sign-off before WOW-007._
