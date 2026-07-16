/**
 * Central cauldron focal point with its rising magical plume — the bespoke
 * cauldron art asset (human-supplied 2026-07-16), transparent background,
 * naturally proportioned. Static image — trivially satisfies the calm-motion
 * rule (§7.4).
 */
export const Cauldron = (): JSX.Element => (
  <div className='flex items-end justify-center' data-testid='cauldron'>
    <img
      src='/images/hexology-cauldron.png'
      alt='Cauldron'
      draggable={false}
      className='w-full max-w-[300px] select-none'
    />
  </div>
);
