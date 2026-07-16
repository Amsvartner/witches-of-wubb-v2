import { type CSSProperties } from 'react';
import { IconButton } from '~/component/IconButton';

type Props = {
  name: string;
  /** Category tint hex — the leading pip + accents. */
  tintHex: string;
};

const PlayGlyph = (): JSX.Element => (
  <svg viewBox='0 0 20 20' className='h-4 w-4' fill='currentColor' aria-hidden='true'>
    <path d='M6 4l10 6-10 6z' />
  </svg>
);

const RemoveGlyph = (): JSX.Element => (
  <svg
    viewBox='0 0 20 20'
    className='h-4 w-4'
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    strokeLinecap='round'
    aria-hidden='true'
  >
    <path d='M5 5l10 10M15 5L5 15' />
  </svg>
);

/**
 * One queued sample row (human direction 2026-07-15): sample name with a
 * play/stop and a remove control. Buttons are full 44px touch targets with
 * ≥12px separation, and remove is visually distinct (red tint), so a sample
 * isn't removed by a mis-tap aimed at play (§7.1; human concern 2026-07-16).
 * The wired-up remove action must additionally get a confirm-gate
 * (UX_UI_PRINCIPLES 2 — destructive control). Static/display only in this spike.
 *
 * NOTE: showing sample NAMES on the pillar diverges from PRD F3 ("no clip/song
 * names on the visitor display") — flagged for confirmation with the mode-model
 * change (play/tutorial/DJ). Recorded in the WOW-007A implementation note.
 */
export const QueuedSampleRow = ({ name, tintHex }: Props): JSX.Element => {
  const pip: CSSProperties = { backgroundColor: tintHex, boxShadow: `0 0 6px ${tintHex}aa` };
  return (
    <li className='flex items-center gap-2 rounded-md border border-gold-line/20 bg-ink-deep/70 py-1 pl-2 pr-1'>
      <span style={pip} className='h-2 w-2 shrink-0 rounded-full' aria-hidden='true' />
      <span className='flex-1 truncate font-data text-sm text-parchment/85'>{name}</span>
      <IconButton label={`Play ${name}`} className='h-11 w-11 shrink-0'>
        <PlayGlyph />
      </IconButton>
      <IconButton
        label={`Remove ${name}`}
        className='ml-3 h-11 w-11 shrink-0 border-red-300/30 text-red-300/80'
      >
        <RemoveGlyph />
      </IconButton>
    </li>
  );
};
