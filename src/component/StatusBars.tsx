import { type CSSProperties } from 'react';

type Props = {
  /** Bar colour (category fill hex). */
  colorHex: string;
  /** Animated when actively playing; static + dimmed otherwise (e.g. muted). */
  active: boolean;
  /** Global animation switch (Settings kill-switch); static when false. */
  animated?: boolean;
};

// Deterministic equalizer silhouette (no randomness — stable renders/tests).
const BAR_HEIGHTS = [45, 70, 35, 85, 55, 95, 40, 75, 60, 90, 50];

/**
 * Small equalizer-bar motif under the pillar medallion (human direction
 * 2026-07-17, per supplied mock). While a sample plays, the bars dance via a
 * staggered scaleY animation — transform-only, so it stays on the compositor
 * (no layout/paint) and adds no meaningful GPU/CPU load; reduced-motion users
 * and non-playing states (muted/paused/queued) get the static silhouette.
 * Empty pillars render no bars at all (gated by the parent).
 */
export const StatusBars = ({ colorHex, active, animated = true }: Props): JSX.Element => (
  <div
    className='flex h-6 items-end gap-[3px]'
    style={{ opacity: active ? 1 : 0.35 }}
    aria-hidden='true'
  >
    {BAR_HEIGHTS.map((h, i) => {
      const style: CSSProperties = {
        height: `${h}%`,
        backgroundColor: colorHex,
        boxShadow: `0 0 4px ${colorHex}88`,
      };
      const dancing = active && animated;
      if (dancing) {
        // Deterministic per-bar stagger so the bars desynchronise calmly.
        style.animationDelay = `${-((i * 137) % 1200)}ms`;
        style.animationDuration = `${1050 + (i % 4) * 150}ms`;
      }
      return (
        <span
          key={i}
          className={`w-[4px] origin-bottom rounded-sm ${dancing ? 'motion-safe:animate-eq' : ''}`}
          style={style}
        />
      );
    })}
  </div>
);
