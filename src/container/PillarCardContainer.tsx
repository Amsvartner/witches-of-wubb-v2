import { useCallback, useState } from 'react';
import { ClipDatabaseUtil } from '~/util/ClipDatabaseUtil';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { useSocketContext } from '~/context/hook/useSocketContext';
import { useSliderEmit } from '~/hook/useSliderEmit';
import { PillarCard } from '~/component/PillarCard';
import { SampleModal, type SelectableClip } from '~/component/SampleModal';
import { PillarView } from '~/type/PillarView';
import { Logger } from '~/util/Logger';

/** Live volume range from the socket contract (see PillarViewUtil). */
const VOLUME_MAX = 0.7;

// Full clip catalogue, sorted by name — the legacy DebugModalContainer's
// picker list, module-level so it's built once. The CSV yields some entries
// without a clipName (the legacy sort tolerated them with optional chaining;
// an unguarded sort crashes the whole bundle at module load) — filter them
// out instead: a nameless clip can't be presented or picked.
const clips: SelectableClip[] = Object.entries(ClipDatabaseUtil.rfidToClipMap)
  .map(([rfid, data]) => ({ ...data, rfid }))
  .filter((clip) => Boolean(clip.clipName && clip.type))
  .sort((a, b) => a.clipName.localeCompare(b.clipName));

type Props = {
  index: number;
  pillar: PillarView;
  djMode: boolean;
  animationsEnabled: boolean;
  isConnected: boolean;
};

/**
 * Wires one `PillarCard` to the live Ableton/socket layer (WOW-007B): volume
 * dragging (both modes — visitor-operable volume is a human decision) and,
 * in DJ mode, stop/select-sample/remove-queued. Tag placement/removal reuses
 * the exact `/new/tag` + `/departed/tag` events the legacy debug modal used
 * (frozen socket contract — no new events), guarded on `isConnected` the same
 * way (Logger.warn + no-op rather than emitting into a dead socket).
 */
export const PillarCardContainer = ({
  index,
  pillar,
  djMode,
  animationsEnabled,
  isConnected,
}: Props): JSX.Element => {
  const socket = useSocketContext();
  const { changeTrackVolume, playingClips, queuedClips, stoppingClips } = useAbletonContext();
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);

  // Must be referentially stable: useSliderEmit memoizes its throttle on this
  // function, so a fresh identity every render would rebuild the throttle each
  // tick — every drag update would emit immediately (no 100ms coalescing) and
  // superseded throttles' trailing timers could fire stale values afterwards.
  const emitVolumePercent = useCallback(
    (percent: number) => {
      changeTrackVolume({ pillar: index, volume: (percent / 100) * VOLUME_MAX });
    },
    [changeTrackVolume, index],
  );
  const volumeSlider = useSliderEmit(pillar.volumePercent, emitVolumePercent);

  // Render the drag-local slider value instead of the derived percent so a
  // drag tracks the finger exactly (useSliderEmit's contract) — only for a
  // non-empty pillar; empty pillars stay display-only (no gem/asset to drag).
  const renderedPillar: PillarView =
    pillar.status !== 'empty' ? { ...pillar, volumePercent: volumeSlider.value } : pillar;

  const emitGuarded = (
    action: string,
    event: '/new/tag' | '/departed/tag',
    payload: { rfid: string; pillar: number },
  ) => {
    if (!isConnected) {
      Logger.warn(`Ignored ${action}: socket not connected`);
      return;
    }
    socket.emit(event, payload);
  };

  const activeClip = stoppingClips[index] ?? playingClips[index];
  const queuedClip = queuedClips[index];

  const stop = (): void => {
    if (!activeClip) return;
    emitGuarded('stop', '/departed/tag', { rfid: activeClip.rfid, pillar: index });
  };

  const removeQueued = (): void => {
    if (!queuedClip) return;
    emitGuarded('remove queued', '/departed/tag', { rfid: queuedClip.rfid, pillar: index });
  };

  const openSampleModal = (): void => setIsSampleModalOpen(true);

  const pick = (rfid: string): void => {
    emitGuarded('sample pick', '/new/tag', { rfid, pillar: index });
    setIsSampleModalOpen(false);
  };

  return (
    <>
      <PillarCard
        pillar={renderedPillar}
        animationsEnabled={animationsEnabled}
        dj={
          djMode
            ? {
                onStop: activeClip ? stop : undefined,
                onSelectSample: openSampleModal,
                onRemoveQueued: queuedClip ? removeQueued : undefined,
              }
            : undefined
        }
        onVolumePercentChange={volumeSlider.onValue}
        onVolumeDragStart={volumeSlider.onDragStart}
        onVolumeDragEnd={volumeSlider.onDragEnd}
      />
      <SampleModal
        open={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        pillarNumber={index + 1}
        clips={clips}
        onPick={pick}
      />
    </>
  );
};
