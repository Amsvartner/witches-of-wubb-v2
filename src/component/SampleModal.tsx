import { Dialog } from '@headlessui/react';
import { ClipTypes } from 'backend/type/ClipTypes';
import { CategoryTheme } from '~/util/CategoryTheme';

export type SelectableClip = {
  rfid: string;
  clipName: string;
  type: ClipTypes;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** 1-based pillar number, for the title. */
  pillarNumber: number;
  /** Full clip catalogue, already sorted by name (DebugModal parity). */
  clips: SelectableClip[];
  /** Places the clip on this pillar (emits the new-tag event) and closes. */
  onPick: (rfid: string) => void;
};

/**
 * DJ-mode sample picker (WOW-007B) — the old debug modal's per-pillar clip
 * list in grimoire styling: every catalogue clip, tap to place it on the
 * pillar (the same simulated-tag event the debug modal emitted). Placing is
 * additive, not destructive, so no confirm gate (UX_UI_PRINCIPLES 2 applies
 * to stop/remove, which live on the pillar card).
 */
export const SampleModal = ({ open, onClose, pillarNumber, clips, onPick }: Props): JSX.Element => (
  <Dialog open={open} onClose={onClose} className='relative z-50'>
    <div className='fixed inset-0 bg-[#0b0910]/95' aria-hidden='true' />
    <div className='fixed inset-0 flex items-center justify-center p-6'>
      <Dialog.Panel className='flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-gold-line/40 bg-ink-panel p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]'>
        <Dialog.Title className='font-display text-2xl tracking-[0.14em] text-gold-bright'>
          Pillar {pillarNumber} — Select sample
        </Dialog.Title>

        <ul className='mt-4 min-h-0 flex-1 overflow-y-auto pr-1'>
          {clips.map((clip) => {
            const tokens = CategoryTheme.forType(clip.type);
            return (
              <li key={clip.rfid}>
                <button
                  type='button'
                  onClick={() => onPick(clip.rfid)}
                  className='flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-ink-btn focus-visible:bg-ink-btn'
                >
                  <span
                    style={{
                      backgroundColor: tokens.fillHex,
                      boxShadow: `0 0 6px ${tokens.fillHex}aa`,
                    }}
                    className='h-2.5 w-2.5 shrink-0 rounded-full'
                    aria-hidden='true'
                  />
                  <span className='flex-1 truncate font-data text-[15px] text-parchment/90'>
                    {clip.clipName}
                  </span>
                  <span
                    style={{ color: tokens.tintHex }}
                    className='font-data text-xs uppercase tracking-[0.14em]'
                  >
                    {tokens.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className='mt-4 flex justify-end'>
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
