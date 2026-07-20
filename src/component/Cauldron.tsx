import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** Global animations switch (Settings kill-switch); fully static when false. */
  animated?: boolean;
  /**
   * WOW-007C: fires a random cauldron drum-rack sample on tap/click, in
   * addition to the existing ring animation. Absent = ring-only (tests,
   * display-only renders).
   */
  onTrigger?: () => void;
};

// Rising plume blobs: desynced via per-blob offset/size/timing (deterministic).
const BLOBS = [
  { left: '30%', size: 34, delay: 0, duration: 4200 },
  { left: '46%', size: 44, delay: 900, duration: 5100 },
  { left: '64%', size: 30, delay: 1700, duration: 4600 },
  { left: '38%', size: 40, delay: 2600, duration: 5400 },
  { left: '56%', size: 32, delay: 3400, duration: 4900 },
];

/** Viewport-space anchor for the portal-rendered ring — mirrors the button's
 * old in-place geometry (centred, 105% of the button's width, square) but
 * expressed as fixed-position coordinates so it lands identically once
 * rendered outside the button's own stacking context (see Cauldron doc
 * comment below). */
type RingRect = { left: number; top: number; size: number };

/**
 * Central cauldron focal point — the bespoke black-background art
 * (human-supplied 2026-07-17), edge-feathered in processing and sat on a thick
 * black radial glow so it blends into the page ground.
 *
 * Ambient "magic cauldron" animation (human spec 2026-07-17), pure CSS in
 * three layers: rising blurred blobs from the rim, a slow ±4px float on the
 * vessel, and a one-shot expanding ring on click/tap (the wireframe marks the
 * cauldron clickable — SFX arrives with live wiring). All layers are
 * transform/opacity-only (compositor-cheap), gated behind `motion-safe`
 * (§7.4 reduced-motion) and the Settings animations kill-switch.
 *
 * The click ring is portalled to `document.body` (human spec 2026-07-20):
 * PlayModeContainer stacks the cauldron's own wrapper at z-20 (above the
 * top-row pillar cards, below the bottom-row ones), which caps anything
 * rendered inside this component's own subtree at that same stacking
 * context. A ring meant to sweep in front of every card can't live inside
 * it, so on spawn we measure the button's `getBoundingClientRect` and render
 * the ring as a `position: fixed`, `pointer-events-none`, z-50 node on body
 * instead — same one-shot animation, same reduced-motion/kill-switch gating,
 * same `onAnimationEnd` cleanup, just rendered outside the DOM subtree.
 */
export const Cauldron = ({ animated = true, onTrigger }: Props): JSX.Element => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [ringKey, setRingKey] = useState(0);
  const [ringVisible, setRingVisible] = useState(false);
  const [ringRect, setRingRect] = useState<RingRect | null>(null);

  const spawnRing = (): void => {
    // No ring under reduced motion: the animation would never run, so
    // onAnimationEnd would never fire and the (invisible) node would leak.
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animated || reducedMotion) {
      return;
    }
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    if (!buttonRect) {
      return;
    }
    const size = buttonRect.width * 1.05;
    setRingRect({
      left: buttonRect.left + buttonRect.width / 2,
      top: buttonRect.top + buttonRect.height / 2,
      size,
    });
    setRingKey((k) => k + 1);
    setRingVisible(true);
  };

  const handleClick = (): void => {
    spawnRing();
    onTrigger?.();
  };

  return (
    <div className='relative flex items-end justify-center'>
      <div
        aria-hidden='true'
        className='absolute -inset-[14%]'
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000000 55%, transparent 100%)',
        }}
      />

      <button
        ref={buttonRef}
        type='button'
        aria-label='Cauldron'
        onClick={handleClick}
        className={`relative block w-full select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-bright ${
          animated ? 'motion-safe:animate-cauldron-float' : ''
        }`}
      >
        <img
          src='/images/hexology-cauldron.png'
          alt=''
          draggable={false}
          className='pointer-events-none w-full'
        />
      </button>

      {ringVisible &&
        animated &&
        ringRect &&
        createPortal(
          <span
            key={ringKey}
            data-testid='cauldron-ring'
            aria-hidden='true'
            onAnimationEnd={() => setRingVisible(false)}
            className='fixed z-50 rounded-full border-2 border-[#e879f9] opacity-0 motion-safe:animate-cauldron-ring pointer-events-none'
            style={{
              left: ringRect.left,
              top: ringRect.top,
              width: ringRect.size,
              height: ringRect.size,
              // Faint static glow (human spec 2026-07-20): a subtle, non-pulsing
              // extra outer layer on top of the existing animated-opacity glow
              // — always the same value, it just fades with the ring itself.
              boxShadow: '0 0 24px #e879f966, inset 0 0 16px #e879f944, 0 0 46px 8px #e879f933',
            }}
          />,
          document.body,
        )}

      {animated && (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 z-10 mix-blend-screen'
        >
          {BLOBS.map((blob, i) => (
            <span
              key={i}
              className='absolute rounded-full opacity-0 motion-safe:animate-cauldron-blob'
              style={{
                left: blob.left,
                top: '52%',
                width: blob.size,
                height: blob.size,
                background: 'radial-gradient(circle, #e879f9cc 0%, #c026d355 55%, transparent 75%)',
                filter: 'blur(6px)',
                animationDelay: `${blob.delay}ms`,
                animationDuration: `${blob.duration}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
