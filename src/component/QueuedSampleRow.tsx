import { type CSSProperties } from 'react';
import { IconButton } from '~/component/IconButton';
import { useConfirmTap } from '~/hook/useConfirmTap';

type Props = {
  name: string;
  /** Category tint hex — the leading pip + accents. */
  tintHex: string;
  /**
   * Starts this pick now (WOW-007B pending-pick queue). Present on the
   * pending row only — a backend-queued row self-starts at the next phrase
   * boundary and has no play action.
   */
  onPlay?: () => void;
  /**
   * Removes the row. Absent => display-only row with no remove button — the
   * socket contract holds at most one queued clip per pillar, so only the
   * contract-backed row gets the pillar-level remove action (Copilot review,
   * PR #55).
   */
  onRemove?: () => void;
  /**
   * Confirm-gates `onRemove` (UX_UI_PRINCIPLES 2 — destructive control).
   * Defaults true (a backend-queued row is about to fire live audio). The
   * pending row passes `false` — dropping a local-only hold that was never
   * emitted isn't destructive.
   */
  confirmRemove?: boolean;
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
 * One queued sample row — DJ mode only (human decision 2026-07-17: play mode
 * shows no queue and no sample names; queue management is a DJ surface).
 *
 * Two flavours share this component (WOW-007B pending-pick queue):
 * - Backend-queued row: `onRemove` only, confirm-gated (default) — the clip
 *   self-starts at the next phrase boundary, so there's no play action.
 * - Pending row: both `onPlay` (starts it now, via `/departed/tag` +
 *   `/new/tag`) and `onRemove` (drops the local hold) with
 *   `confirmRemove={false}` — nothing live is affected by dropping a hold
 *   that was never emitted to the backend.
 *
 * The 44px touch target and red remove-tint are kept from the spike (§7.1
 * mis-tap concern).
 */
export const QueuedSampleRow = ({
  name,
  tintHex,
  onPlay,
  onRemove,
  confirmRemove = true,
}: Props): JSX.Element => {
  const pip: CSSProperties = { backgroundColor: tintHex, boxShadow: `0 0 6px ${tintHex}aa` };
  // Unconditional call (rules of hooks); only consulted when confirmRemove is
  // true — a non-confirm-gated row's remove button calls onRemove directly.
  const { armed, onTap } = useConfirmTap(onRemove ?? (() => undefined));
  const removeArmed = confirmRemove && armed;
  const handleRemoveClick = confirmRemove ? onTap : onRemove ?? (() => undefined);

  return (
    <li className='flex items-center gap-2 rounded-md border border-gold-line/20 bg-ink-deep/70 px-1 py-1'>
      {onPlay && (
        <IconButton label={`Play ${name}`} onClick={onPlay} className='h-11 w-11 shrink-0'>
          <PlayGlyph />
        </IconButton>
      )}
      <span style={pip} className='ml-2 h-2 w-2 shrink-0 rounded-full' aria-hidden='true' />
      <span className='flex-1 truncate font-data text-[15px] text-parchment/85'>{name}</span>
      {onRemove && removeArmed && (
        <span className='font-data text-xs uppercase tracking-wide text-red-300' aria-hidden='true'>
          Confirm?
        </span>
      )}
      {onRemove && (
        <IconButton
          label={removeArmed ? `Confirm remove ${name}` : `Remove ${name}`}
          onClick={handleRemoveClick}
          className={`h-11 w-11 shrink-0 ${
            removeArmed
              ? 'border-red-300/80 bg-red-900/40 text-red-200'
              : 'border-red-300/30 text-red-300/80'
          }`}
        >
          <RemoveGlyph />
        </IconButton>
      )}
    </li>
  );
};
