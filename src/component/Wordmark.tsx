/**
 * Ceremonial HEXOLOGY wordmark + emblem (DESIGN_PROPOSAL_001 §2). This is the
 * screen's single <h1>. The emblem is the bespoke gold hexagram symbol asset
 * (human-supplied 2026-07-16) — public/images/hexology-logo-symbol.png.
 */
export const Wordmark = (): JSX.Element => (
  <div className='flex flex-col items-center gap-1'>
    <img
      src='/images/hexology-logo-symbol.png'
      alt=''
      aria-hidden='true'
      draggable={false}
      className='h-14 w-auto select-none'
    />
    <h1 className='bg-gradient-to-b from-gold-bright via-gold-line to-[#9a7b32] bg-clip-text font-display text-[36px] leading-none tracking-[0.16em] text-transparent'>
      HEXOLOGY
    </h1>
  </div>
);
