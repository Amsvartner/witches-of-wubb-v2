import { type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  /**
   * Category hue for the frame (human direction 2026-07-17: the border carries
   * the pillar's colour as visual guidance). Absent => empty pillar: a low-key
   * dark amber.
   */
  borderHex?: string;
  /** Bright accent for the flourish diamond (category tint). */
  accentHex?: string;
};

// Low-key empty-pillar frame colours (no sample present).
const EMPTY_BORDER = '#7a6230';
const EMPTY_ACCENT = '#9a7b42';

/**
 * Shared pillar frame — double border with a top-centre flourish, coloured by
 * the pillar's category (DESIGN_PROPOSAL_001 §8.5 as revised by the human
 * 2026-07-17; corner embellishments removed 2026-07-16). All four pillars use
 * this identical frame geometry (symmetry requirement) — only the hue varies.
 * Decoration is pointer-events-none so it never intercepts controls.
 */
export const PillarFrame = ({ children, className, borderHex, accentHex }: Props): JSX.Element => {
  const border = borderHex ?? EMPTY_BORDER;
  const accent = accentHex ?? EMPTY_ACCENT;
  return (
    <div
      className={`relative rounded-2xl bg-ink-panel/90 ${className ?? ''}`}
      style={{
        boxShadow: `inset 0 0 0 1.5px ${border}cc`,
        // Discrete category-tinted wash over the panel (human, 2026-07-17).
        backgroundImage: `linear-gradient(180deg, ${border}24 0%, ${border}0d 45%, transparent 80%)`,
      }}
    >
      <div
        className='pointer-events-none absolute inset-[5px] rounded-xl'
        style={{ boxShadow: `inset 0 0 0 1px ${border}59` }}
      />
      <svg
        viewBox='0 0 120 26'
        className='pointer-events-none absolute -top-1 left-1/2 h-6 w-28 -translate-x-1/2'
        aria-hidden='true'
      >
        <g fill='none' stroke={border} strokeWidth={1.3} strokeLinecap='round'>
          <path d='M60 20 C60 10 66 6 74 8 C68 6 62 4 60 12 C58 4 52 6 46 8 C54 6 60 10 60 20' />
          <path d='M74 8 C82 6 88 10 96 8' opacity={0.7} />
          <path d='M46 8 C38 6 32 10 24 8' opacity={0.7} />
        </g>
        <path d='M60 8 l3.5 4 l-3.5 4 l-3.5 -4 z' fill={accent} />
      </svg>
      <div className='relative h-full'>{children}</div>
    </div>
  );
};
