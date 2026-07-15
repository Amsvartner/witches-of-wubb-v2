# Hexology Visual Design Direction

Use the attached Hexology concept images — `docs/design/hexology-grimoire-concept.png` and `docs/design/hexology-grimoire-concept-2.png` — as **inspiration for the visual language only**.

They are not pixel-perfect targets and must not be reproduced literally. The final interface must be designed from the actual product requirements, the rough wireframe (`docs/design/Hex_layout_concept.svg`), the confirmed screen dimensions, and reusable UI components.

> **The concept images are AI-generated and internally inconsistent** — for example, the two supplied images disagree on orientation (one landscape, one portrait), and they contain AI-generated text, icon, ornament, and control artefacts. Treat these inconsistencies as noise, not intent: take the mood/colour/atmosphere, and never reproduce an AI artefact just because it appears in an image. The **canonical viewport is portrait 1024 × 1280** (see below), regardless of any image's orientation.

## Take inspiration from

- The dark mystical atmosphere
- The grimoire / occult-instrument aesthetic
- The restrained black background with fine gold detailing
- The strong Hexology wordmark and ceremonial visual identity
- The four clearly differentiated sample-type colours:
  - **Vocals:** pink / magenta
  - **Melody:** amber / orange
  - **Bass:** green
  - **Drums:** blue
- Circular sample-type emblems
- The central cauldron as a shared visual focal point
- The combination of traditional occult imagery with clean interface controls
- The use of thin decorative borders rather than large fantasy frames
- The polished, professional appearance appropriate for the physical installation

## Do not copy

- Exact proportions or spacing from the concept image
- AI-generated text, icons, ornaments, or control shapes
- The distorted or compressed cauldron proportions
- Any collisions between the logo and pillar panels
- Inconsistent borders or asymmetrical decoration
- Tiny text or controls that would be hard to use on the real screen
- Decorative detail that competes with functional information

## Layout authority

The rough UI wireframe and current functional requirements are the source of truth for:

- Component placement
- Controls
- Information hierarchy
- Modes
- Queued samples
- Settings
- Responsive behaviour
- Interaction states

The target display is **1024 × 1280 effective resolution (portrait)** — a 1280 × 1024 panel rotated to portrait (ADR-003). Design for this exact viewport first, but the layout must also scale gracefully / responsively to other sizes (confirmed 2026-07-15).

## Design priorities

1. Functional clarity
2. Readability at the installation viewing distance
3. Clear state and interaction feedback
4. Generous spacing between major sections
5. Consistent and symmetrical pillar components
6. Strong sample-type colour recognition
7. Mystical atmosphere
8. Decorative detail

## Required corrections from the concept

- Leave clear space beneath the Hexology logo.
- Keep all four sample-type icon containers circular.
- Keep the central cauldron naturally proportioned.
- Use only:
  - Raise key
  - Lower key
  - Reset key
- Auto-adjust key already has a toggle; do not add a separate Toggle Key button.
- The legend shows the four sample-type colours only.
- All four pillar cards should use the same component structure and border geometry.

## Expected approach

Create the interface as a coherent design system rather than one large illustration.

Define reusable tokens and components for:

- Background surfaces
- Pillar borders
- Sample-type accents
- Typography
- Buttons
- Sliders
- Queue rows
- Icon medallions
- Focus, hover, active, muted, paused, and disabled states
- Decorative motifs

Use decoration as a subtle layer around a clean, conventional interface structure.

Before implementation, produce:

1. A low-fidelity full-screen layout at 1024 × 1280 (portrait)
2. A visual direction mockup
3. A reusable token proposal
4. One finished pillar component showing all important states
5. A full-screen composition using the approved component

Do not make major visual or interaction decisions without asking for approval.
