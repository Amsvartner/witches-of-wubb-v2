import { useState } from 'react';

type Props = {
  /** Global animations switch (Settings kill-switch); fully static when false. */
  animated?: boolean;
};

// Rising plume blobs: desynced via per-blob offset/size/timing (deterministic).
const BLOBS = [
  { left: '30%', size: 34, delay: 0, duration: 4200 },
  { left: '46%', size: 44, delay: 900, duration: 5100 },
  { left: '64%', size: 30, delay: 1700, duration: 4600 },
  { left: '38%', size: 40, delay: 2600, duration: 5400 },
  { left: '56%', size: 32, delay: 3400, duration: 4900 },
];

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
 */
export const Cauldron = ({ animated = true }: Props): JSX.Element => {
  const [ringKey, setRingKey] = useState(0);
  const [ringVisible, setRingVisible] = useState(false);

  const spawnRing = (): void => {
    // No ring under reduced motion: the animation would never run, so
    // onAnimationEnd would never fire and the (invisible) node would leak.
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animated || reducedMotion) {
      return;
    }
    setRingKey((k) => k + 1);
    setRingVisible(true);
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
        type='button'
        aria-label='Cauldron'
        onClick={spawnRing}
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
        {ringVisible && animated && (
          <span
            key={ringKey}
            aria-hidden='true'
            onAnimationEnd={() => setRingVisible(false)}
            className='absolute left-1/2 top-1/2 aspect-square w-[105%] rounded-full border-2 border-[#e879f9] opacity-0 motion-safe:animate-cauldron-ring'
            style={{ boxShadow: '0 0 24px #e879f966, inset 0 0 16px #e879f944' }}
          />
        )}
      </button>

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
