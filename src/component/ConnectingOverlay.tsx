type Props = {
  /** Global animations switch (Settings kill-switch); pulse suppressed when false. */
  animated?: boolean;
};

/**
 * Centred "Connecting to the cauldron…" notice shown while the socket is
 * disconnected, replacing the old top-of-screen amber banner (human,
 * 2026-07-21: same design as EmptyStateOverlay's card — keep the two visual
 * shells in sync). `role='status'`/`aria-live` carried over from the banner
 * so assistive tech still announces the connection state change.
 * `pointer-events-none` so it never blocks the controls beneath it — in DJ
 * mode the screen stays operable while the backend reconnects.
 * PlayModeContainer suppresses EmptyStateOverlay while this is up, so the
 * two cards never stack.
 */
export const ConnectingOverlay = ({ animated = true }: Props): JSX.Element => (
  <div className='pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-8'>
    <div
      role='status'
      aria-live='polite'
      className={`max-w-[380px] rounded-2xl border border-gold-line/40 bg-ink-panel/90 px-6 py-5 text-center shadow-[0_0_40px_rgba(0,0,0,0.6)] ${
        animated ? 'motion-safe:animate-pulse-calm' : ''
      }`}
    >
      <p className='font-display text-xl tracking-[0.08em] text-gold-bright'>
        Connecting to the cauldron…
      </p>
      <p className='mt-2 font-data text-[15px] text-parchment/80'>
        The spirits are aligning — one moment ✦
      </p>
    </div>
  </div>
);
