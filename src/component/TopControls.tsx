type Props = {
  /** Opens the Settings modal (hosts the play/DJ mode switch + animations). */
  onOpenSettings: () => void;
  /** True while the Help overlay is open — reflected via aria-pressed. */
  helpActive: boolean;
  /** Toggles the Help overlay open/closed. */
  onToggleHelp: () => void;
};

/**
 * Visible Help + Settings controls (top-right), per the reference + wireframe.
 * Mode access lives behind Settings (ADR-006 amended 2026-07-15) — which is
 * also the only way OUT of DJ mode since the separate EXIT DJ button was
 * removed (human, 2026-07-21); the DJ auto-exit timer remains the walk-away
 * failsafe. Settings is wired to the modal; Help toggles the HelpOverlay
 * (human spec 2026-07-20 — previously disabled pending content).
 */
export const TopControls = ({ onOpenSettings, helpActive, onToggleHelp }: Props): JSX.Element => (
  <div className='flex items-center gap-3'>
    <button
      type='button'
      onClick={onToggleHelp}
      aria-pressed={helpActive}
      className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-4 font-data text-sm tracking-wide ${
        helpActive
          ? 'border-gold-bright/70 bg-gold-line/70 text-ink-deep'
          : 'border-gold-line/50 bg-ink-btn text-parchment/90'
      }`}
    >
      <svg
        viewBox='0 0 24 24'
        className={`h-4 w-4 ${helpActive ? 'text-ink-deep' : 'text-gold-line'}`}
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        aria-hidden='true'
      >
        <circle cx={12} cy={12} r={9} />
        <path d='M9.2 9.2a2.8 2.8 0 1 1 4 2.5c-.9.5-1.2 1-1.2 1.8' strokeLinecap='round' />
        <circle cx={12} cy={17} r={0.9} fill='currentColor' stroke='none' />
      </svg>
      HELP
    </button>
    <button
      type='button'
      onClick={onOpenSettings}
      className='flex min-h-[44px] items-center gap-2 rounded-lg border border-gold-line/50 bg-ink-btn px-4 font-data text-sm tracking-wide text-parchment/90'
    >
      <svg
        viewBox='0 0 24 24'
        className='h-4 w-4 text-gold-line'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        aria-hidden='true'
      >
        <circle cx={12} cy={12} r={3.2} />
        <path
          d='M12 3v2.4M12 18.6V21M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2'
          strokeLinecap='round'
        />
      </svg>
      SETTINGS
    </button>
  </div>
);
