import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
import { PillarView } from '~/type/PillarView';

/** Live volume range from the socket contract (see VolumeSliderContainer). */
/**
 * Live volume ceiling from the socket contract (backend
 * PILLAR_VOLUME_CEILING) — exported as the single frontend source so the
 * percent↔raw mappings in PillarCardContainer/SettingsModal can't drift
 * (general review, PR #56).
 */
export const VOLUME_MAX = 0.7;

const PILLAR_COUNT = 4;

const toPercent = (volume: number | undefined): number =>
  Math.round((Math.max(0, Math.min(volume ?? 0, VOLUME_MAX)) / VOLUME_MAX) * 100);

/**
 * Derives the play-mode pillar view-models from the live Ableton context
 * state (WOW-007B). Pure so the mapping is unit-testable without providers.
 *
 * Status precedence per pillar: playing > stopping (rendered as the dimmed
 * 'paused' visual — the clip is audibly winding down) > queued > empty. The
 * card's category comes from the same clip that won the status, so the
 * heading always describes what the status line refers to.
 *
 * `muted` is always false: the socket contract has no mute event (contract
 * frozen — no new events in WOW-007B).
 */
const derivePillars = (
  playingClips: BrowserClipInfoList,
  queuedClips: BrowserClipInfoList,
  stoppingClips: BrowserClipInfoList,
  trackVolume: number[],
): PillarView[] =>
  Array.from({ length: PILLAR_COUNT }, (_, index) => {
    const pillarNumber = index + 1;
    const playing = playingClips[index] ?? null;
    const stopping = stoppingClips[index] ?? null;
    const queued = queuedClips[index] ?? null;

    const active = playing ?? stopping ?? queued;
    // A clip without a category can't drive the categorised card variant
    // (CSV rows always carry `type`; this guards a malformed event mid-show).
    if (!active?.type) {
      return {
        pillarNumber,
        status: 'empty',
        muted: false,
        volumePercent: toPercent(trackVolume[index]),
        queued: [],
      };
    }

    return {
      pillarNumber,
      status: playing ? 'playing' : stopping ? 'paused' : 'queued',
      category: active.type,
      muted: false,
      volumePercent: toPercent(trackVolume[index]),
      queued: queued?.type ? [{ id: queued.rfid ?? queued.clipName, name: queued.clipName }] : [],
    };
  });

export const PillarViewUtil = {
  derivePillars,
};
