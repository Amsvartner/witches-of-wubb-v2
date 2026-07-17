import { type CSSProperties } from 'react';
import { SectionLabel } from '~/component/SectionLabel';

type Props = {
  tempoBpm: number;
  tempoMin: number;
  tempoMax: number;
  autoAdjustKey: boolean;
  currentKey: string;
  keyQuality: string;
  keyDifference: string;
};

// Display-only in the WOW-007A spike: a real disabled button (still accessibly
// named) until the key-change handler is wired in a follow-up ticket.
const KeyControlButton = ({ glyph, label }: { glyph: JSX.Element; label: string }): JSX.Element => (
  <button
    type='button'
    aria-label={`${label} key`}
    disabled
    className='flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-gold-line/40 bg-ink-btn px-3 font-data text-xs uppercase tracking-[0.14em] text-parchment/80 disabled:cursor-default disabled:opacity-75'
  >
    <svg
      viewBox='0 0 24 24'
      className='h-4 w-4 text-gold-line'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {glyph}
    </svg>
    {label}
  </button>
);

/**
 * Bottom settings + status band (DESIGN_PROPOSAL_001 §1/§5): tempo, auto-adjust
 * key toggle, current key + difference, and Raise/Lower/Reset key controls.
 * Visitor-visible and operable in play mode (ADR-003 amended). Static/display
 * only in the WOW-007A spike.
 */
export const SettingsBand = ({
  tempoBpm,
  tempoMin,
  tempoMax,
  autoAdjustKey,
  currentKey,
  keyQuality,
  keyDifference,
}: Props): JSX.Element => {
  const fraction = Math.max(0, Math.min(1, (tempoBpm - tempoMin) / (tempoMax - tempoMin)));
  const fillStyle: CSSProperties = { width: `${fraction * 100}%` };
  const thumbStyle: CSSProperties = { left: `calc(${fraction * 100}% - 9px)` };

  return (
    <div className='grid grid-cols-[1.5fr_1fr_1fr_1.4fr] items-stretch gap-px rounded-xl border border-gold-line/30 bg-gold-line/20'>
      {/* Tempo */}
      <div className='flex flex-col justify-center gap-2 bg-ink-panel px-5 py-4'>
        <div className='flex items-baseline justify-between'>
          <SectionLabel>Tempo</SectionLabel>
          <span className='font-number text-2xl font-semibold tabular-nums text-parchment'>
            {tempoBpm}
            <span className='ml-1 font-data text-xs font-normal uppercase tracking-widest text-parchment/60'>
              bpm
            </span>
          </span>
        </div>
        <div className='relative h-1.5 rounded-full bg-ink-rail'>
          <div style={fillStyle} className='absolute inset-y-0 left-0 rounded-full bg-gold-line' />
          <div
            style={thumbStyle}
            className='absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rotate-45 rounded-[4px] border border-gold-bright/80 bg-gradient-to-br from-gold-bright to-[#b98f38]'
          />
        </div>
        <div className='flex justify-between font-number text-xs tabular-nums text-parchment/60'>
          <span>{tempoMin}</span>
          <span>{tempoMax}</span>
        </div>
      </div>

      {/* Auto-adjust key */}
      <div className='flex flex-col justify-center gap-2 bg-ink-panel px-5 py-4'>
        <SectionLabel>Auto-adjust key</SectionLabel>
        <div className='flex items-center gap-3'>
          {/* 44px hit area wrapping the visually 56x28 pill (§7.1). Display-only
              in the WOW-007A spike: a real disabled toggle (its state still
              reflected via aria-pressed) until wired in a follow-up ticket. */}
          <button
            type='button'
            aria-pressed={autoAdjustKey}
            aria-label='Auto-adjust key'
            disabled
            className='-my-2 flex min-h-[44px] min-w-[56px] items-center justify-center disabled:cursor-default disabled:opacity-75'
          >
            <span
              className={`relative block h-7 w-14 rounded-full border transition-colors ${
                autoAdjustKey
                  ? 'border-gold-bright/70 bg-gold-line/70'
                  : 'border-gold-line/30 bg-ink-btn'
              }`}
            >
              <span
                className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-parchment shadow ${
                  autoAdjustKey ? 'left-[calc(100%-22px)]' : 'left-1'
                }`}
              />
            </span>
          </button>
          <span className='font-data text-[15px] tracking-widest text-parchment/80'>
            {autoAdjustKey ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Current key */}
      <div className='flex flex-col justify-center gap-1 bg-ink-panel px-5 py-4'>
        <SectionLabel>Current key</SectionLabel>
        <div className='flex items-baseline gap-2'>
          <span className='font-display text-3xl leading-none text-parchment'>{currentKey}</span>
        </div>
        <div className='flex items-center gap-2 font-data text-[15px] uppercase tracking-widest'>
          <span className='text-parchment/60'>{keyQuality}</span>
          <span className='text-violet-300'>{keyDifference}</span>
        </div>
      </div>

      {/* Key controls */}
      <div className='flex flex-col justify-center gap-2 bg-ink-panel px-4 py-4'>
        <SectionLabel>Key controls</SectionLabel>
        <div className='flex gap-2'>
          <KeyControlButton glyph={<path d='M12 19V5M6 11l6-6 6 6' />} label='Raise' />
          <KeyControlButton glyph={<path d='M12 5v14M6 13l6 6 6-6' />} label='Lower' />
          <KeyControlButton glyph={<path d='M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3' />} label='Reset' />
        </div>
      </div>
    </div>
  );
};
