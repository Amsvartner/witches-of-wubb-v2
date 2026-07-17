import { IconButton } from '~/component/IconButton';
import { useConfirmTap } from '~/hook/useConfirmTap';

type Props = {
  /** Present while a clip is playing/stopping — confirm-gated stop. */
  onStop?: () => void;
  /** Opens the pillar's sample-selection modal. */
  onSelectSample: () => void;
};

const StopGlyph = (): JSX.Element => (
  <svg viewBox='0 0 20 20' className='h-5 w-5' fill='currentColor' aria-hidden='true'>
    <rect x={5} y={5} width={10} height={10} rx={1.5} />
  </svg>
);

const SelectGlyph = (): JSX.Element => (
  <svg
    viewBox='0 0 20 20'
    className='h-5 w-5'
    fill='none'
    stroke='currentColor'
    strokeWidth={1.8}
    strokeLinecap='round'
    aria-hidden='true'
  >
    <path d='M4 6h9M4 10h9M4 14h6' />
    <path d='M15.5 12.5v5M13 15h5' />
  </svg>
);

/**
 * Per-pillar DJ controls (WOW-007B): stop the playing clip (confirm-gated —
 * stopping live audio is destructive, UX_UI_PRINCIPLES 2) and open the
 * sample-selection modal. DJ mode only; play mode renders no per-pillar
 * controls (human decision 2026-07-17). There is no pause or mute — the
 * socket contract has neither event (place/remove tag is the mechanism).
 */
export const DjPillarControls = ({ onStop, onSelectSample }: Props): JSX.Element => {
  const stopConfirm = useConfirmTap(() => onStop?.());

  return (
    <div className='flex items-center gap-2'>
      {onStop && stopConfirm.armed && (
        <span className='font-data text-xs uppercase tracking-wide text-red-300' aria-hidden='true'>
          Confirm?
        </span>
      )}
      {onStop && (
        <IconButton
          label={stopConfirm.armed ? 'Confirm stop' : 'Stop'}
          onClick={stopConfirm.onTap}
          className={`h-11 w-11 shrink-0 ${
            stopConfirm.armed ? 'border-red-300/80 bg-red-900/40 text-red-200' : ''
          }`}
        >
          <StopGlyph />
        </IconButton>
      )}
      <IconButton label='Select sample' onClick={onSelectSample} className='h-11 w-11 shrink-0'>
        <SelectGlyph />
      </IconButton>
    </div>
  );
};
