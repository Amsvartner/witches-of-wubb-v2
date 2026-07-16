import { type CSSProperties } from 'react';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarStatus } from '~/type/PillarView';
import { CategoryIcon } from '~/component/CategoryIcon';

type Props = {
  status: PillarStatus;
  /** Absent => empty pillar: desaturated dashed ring, no icon or colour. */
  category?: ClipTypes;
  /** Category `-300` tint hex (ring + icon + rays). Required when set. */
  tintHex?: string;
  /** Category fill hex, used for the glow. */
  fillHex?: string;
  /** Paused or muted — desaturated. */
  dimmed?: boolean;
};

const DIAMETER = 84;
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
}: Props): JSX.Element => {
  const size: CSSProperties = { width: DIAMETER, height: DIAMETER };

  if (!category || status === 'empty') {
    return (
      <div
        style={size}
        className='flex items-center justify-center rounded-full border-2 border-dashed border-[#3a3540] bg-ink-panel/60'
      >
        <span className='font-display text-3xl text-[#5a5560]' aria-hidden='true'>
          ?
        </span>
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
    queued ? 'border-dashed motion-safe:animate-pulse-calm' : 'border-solid',
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
      <CategoryIcon type={category} size={46} className='relative' />
    </div>
  );
};
