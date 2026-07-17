import { Dialog } from '@headlessui/react';

type Props = {
  open: boolean;
  onClose: () => void;
  animationsEnabled: boolean;
  onAnimationsEnabledChange: (value: boolean) => void;
};

/**
 * Settings modal (first wired control of the spike, human direction
 * 2026-07-17): hosts the global animations kill-switch so all ambient motion
 * (equalizer bars, medallion pulses, future animations) can be disabled on
 * the fly if kiosk GPU headroom demands it.
 * Mode switching and further settings arrive with WOW-007 (ADR-006 amended).
 * Near-opaque overlay per DESIGN_PROPOSAL_001 §3.1 (surface/overlay).
 */
export const SettingsModal = ({
  open,
  onClose,
  animationsEnabled,
  onAnimationsEnabledChange,
}: Props): JSX.Element => (
  <Dialog open={open} onClose={onClose} className='relative z-50'>
    <div className='fixed inset-0 bg-[#0b0910]/95' aria-hidden='true' />
    <div className='fixed inset-0 flex items-center justify-center p-6'>
      <Dialog.Panel className='w-full max-w-md rounded-2xl border border-gold-line/40 bg-ink-panel p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]'>
        <Dialog.Title className='font-display text-2xl tracking-[0.14em] text-gold-bright'>
          Settings
        </Dialog.Title>

        <div className='mt-5 flex min-h-[44px] items-center justify-between gap-4'>
          <span className='font-data text-[15px] text-parchment/90'>Animations</span>
          <button
            type='button'
            aria-pressed={animationsEnabled}
            aria-label='Animations'
            onClick={() => onAnimationsEnabledChange(!animationsEnabled)}
            className='-my-2 flex min-h-[44px] min-w-[56px] items-center justify-center'
          >
            <span
              className={`relative block h-7 w-14 rounded-full border transition-colors ${
                animationsEnabled
                  ? 'border-gold-bright/70 bg-gold-line/70'
                  : 'border-gold-line/30 bg-ink-btn'
              }`}
            >
              <span
                className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-parchment shadow ${
                  animationsEnabled ? 'left-[calc(100%-22px)]' : 'left-1'
                }`}
              />
            </span>
          </button>
        </div>
        <p className='mt-1 font-data text-[15px] text-parchment/60'>
          Disable if the show machine needs the GPU headroom.
        </p>

        <div className='mt-6 flex justify-end'>
          <button
            type='button'
            onClick={onClose}
            className='flex min-h-[44px] items-center rounded-lg border border-gold-line/50 bg-ink-btn px-5 font-data text-sm tracking-wide text-parchment/90'
          >
            Close
          </button>
        </div>
      </Dialog.Panel>
    </div>
  </Dialog>
);
