import { useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { IdleTimeoutConfigType } from 'backend/type/IdleTimeoutConfigType';
import { useSliderEmit } from '~/hook/useSliderEmit';
import { VOLUME_MAX } from '~/util/PillarViewUtil';

// NOTE (general review, PR #56): hosting useSliderEmit — a stateful,
// throttled-emission hook — in this presentational component is a deliberate,
// documented exception to the container/component split: the cauldron slider
// is the modal's only socket-coupled control, and threading its drag state
// through PlayModeContainer would triple the prop surface for no isolation
// gain. VOLUME_MAX is imported from the shared source rather than copied.

const toPercent = (volume: number): number =>
  Math.round((Math.max(0, Math.min(volume, VOLUME_MAX)) / VOLUME_MAX) * 100);

const toRawVolume = (percent: number): number => (percent / 100) * VOLUME_MAX;

/** Minutes choices for the pause-music idle timeout (WOW-007C). */
const IDLE_TIMEOUT_MINUTES_CHOICES = [1, 2, 3, 5, 10];

/** Minutes choices for the DJ auto-exit duration (WOW-007C). */
const DJ_AUTO_EXIT_MINUTES_CHOICES = [1, 5, 10, 30];

const MINUTE_MS = 60 * 1000;

type Props = {
  open: boolean;
  onClose: () => void;
  mode: 'play' | 'dj';
  onModeChange: (mode: 'play' | 'dj') => void;
  animationsEnabled: boolean;
  onAnimationsEnabledChange: (value: boolean) => void;
  /** WOW-007C: cauldron (drum-rack track) loudness, raw 0..0.7. */
  cauldronVolume: number;
  onCauldronVolumeChange: (volume: number) => void;
  /** WOW-007C: idle-timeout ("pause music"/attractor handover) config. */
  idleTimeout: IdleTimeoutConfigType;
  onIdleTimeoutChange: (config: IdleTimeoutConfigType) => void;
  /** WOW-007C: DJ auto-exit duration, in milliseconds. */
  djAutoExitMs: number;
  onDjAutoExitMsChange: (ms: number) => void;
};

/**
 * Settings modal, reached via the visible top-right Settings control (ADR-006
 * amended 2026-07-15). Hosts the play/DJ mode switch (WOW-007B: DJ mode
 * reveals per-pillar sample selection, stop, and the queue display on every
 * pillar card), the global animations kill-switch (human direction
 * 2026-07-17), and three WOW-007C sections — cauldron loudness, pause music
 * (idle-timeout enable + duration), and DJ auto-exit duration — so all of
 * this previously-fixed installation behaviour is DJ-tunable on the fly.
 * Near-opaque overlay per DESIGN_PROPOSAL_001 §3.1 (surface/overlay).
 */
export const SettingsModal = ({
  open,
  onClose,
  mode,
  onModeChange,
  animationsEnabled,
  onAnimationsEnabledChange,
  cauldronVolume,
  onCauldronVolumeChange,
  idleTimeout,
  onIdleTimeoutChange,
  djAutoExitMs,
  onDjAutoExitMsChange,
}: Props): JSX.Element => {
  // Must be referentially stable across renders — useSliderEmit memoizes its
  // throttle on this function (same contract as PillarCardContainer's
  // emitVolumePercent).
  const emitCauldronVolumePercent = useCallback(
    (percent: number) => onCauldronVolumeChange(toRawVolume(percent)),
    [onCauldronVolumeChange],
  );
  const cauldronSlider = useSliderEmit(toPercent(cauldronVolume), emitCauldronVolumePercent);

  // Exact division, not Math.round: a chip only shows pressed when the
  // config exactly matches its value — a non-UI caller can set e.g. 90s via
  // the socket API, and rounding would falsely light the "2 min" chip
  // (Copilot review, PR #56). Non-matching values leave no chip pressed.
  const idleTimeoutMinutes = idleTimeout.timeoutMs / MINUTE_MS;
  const djAutoExitMinutes = djAutoExitMs / MINUTE_MS;

  return (
    <Dialog open={open} onClose={onClose} className='relative z-50'>
      <div className='fixed inset-0 bg-[#0b0910]/95' aria-hidden='true' />
      <div className='fixed inset-0 flex items-center justify-center p-6'>
        <Dialog.Panel className='w-full max-w-md overflow-y-auto rounded-2xl border border-gold-line/40 bg-ink-panel p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]'>
          <Dialog.Title className='font-display text-2xl tracking-[0.14em] text-gold-bright'>
            Settings
          </Dialog.Title>

          <div className='mt-5'>
            <span className='font-data text-[15px] text-parchment/90'>Mode</span>
            <div className='mt-2 flex overflow-hidden rounded-lg border border-gold-line/40'>
              <button
                type='button'
                aria-pressed={mode === 'play'}
                onClick={() => onModeChange('play')}
                className={`min-h-[44px] flex-1 font-data text-sm tracking-wide ${
                  mode === 'play' ? 'bg-gold-line/70 text-ink-deep' : 'bg-ink-btn text-parchment/90'
                }`}
              >
                Play
              </button>
              <button
                type='button'
                aria-pressed={mode === 'dj'}
                onClick={() => onModeChange('dj')}
                className={`min-h-[44px] flex-1 font-data text-sm tracking-wide ${
                  mode === 'dj' ? 'bg-gold-line/70 text-ink-deep' : 'bg-ink-btn text-parchment/90'
                }`}
              >
                DJ
              </button>
            </div>
            <p className='mt-1 font-data text-[15px] text-parchment/60'>
              DJ mode reveals sample selection and queue controls on every pillar.
            </p>
          </div>

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

          {/* WOW-007C: cauldron loudness — plain 0-100 range input, mapped to
              the raw 0..VOLUME_MAX volume the socket contract expects. */}
          <div className='mt-6'>
            <div className='flex items-center justify-between'>
              <span className='font-data text-[15px] text-parchment/90'>Cauldron loudness</span>
              <span className='font-number text-sm tabular-nums text-parchment/70'>
                {cauldronSlider.value}%
              </span>
            </div>
            <input
              type='range'
              min={0}
              max={100}
              value={cauldronSlider.value}
              aria-label='Cauldron loudness'
              onChange={(event) => cauldronSlider.onValue(Number(event.target.value))}
              onPointerDown={cauldronSlider.onDragStart}
              onPointerUp={cauldronSlider.onDragEnd}
              onPointerCancel={cauldronSlider.onDragEnd}
              className='mt-2 h-[44px] w-full accent-gold-bright'
            />
          </div>

          {/* WOW-007C: pause music — idle-timeout enable/disable + duration.
              Disabling means spells loop indefinitely and the Live-set
              attractor ("Wicked Casting") never engages (see
              docs/ABLETON_INTEGRATION.md). */}
          <div className='mt-6'>
            <div className='flex min-h-[44px] items-center justify-between gap-4'>
              <span className='font-data text-[15px] text-parchment/90'>Pause music</span>
              <button
                type='button'
                aria-pressed={idleTimeout.enabled}
                aria-label='Pause music'
                onClick={() =>
                  onIdleTimeoutChange({
                    enabled: !idleTimeout.enabled,
                    timeoutMs: idleTimeout.timeoutMs,
                  })
                }
                className='-my-2 flex min-h-[44px] min-w-[56px] items-center justify-center'
              >
                <span
                  className={`relative block h-7 w-14 rounded-full border transition-colors ${
                    idleTimeout.enabled
                      ? 'border-gold-bright/70 bg-gold-line/70'
                      : 'border-gold-line/30 bg-ink-btn'
                  }`}
                >
                  <span
                    className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-parchment shadow ${
                      idleTimeout.enabled ? 'left-[calc(100%-22px)]' : 'left-1'
                    }`}
                  />
                </span>
              </button>
            </div>
            <p className='mt-1 font-data text-[15px] text-parchment/60'>
              After this long without interaction, all pillars stop and the pause music takes over.
            </p>
            <div
              className={`mt-2 flex flex-wrap gap-2 ${
                idleTimeout.enabled ? '' : 'pointer-events-none opacity-40'
              }`}
            >
              {IDLE_TIMEOUT_MINUTES_CHOICES.map((minutes) => (
                <button
                  key={minutes}
                  type='button'
                  disabled={!idleTimeout.enabled}
                  aria-pressed={idleTimeout.enabled && idleTimeoutMinutes === minutes}
                  // Disambiguated from the DJ auto-exit choices below, which
                  // share the same "N min" visible text for overlapping
                  // values (1/5/10 appear in both lists).
                  aria-label={`Pause music after ${minutes} min`}
                  onClick={() =>
                    onIdleTimeoutChange({
                      enabled: idleTimeout.enabled,
                      timeoutMs: minutes * MINUTE_MS,
                    })
                  }
                  className={`min-h-[44px] min-w-[44px] flex-1 rounded-lg border font-data text-sm tracking-wide ${
                    idleTimeout.enabled && idleTimeoutMinutes === minutes
                      ? 'border-gold-bright/70 bg-gold-line/70 text-ink-deep'
                      : 'border-gold-line/30 bg-ink-btn text-parchment/90'
                  }`}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

          {/* WOW-007C: DJ auto-exit — frontend-only setting (localStorage),
              not part of the socket contract. */}
          <div className='mt-6'>
            <span className='font-data text-[15px] text-parchment/90'>DJ auto-exit</span>
            <p className='mt-1 font-data text-[15px] text-parchment/60'>
              DJ mode returns to play mode after this long without touches.
            </p>
            <div className='mt-2 flex flex-wrap gap-2'>
              {DJ_AUTO_EXIT_MINUTES_CHOICES.map((minutes) => (
                <button
                  key={minutes}
                  type='button'
                  aria-pressed={djAutoExitMinutes === minutes}
                  aria-label={`DJ auto-exit after ${minutes} min`}
                  onClick={() => onDjAutoExitMsChange(minutes * MINUTE_MS)}
                  className={`min-h-[44px] min-w-[44px] flex-1 rounded-lg border font-data text-sm tracking-wide ${
                    djAutoExitMinutes === minutes
                      ? 'border-gold-bright/70 bg-gold-line/70 text-ink-deep'
                      : 'border-gold-line/30 bg-ink-btn text-parchment/90'
                  }`}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

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
};
