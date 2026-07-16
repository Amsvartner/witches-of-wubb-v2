import { ClipTypes } from 'backend/type/ClipTypes';
import { ColorUtil } from '~/util/ColorUtil';

/**
 * Presentation tokens for a sample category, per DESIGN_PROPOSAL_001 §3.3.
 *
 * `ColorUtil` remains the single source of truth for the saturated *fill* hue
 * (PRD F4); this module only adds the paired presentation values the design
 * system needs but ColorUtil does not own:
 *   - the `-300` text/ring tint (the raw `-700`/`-600` fill fails WCAG AA as
 *     text on the near-black page, so category *text* uses the lighter tint —
 *     §7.2), and
 *   - resolved hex values, needed by SVG strokes and CSS-var-driven glows that
 *     cannot consume a Tailwind class.
 *
 * `fillHex` is the resolved value of `fillClass` (kept in sync; asserted in the
 * unit test), provided only for canvas/SVG/box-shadow use.
 */
export type CategoryTokens = {
  type: ClipTypes;
  /** Display label shown under the medallion, e.g. "VOCALS". */
  label: string;
  /** Saturated fill class — sourced from ColorUtil (single source of truth). */
  fillClass: string;
  /** Resolved hex of `fillClass`, for SVG strokes / CSS-var glows only. */
  fillHex: string;
  /** `-300` tint text utility — AA-legible category text on the dark page. */
  tintClass: string;
  /** Resolved hex of the tint, for luminous rings / SVG strokes. */
  tintHex: string;
  /**
   * Colour slug of the category's bespoke art assets (human-supplied
   * 2026-07-16): `/images/slider-background-<slug>.png` +
   * `/images/slider-handle-<slug>.png`.
   */
  assetSlug: 'red' | 'amber' | 'green' | 'blue';
};

// Resolved hues paired to each category. Centralised here (not scattered across
// components) so there is one place to reconcile against the physical pillar LEDs.
const CATEGORY_PRESENTATION: Record<ClipTypes, Omit<CategoryTokens, 'type' | 'fillClass'>> = {
  [ClipTypes.Vox]: {
    label: 'VOCALS',
    fillHex: '#b91c1c', // red-700
    tintClass: 'text-red-300',
    tintHex: '#fca5a5',
    assetSlug: 'red',
  },
  [ClipTypes.Melody]: {
    label: 'MELODY',
    fillHex: '#ca8a04', // yellow-600 (warm yellow — WOW-007A)
    tintClass: 'text-amber-300', // warm tint, clears AA on the page (§3.3 tint note)
    tintHex: '#fcd34d',
    assetSlug: 'amber',
  },
  [ClipTypes.Bass]: {
    label: 'BASS',
    fillHex: '#15803d', // green-700
    tintClass: 'text-green-300',
    tintHex: '#86efac',
    assetSlug: 'green',
  },
  [ClipTypes.Drums]: {
    label: 'DRUMS',
    fillHex: '#1d4ed8', // blue-700
    tintClass: 'text-blue-300',
    tintHex: '#93c5fd',
    assetSlug: 'blue',
  },
};

const forType = (type: ClipTypes): CategoryTokens => {
  const presentation = CATEGORY_PRESENTATION[type];
  const fillClass = ColorUtil.getBackgroundColorFromType(type);
  return { type, fillClass, ...presentation };
};

export const CategoryTheme = {
  forType,
};
