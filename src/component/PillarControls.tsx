import { PillarStatus } from '~/type/PillarView';
import { IconButton } from '~/component/IconButton';

type Props = {
  status: PillarStatus;
  muted: boolean;
};

const PlayGlyph = (): JSX.Element => (
  <svg viewBox='0 0 20 20' className='h-5 w-5' fill='currentColor' aria-hidden='true'>
    <path d='M6 4l10 6-10 6z' />
  </svg>
);

const PauseGlyph = (): JSX.Element => (
  <svg viewBox='0 0 20 20' className='h-5 w-5' fill='currentColor' aria-hidden='true'>
    <rect x={5} y={4} width={3.5} height={12} rx={1} />
    <rect x={11.5} y={4} width={3.5} height={12} rx={1} />
  </svg>
);

const SpeakerGlyph = ({ muted }: { muted: boolean }): JSX.Element => (
  <svg
    viewBox='0 0 20 20'
    className='h-5 w-5'
    fill='none'
    stroke='currentColor'
    strokeWidth={1.8}
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    <path d='M4 8v4h3l4 3V5L7 8z' fill='currentColor' stroke='none' />
    {muted ? <path d='M14 8l4 4M18 8l-4 4' /> : <path d='M13.5 7.5a4 4 0 0 1 0 5' />}
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
 * Per-pillar controls (human direction 2026-07-15/16): play/pause, mute, and a
 * sample selector — icon-only, rendered in the pillar header. Touch-sized
 * (≥44px). Static/display only in the WOW-007A spike — no handlers wired.
 */
export const PillarControls = ({ status, muted }: Props): JSX.Element => {
  const playing = status === 'playing';
  return (
    <div className='flex gap-2'>
      <IconButton label={playing ? 'Pause' : 'Play'} className='h-11 w-11 shrink-0'>
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </IconButton>
      <IconButton
        label={muted ? 'Unmute' : 'Mute'}
        className={`h-11 w-11 shrink-0 ${muted ? 'text-amber-300' : ''}`}
      >
        <SpeakerGlyph muted={muted} />
      </IconButton>
      <IconButton label='Select sample' className='h-11 w-11 shrink-0'>
        <SelectGlyph />
      </IconButton>
    </div>
  );
};
