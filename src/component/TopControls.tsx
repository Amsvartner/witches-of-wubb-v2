/**
 * Visible Help + Settings controls (top-right), per the reference + wireframe.
 * Mode access lives behind Settings (ADR-006 amended 2026-07-15). In the
 * WOW-007A spike these are styled affordances only — not yet wired to a modal.
 */
export const TopControls = (): JSX.Element => (
  <div className='flex items-center gap-3'>
    <button
      type='button'
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
        <circle cx={12} cy={12} r={9} />
        <path d='M9.2 9.2a2.8 2.8 0 1 1 4 2.5c-.9.5-1.2 1-1.2 1.8' strokeLinecap='round' />
        <circle cx={12} cy={17} r={0.9} fill='currentColor' stroke='none' />
      </svg>
      HELP
    </button>
    <button
      type='button'
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
