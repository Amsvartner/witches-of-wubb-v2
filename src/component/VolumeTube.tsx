import { type CSSProperties, type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { SectionLabel } from '~/component/SectionLabel';

type Props = {
  /** 0–100 display value. Ignored when `assetSlug` is absent (empty pillar). */
  volumePercent: number;
  /**
   * Category asset slug — selects the bespoke tube + gem art. Absent => empty
   * pillar: renders the bespoke empty-tube asset with no gem and no percentage.
   */
  assetSlug?: 'red' | 'amber' | 'green' | 'blue';
  /**
   * Makes the tube a live volume control (WOW-007B): dragging/tapping along
   * the tube sets the volume, arrow keys nudge it. Absent => display-only
   * (empty pillars, tests, mock renders).
   */
  onPercentChange?: (percent: number) => void;
  /** Drag bracketing for the caller's echo suppression (useSliderEmit). */
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

const GEM_WIDTH = 54;
const KEY_STEP = 5;

/**
 * Vertical potion-tube volume indicator built from the bespoke art assets
 * (human-supplied 2026-07-16, transparent pack): the gold-framed energy tube
 * renders dimmed as the empty glass, with the same art clipped from the bottom
 * as the lit fill, and the gold-set gem riding the fill line.
 *
 * Interactive when `onPercentChange` is provided (WOW-007B): pointer-based
 * rather than a rotated `<input type=range>` so touch drags track the finger
 * exactly on the kiosk; exposes the ARIA slider pattern (role, value, arrow
 * keys) for keyboard/AT parity.
 */
export const VolumeTube = ({
  volumePercent,
  assetSlug,
  onPercentChange,
  onDragStart,
  onDragEnd,
}: Props): JSX.Element => {
  const clamped = Math.max(0, Math.min(100, volumePercent));
  const tubeSrc = `/images/slider-background-${assetSlug ?? 'empty'}.png`;
  const gemSrc = assetSlug ? `/images/slider-handle-${assetSlug}.png` : undefined;
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const litClip: CSSProperties = { clipPath: `inset(${100 - clamped}% 0 0 0)` };
  // Clamp so the gem never leaves the tube at the volume extremes (0%/100%).
  const gemPos: CSSProperties = {
    width: GEM_WIDTH,
    bottom: `clamp(0px, calc(${clamped}% - ${GEM_WIDTH / 2}px), calc(100% - ${GEM_WIDTH}px))`,
  };

  const interactive = Boolean(assetSlug && onPercentChange);

  const percentFromPointer = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return clamped;
    const fraction = (rect.bottom - event.clientY) / rect.height;
    return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onDragStart?.();
    onPercentChange?.(percentFromPointer(event));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || !draggingRef.current) return;
    onPercentChange?.(percentFromPointer(event));
  };

  const handlePointerUp = () => {
    if (!interactive || !draggingRef.current) return;
    draggingRef.current = false;
    onDragEnd?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const delta =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? KEY_STEP
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -KEY_STEP
        : 0;
    if (delta === 0) return;
    event.preventDefault();
    onPercentChange?.(Math.max(0, Math.min(100, clamped + delta)));
  };

  return (
    <div className='flex w-[80px] select-none flex-col items-center gap-1.5'>
      <div
        ref={trackRef}
        className={`relative min-h-0 w-full flex-1 ${
          interactive ? 'cursor-pointer touch-none' : ''
        }`}
        {...(interactive
          ? {
              role: 'slider',
              'aria-label': 'Volume',
              'aria-orientation': 'vertical' as const,
              'aria-valuemin': 0,
              'aria-valuemax': 100,
              'aria-valuenow': clamped,
              'aria-valuetext': `${clamped}%`,
              tabIndex: 0,
              onPointerDown: handlePointerDown,
              onPointerMove: handlePointerMove,
              onPointerUp: handlePointerUp,
              onPointerCancel: handlePointerUp,
              onKeyDown: handleKeyDown,
            }
          : {})}
      >
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
              className='pointer-events-none absolute left-1/2 h-full w-auto -translate-x-1/2'
            />
            <img
              src={gemSrc}
              alt=''
              aria-hidden='true'
              draggable={false}
              style={gemPos}
              className='pointer-events-none absolute left-1/2 -translate-x-1/2'
            />
          </>
        )}
      </div>
      <div className='mt-1.5 flex flex-col items-center'>
        {assetSlug && <SectionLabel>Volume</SectionLabel>}
        {assetSlug && !interactive && <span className='sr-only'>{`${clamped}%`}</span>}
        <span
          aria-hidden='true'
          className='font-number text-xl font-semibold leading-none tabular-nums text-parchment/90'
        >
          {assetSlug ? `${clamped}%` : ' '}
        </span>
      </div>
    </div>
  );
};
