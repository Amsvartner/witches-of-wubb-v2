import { type CSSProperties } from 'react';
import { IconButton } from '~/component/IconButton';
import { useConfirmTap } from '~/hook/useConfirmTap';

type Props = {
  name: string;
  /** Category tint hex — the leading pip + accents. */
  tintHex: string;
  /**
   * Removes the queued sample (emits the departed-tag event). Absent =>
   * display-only row with no remove button — the socket contract holds at
   * most one queued clip per pillar, so only the contract-backed row gets
   * the pillar-level remove action (Copilot review, PR #55).
   */
  onRemove?: () => void;
};

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
 * Remove is confirm-gated (UX_UI_PRINCIPLES 2 — destructive control): first
 * tap arms it visibly, second tap within 3s removes, then it auto-disarms.
 * The 44px touch target and red tint are kept from the spike (§7.1 mis-tap
 * concern); the spike's per-row play button is gone — the contract has no
 * "play queued now" event.
 */
export const QueuedSampleRow = ({ name, tintHex, onRemove }: Props): JSX.Element => {
  const pip: CSSProperties = { backgroundColor: tintHex, boxShadow: `0 0 6px ${tintHex}aa` };
  // Unconditional call (rules of hooks); the button below only renders when a
  // remove action actually exists.
  const { armed, onTap } = useConfirmTap(onRemove ?? (() => undefined));

  return (
    <li className='flex items-center gap-2 rounded-md border border-gold-line/20 bg-ink-deep/70 px-1 py-1'>
      <span style={pip} className='ml-2 h-2 w-2 shrink-0 rounded-full' aria-hidden='true' />
      <span className='flex-1 truncate font-data text-[15px] text-parchment/85'>{name}</span>
      {onRemove && armed && (
        <span className='font-data text-xs uppercase tracking-wide text-red-300' aria-hidden='true'>
          Confirm?
        </span>
      )}
      {onRemove && (
        <IconButton
          label={armed ? `Confirm remove ${name}` : `Remove ${name}`}
          onClick={onTap}
          className={`h-11 w-11 shrink-0 ${
            armed
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
