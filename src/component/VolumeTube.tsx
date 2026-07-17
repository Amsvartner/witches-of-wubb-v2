import { type CSSProperties } from 'react';
import { SectionLabel } from '~/component/SectionLabel';

type Props = {
  /** 0–100 display value. Ignored when `assetSlug` is absent (empty pillar). */
  volumePercent: number;
  /**
   * Category asset slug — selects the bespoke tube + gem art. Absent => empty
   * pillar: renders the bespoke empty-tube asset with no gem and no percentage.
   */
  assetSlug?: 'red' | 'amber' | 'green' | 'blue';
};

const GEM_WIDTH = 54;

/**
 * Vertical potion-tube volume indicator built from the bespoke art assets
 * (human-supplied 2026-07-16, transparent pack): the gold-framed energy tube
 * renders dimmed as the empty glass, with the same art clipped from the bottom
 * as the lit fill, and the gold-set gem riding the fill line. Stretches the
 * full pillar-card body height. Static/display-only in the WOW-007A spike.
 */
export const VolumeTube = ({ volumePercent, assetSlug }: Props): JSX.Element => {
  const clamped = Math.max(0, Math.min(100, volumePercent));
  const tubeSrc = `/images/slider-background-${assetSlug ?? 'empty'}.png`;
  const gemSrc = assetSlug ? `/images/slider-handle-${assetSlug}.png` : undefined;

  const litClip: CSSProperties = { clipPath: `inset(${100 - clamped}% 0 0 0)` };
  // Clamp so the gem never leaves the tube at the volume extremes (0%/100%).
  const gemPos: CSSProperties = {
    width: GEM_WIDTH,
    bottom: `clamp(0px, calc(${clamped}% - ${GEM_WIDTH / 2}px), calc(100% - ${GEM_WIDTH}px))`,
  };

  return (
    <div className='flex w-[80px] select-none flex-col items-center gap-1.5'>
      <div className='relative min-h-0 w-full flex-1'>
        <img
          src={tubeSrc}
          alt=''
          aria-hidden='true'
          draggable={false}
          className={`absolute left-1/2 h-full w-auto -translate-x-1/2 ${
            assetSlug ? 'brightness-[0.3] saturate-[0.6]' : ''
          }`}
        />
        {assetSlug && (
          <>
            <img
              src={tubeSrc}
              alt=''
              aria-hidden='true'
              draggable={false}
              style={litClip}
              className='absolute left-1/2 h-full w-auto -translate-x-1/2'
            />
            <img
              src={gemSrc}
              alt=''
              aria-hidden='true'
              draggable={false}
              style={gemPos}
              className='absolute left-1/2 -translate-x-1/2'
            />
          </>
        )}
      </div>
      <div className='mt-1.5 flex flex-col items-center'>
        {assetSlug && <SectionLabel>Volume</SectionLabel>}
        {assetSlug && <span className='sr-only'>{`${clamped}%`}</span>}
        <span
          aria-hidden='true'
          className='font-number text-xl font-semibold leading-none tabular-nums text-parchment/90'
        >
          {assetSlug ? `${clamped}%` : ' '}
        </span>
      </div>
    </div>
  );
};
