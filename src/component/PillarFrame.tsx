import { type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

const AMBER = '#d9a441';
const AMBER_BRIGHT = '#f0cd77';

/**
 * Shared pillar frame — bright antique-amber double border with a top-centre
 * flourish (DESIGN_PROPOSAL_001 §8.5; amber per human direction 2026-07-15;
 * corner embellishments removed per human direction 2026-07-16). All four
 * pillars use this identical frame (symmetry requirement). Decoration is
 * pointer-events-none so it never intercepts controls.
 */
export const PillarFrame = ({ children, className }: Props): JSX.Element => (
  <div
    className={`relative rounded-2xl bg-ink-panel/90 ${className ?? ''}`}
    style={{ boxShadow: `inset 0 0 0 1.5px ${AMBER}cc` }}
  >
    <div
      className='pointer-events-none absolute inset-[5px] rounded-xl'
      style={{ boxShadow: `inset 0 0 0 1px ${AMBER}59` }}
    />
    <svg
      viewBox='0 0 120 26'
      className='pointer-events-none absolute -top-1 left-1/2 h-6 w-28 -translate-x-1/2'
      aria-hidden='true'
    >
      <g fill='none' stroke={AMBER} strokeWidth={1.3} strokeLinecap='round'>
        <path d='M60 20 C60 10 66 6 74 8 C68 6 62 4 60 12 C58 4 52 6 46 8 C54 6 60 10 60 20' />
        <path d='M74 8 C82 6 88 10 96 8' opacity={0.7} />
        <path d='M46 8 C38 6 32 10 24 8' opacity={0.7} />
      </g>
      <path d='M60 8 l3.5 4 l-3.5 4 l-3.5 -4 z' fill={AMBER_BRIGHT} />
    </svg>
    <div className='relative h-full'>{children}</div>
  </div>
);
