import { type CSSProperties } from 'react';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarStatus } from '~/type/PillarStatus';
import { CategoryIcon } from '~/component/CategoryIcon';

// Discriminated on the presence of a category: a categorised pillar must supply
// the tint + fill trio together, while an empty pillar supplies none of them.
// This makes "categorised medallion with an undefined tint/fill" unrepresentable,
// so the caller can never pass a possibly-undefined colour (the WOW-007A CI build
// break) — it must branch first.
type Props = {
  status: PillarStatus;
  /** Paused or muted — desaturated. */
  dimmed?: boolean;
  /** Global animations switch (Settings kill-switch); static when false. */
  animated?: boolean;
  /**
   * DJ-mode only (WOW-007B change 3): when supplied, the empty medallion
   * renders as an interactive "Add sample" button instead of a static div —
   * opens the same sample-selection modal as the header's Select sample
   * control. Only meaningful on the empty-pillar branch below; play mode
   * never supplies it (human decision 2026-07-17: no buttons outside DJ).
   */
  onAddSample?: () => void;
} & (
  | {
      /** Category identity — required together with its tint + fill. */
      category: ClipTypes;
      /** Category `-300` tint hex (ring + icon + rays). */
      tintHex: string;
      /** Category fill hex, used for the glow. */
      fillHex: string;
    }
  | {
      /** Empty pillar: no category identity (desaturated dashed ring, no colour). */
      category?: never;
      tintHex?: never;
      fillHex?: never;
    }
);

const DIAMETER = 126;
const RAY_COUNT = 48;

// Ray burst behind the icon, inside the ring (human direction 2026-07-16:
// this earlier treatment reads better than outward rays). Deterministic;
// alternating length/opacity for a natural burst.
const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
  const angle = (i / RAY_COUNT) * Math.PI * 2;
  const inner = 20;
  const outer = i % 2 === 0 ? 47 : 39;
  return {
    key: i,
    x1: 50 + Math.cos(angle) * inner,
    y1: 50 + Math.sin(angle) * inner,
    x2: 50 + Math.cos(angle) * outer,
    y2: 50 + Math.sin(angle) * outer,
    opacity: i % 2 === 0 ? 0.5 : 0.24,
  };
});

/**
 * Circular category medallion (DESIGN_PROPOSAL_001 §3.8) with an inner
 * ray-burst and glow, per the primary reference. Colour is never the only cue:
 * ring style (solid / dashed), the icon shape, and the adjacent name + status
 * text also encode state (§7.2).
 */
export const PillarMedallion = ({
  status,
  category,
  tintHex,
  fillHex,
  dimmed,
  animated = true,
  onAddSample,
}: Props): JSX.Element => {
  const size: CSSProperties = { width: DIAMETER, height: DIAMETER };

  if (!category || status === 'empty') {
    // Just the plus glyph — the little decorative ✦ sparkle it once had was
    // removed (human direction 2026-07-20).
    const emptyContent = (
      <span className='font-data text-5xl font-light text-[#5a5560]' aria-hidden='true'>
        +
      </span>
    );

    if (onAddSample) {
      return (
        <button
          type='button'
          aria-label='Add sample'
          onClick={onAddSample}
          style={size}
          className='relative flex cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-[#3a3540] bg-ink-panel/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright'
        >
          {emptyContent}
        </button>
      );
    }

    return (
      <div
        style={size}
        className='relative flex items-center justify-center rounded-full border-2 border-dashed border-[#3a3540] bg-ink-panel/60'
      >
        {emptyContent}
      </div>
    );
  }

  const live = status === 'playing' && !dimmed;
  const queued = status === 'queued';

  const ringStyle: CSSProperties = {
    ...size,
    color: tintHex,
    borderColor: tintHex,
    background: fillHex
      ? `radial-gradient(circle at 50% 50%, ${fillHex}33 0%, transparent 70%)`
      : undefined,
    boxShadow: live
      ? `0 0 30px 3px ${fillHex}66, inset 0 0 20px ${fillHex}33`
      : `0 0 16px ${fillHex}44`,
    opacity: dimmed ? 0.5 : 1,
  };

  const ringClass = [
    'relative flex items-center justify-center rounded-full border-[3px]',
    queued && animated
      ? 'border-dashed motion-safe:animate-pulse-calm'
      : queued
      ? 'border-dashed'
      : 'border-solid',
  ].join(' ');

  return (
    <div style={ringStyle} className={ringClass}>
      <svg
        viewBox='0 0 100 100'
        className='pointer-events-none absolute inset-0 h-full w-full'
        aria-hidden='true'
      >
        {rays.map((r) => (
          <line
            key={r.key}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            stroke={tintHex}
            strokeWidth={0.7}
            opacity={live ? r.opacity : r.opacity * 0.6}
          />
        ))}
      </svg>
      <CategoryIcon type={category} size={68} className='relative' />
    </div>
  );
};
