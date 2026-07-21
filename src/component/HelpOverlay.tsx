import { type CSSProperties } from 'react';
import { Dialog } from '@headlessui/react';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Arrow = 'up' | 'down' | 'left' | 'right';

type Callout = {
  id: string;
  copy: string;
  /**
   * Fixed viewport-percentage anchor, hand-tuned against the 1024×1280
   * design-first layout (ADR-003 / PlayModeContainer's grid). These are
   * deliberately layout-coupled — if the pillar grid, cauldron position, or
   * settings band geometry in PlayModeContainer changes, these anchors will
   * drift out of alignment and need re-tuning alongside it.
   */
  style: CSSProperties;
  /** Which edge of the bubble the arrow sits on, pointing toward the target. */
  arrow: Arrow;
};

// Small CSS-triangle arrows (border trick) on one edge of each bubble,
// pointing roughly toward the UI element the callout describes.
const ARROW_CLASS: Record<Arrow, string> = {
  up: 'left-1/2 top-0 -translate-x-1/2 -translate-y-full border-x-8 border-b-[10px] border-x-transparent border-b-gold-line',
  down: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-full border-x-8 border-t-[10px] border-x-transparent border-t-gold-line',
  left: 'left-0 top-1/2 -translate-x-full -translate-y-1/2 border-y-8 border-r-[10px] border-y-transparent border-r-gold-line',
  right:
    'right-0 top-1/2 translate-x-full -translate-y-1/2 border-y-8 border-l-[10px] border-y-transparent border-l-gold-line',
};

// Copy + anchors for the five callouts (human spec 2026-07-20): a pillar
// card, a volume tube, the cauldron, the settings band, and the Settings
// button — the five surfaces a first-time visitor needs pointed out.
const CALLOUTS: Callout[] = [
  {
    id: 'pillar',
    copy: 'Place an ingredient upon a pillar and its voice joins the spell ✦',
    style: { top: '20%', left: '4%' },
    arrow: 'down',
  },
  {
    id: 'tube',
    copy: 'Stroke the potion tube to tame or unleash its voice',
    style: { top: '48%', left: '2%' },
    arrow: 'right',
  },
  {
    id: 'cauldron',
    copy: 'Tap the cauldron — it loves attention (and makes noises)',
    style: { top: '28%', left: '50%', transform: 'translateX(-50%)' },
    arrow: 'down',
  },
  {
    id: 'settings-band',
    copy: 'The lower grimoire bends time and key — twist the tempo, raise the pitch',
    style: { bottom: '11%', left: '50%', transform: 'translateX(-50%)' },
    arrow: 'down',
  },
  {
    id: 'settings-button',
    copy: 'Deeper magicks hide behind the Settings sigil',
    style: { top: '4%', right: '3%' },
    arrow: 'up',
  },
];

/**
 * Full-screen help overlay (human spec 2026-07-20), toggled from TopControls'
 * Help button. Sits at z-40 — below the cauldron's portalled click ring
 * (z-50, see Cauldron.tsx) but above every pillar card (z-10/z-20/z-30, see
 * PlayModeContainer). Built on Headless UI's `Dialog` (same primitive as
 * SettingsModal/SampleModal) for Escape-to-close and the accessible dialog
 * role/aria-label for free.
 *
 * Unlike SettingsModal/SampleModal there's no `Dialog.Panel` here — the
 * callouts are a purely informational overlay, not a form with controls that
 * need protecting from accidental dismissal — so "tap the scrim closes it" is
 * wired explicitly rather than relying on Headless UI's outside-panel click
 * detection (which needs a `Dialog.Panel` to define "outside" against): the
 * scrim is a real full-screen `<button>` behind everything else, so it's
 * natively keyboard/AT-interactive without extra ARIA plumbing (and doesn't
 * nest inside another interactive element the way a clickable wrapping `div`
 * around the close button/callouts would). It's `aria-hidden` + untabbable
 * since it's a bare convenience for pointer/touch users — the explicit ✕
 * button and Escape already cover keyboard/AT dismissal.
 */
export const HelpOverlay = ({ open, onClose }: Props): JSX.Element => (
  <Dialog open={open} onClose={onClose} aria-label='Help' className='relative z-40'>
    <button
      type='button'
      onClick={onClose}
      aria-hidden='true'
      tabIndex={-1}
      data-testid='help-scrim'
      className='fixed inset-0 cursor-default bg-[#0b0910]/80'
    />
    <div className='pointer-events-none fixed inset-0'>
      <button
        type='button'
        onClick={onClose}
        aria-label='Close help'
        className='pointer-events-auto absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gold-line/50 bg-ink-btn text-xl leading-none text-parchment/90'
      >
        ✕
      </button>
      {CALLOUTS.map((callout) => (
        <div
          key={callout.id}
          style={callout.style}
          className='pointer-events-none absolute max-w-[260px] rounded-xl border border-gold-line/60 bg-ink-panel px-4 py-3 font-data text-[15px] leading-snug text-parchment shadow-[0_0_30px_rgba(0,0,0,0.7)]'
        >
          <span aria-hidden='true' className={`absolute h-0 w-0 ${ARROW_CLASS[callout.arrow]}`} />
          {callout.copy}
        </div>
      ))}
    </div>
  </Dialog>
);
