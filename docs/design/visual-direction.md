# Hexology Visual Design Direction

## Two authorities — do not conflate them

This project has **two separate sources of authority**, and every design/implementation decision must name which one it is following:

1. **Visual-style authority — the primary reference image.** How the interface _looks_ (aesthetic, quality bar, tone, ornament language, colour treatment, typography feel, illustration quality) is governed by the human-selected concept image identified below. This is **an approved art-direction target**, not loose mood inspiration.
2. **Layout & interaction authority — the wireframe + product requirements.** _What_ appears, _where_ it sits, which controls exist, information hierarchy, modes, states, and behaviour are governed by `docs/design/Hex_layout_concept.svg` and the current functional requirements (PRD / ADRs / socket contract). When the reference image and the wireframe/requirements disagree on placement, controls, text, or proportions, **the wireframe/requirements win**.

Neither authority overrides the other within its own domain. The reference image does **not** dictate exact placement; the wireframe does **not** dictate the visual execution.

## Primary visual reference — approved direction and quality bar

**`docs/design/hexology-grimoire-concept-3.png`** is the **Primary visual reference — approved direction and quality bar.**

It is the portrait graphic-occult concept (derived from image 2 of the original concept set), characterised by:

- near-black background
- restrained antique-gold linework
- screen-printed / engraved occult visual language
- a large ceremonial **HEXOLOGY** wordmark
- a central cauldron
- four symmetrical pillar panels
- four colour-differentiated categories (the image renders Vocals magenta, but **implementation uses red for Vocals per spec** — see "Sample-type colours" below)
- a polished, adult, otherworldly appearance
- strong hierarchy with generous negative space

The implemented interface **must clearly belong to the same visual family as this reference.** Agents may simplify detail for readability and implementation, but **may not replace it with a generic fantasy dashboard, cartoon grimoire, folk-art interface, or ordinary rounded-card UI.**

The other supplied image, `docs/design/hexology-grimoire-concept.png` (landscape, glossy neon style), is **secondary mood reference only** and is explicitly _not_ a layout or quality target.

### What is authoritative vs non-literal in the reference image

The reference governs **visual style and quality**. It does **not** govern exact component placement, controls, text, or proportions — the wireframe does. Treat as **non-literal**: any AI-generated text/track names, exact spacing, fake or extra controls, precise ornamental details, and any distorted proportions.

## Visual-quality rejection list (hard constraints)

The following are **rejected** and must never be produced or accepted as the design:

- no childish, cute, storybook, or craft aesthetic
- no improvised pseudo-occult symbols
- no generic fantasy-game asset-pack frames
- no broad glossy gradients
- no excessive rounded app cards
- no generic dashboard appearance
- no placeholder artwork presented as final art
- no novelty blackletter, handwritten, or calligraphic UI text
- **no Fondamento** in the proposed final design
- no inconsistent icon styles
- no decorative detail competing with functional information

## Sample-type colours

Category colour follows the **original spec / `ColorUtil`** (the single source of truth), **not** the reference image's palette (a [Requirements over reference] case, human 2026-07-15):

- **Vocals:** **red** (original spec — the reference's pink does **not** apply)
- **Melody:** yellow today; amber/orange is an open sign-off question (see design proposal §8.3)
- **Bass:** green
- **Drums:** blue

## Layout & interaction authority (the wireframe + requirements)

`docs/design/Hex_layout_concept.svg` + current functional requirements are the source of truth for:

- Component placement and information hierarchy
- Controls (per-pillar Play/Pause, Mute, Samples; volume slider; **visible Help and Settings**; BPM; Auto-adjust-key toggle; **current key + key difference**; Raise/Lower/Reset key)
- Per-pillar **Currently-playing** and **Queued samples**
- The central cauldron (clickable — plays a random SFX)
- Modes (normal / dj / debug per ADR-003/006 amended)
- The samples modal/menu (search, filters, sortable table, assign-to-pillar)
- Responsive behaviour and interaction states

The target display is **1024 × 1280 effective resolution (portrait)** — a 1280 × 1024 panel rotated to portrait (ADR-003). Design for this exact viewport first; the layout must also scale gracefully / responsively to other sizes (confirmed 2026-07-15). Controls must be large enough for **touch-only** use (no mouse/keyboard).

### Required layout corrections (things the wireframe/requirements demand)

- Leave clear space beneath the Hexology wordmark; no logo/pillar collisions.
- Keep all four sample-type icon containers **circular** and symmetrical.
- Keep the central cauldron **naturally proportioned** (never squashed/stretched).
- Key controls are exactly **Raise key / Lower key / Reset key**; Auto-adjust-key already has a toggle — do not add a separate toggle-key button.
- The legend shows the four sample-type colours only.
- All four pillar cards share the same component structure and border geometry.
- The **pillar border/frame in the reference image is only an example** — the actual frame style is an open choice with several options (design proposal §8.5); whichever is chosen, all four pillars use the same frame.
- An **empty pillar (no tag/sample present) has no category** — no category icon, name, or colour until a sample is loaded.

## Design priorities

1. Functional clarity — controls must always be easier to identify than decoration
2. Readability at installation viewing distance
3. Clear state and interaction feedback
4. Generous spacing between major sections
5. Consistent, symmetrical pillar components
6. Strong sample-type colour recognition
7. Mystical atmosphere true to the primary reference
8. Decorative detail — a subtle layer around a clean structure, never competing with data

## Approval discipline

Do not make major visual or interaction decisions without human approval. **Structural, accessibility, Copilot, and documentation reviewers cannot grant visual-art-direction approval** — only the human/artists can. See the visual-fidelity gate in `docs/DESIGN_PROPOSAL_001.md`.
