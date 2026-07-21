type Props = {
  /** Global animations switch (Settings kill-switch); pulse suppressed when false. */
  animated?: boolean;
};

/**
 * Centred, non-blocking invitation shown over the middle of the screen when
 * all four pillars are empty in play mode (human spec 2026-07-20) — a nudge
 * for a visitor who hasn't placed anything yet. `pointer-events-none` on the
 * whole overlay so it never intercepts touches meant for the pillar cards or
 * cauldron beneath it (PlayModeContainer gates this component's presence on
 * "all pillars empty AND play mode AND Help not open" — it never renders
 * over anything actually happening). The pulse is gated behind `motion-safe`
 * (reduced-motion) and the Settings animations kill-switch, same pattern as
 * StatusBars/Cauldron.
 */
export const EmptyStateOverlay = ({ animated = true }: Props): JSX.Element => (
  <div className='pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-8'>
    <div
      className={`max-w-[380px] rounded-2xl border border-gold-line/40 bg-ink-panel/90 px-6 py-5 text-center shadow-[0_0_40px_rgba(0,0,0,0.6)] ${
        animated ? 'motion-safe:animate-pulse-calm' : ''
      }`}
    >
      <p className='font-display text-xl tracking-[0.08em] text-gold-bright'>
        The cauldron slumbers…
      </p>
      <p className='mt-2 font-data text-[15px] text-parchment/80'>
        Place an ingredient upon a pillar to begin the spell ✦
      </p>
    </div>
  </div>
);
