import { useCallback, useRef, useState } from 'react';
import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
import { ClipDatabaseUtil } from '~/util/ClipDatabaseUtil';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { useSocketContext } from '~/context/hook/useSocketContext';
import { useSliderEmit } from '~/hook/useSliderEmit';
import { PillarCard } from '~/component/PillarCard';
import { SampleModal, type ActiveByRfid, type SelectableClip } from '~/component/SampleModal';
import { PillarView } from '~/type/PillarView';
import { Logger } from '~/util/Logger';

/** Live volume range from the socket contract (see PillarViewUtil). */
const VOLUME_MAX = 0.7;

/** Unmute fallback when nothing was captured pre-mute (WOW-007B human decision). */
const DEFAULT_UNMUTE_VOLUME = 0.6;

const PILLAR_COUNT = 4;

// Full clip catalogue, sorted by name — the legacy DebugModalContainer's
// picker list, module-level so it's built once. The CSV yields some entries
// without a clipName (the legacy sort tolerated them with optional chaining;
// an unguarded sort crashes the whole bundle at module load) — filter them
// out instead: a nameless clip can't be presented or picked.
const clips: SelectableClip[] = Object.entries(ClipDatabaseUtil.rfidToClipMap)
  .map(([rfid, data]) => ({
    ...data,
    rfid,
    instrument: ClipDatabaseUtil.rfidToInstrumentMap[rfid],
  }))
  .filter((clip) => Boolean(clip.clipName && clip.type))
  .sort((a, b) => a.clipName.localeCompare(b.clipName));

/**
 * Builds the SampleModal's `activeByRfid` map from live clip state (all 4
 * pillars) plus every pillar's local pending pick (WOW-007B pending-pick
 * queue). Precedence within a pillar is playing > stopping > queued >
 * pending, so a genuinely live clip is never masked by a stale pending hold
 * for the same rfid — not expected in practice (a tag can only be one place),
 * but keeps the mapping deterministic if it ever happens.
 */
const buildActiveByRfid = (
  playingClips: BrowserClipInfoList,
  queuedClips: BrowserClipInfoList,
  stoppingClips: BrowserClipInfoList,
  pendingPicks: (SelectableClip | null)[],
): ActiveByRfid => {
  const map: ActiveByRfid = {};

  const record = (
    rfid: string | undefined,
    pillarNumber: number,
    state: 'playing' | 'queued' | 'stopping' | 'pending',
  ): void => {
    if (!rfid) return;
    map[rfid] = { pillarNumber, state };
  };

  for (let i = 0; i < PILLAR_COUNT; i += 1) {
    record(pendingPicks[i]?.rfid, i + 1, 'pending');
    record(queuedClips[i]?.rfid, i + 1, 'queued');
    record(stoppingClips[i]?.rfid, i + 1, 'stopping');
    record(playingClips[i]?.rfid, i + 1, 'playing');
  }

  return map;
};

type Props = {
  index: number;
  pillar: PillarView;
  djMode: boolean;
  animationsEnabled: boolean;
  isConnected: boolean;
  /** Every pillar's held-but-not-started pick (WOW-007B), lifted to
   * `PlayModeContainer` so this pillar's picker can see what's pending
   * everywhere, not just on itself. */
  pendingPicks: (SelectableClip | null)[];
  /** Replaces the pending pick at `index` (or clears it, with `null`). */
  onPendingPickChange: (index: number, clip: SelectableClip | null) => void;
};

/**
 * Wires one `PillarCard` to the live Ableton/socket layer (WOW-007B): volume
 * dragging (both modes — visitor-operable volume is a human decision) and,
 * in DJ mode, stop/mute/select-sample/queue management. Tag placement/removal
 * reuses the exact `/new/tag` + `/departed/tag` events the legacy debug modal
 * used (frozen socket contract — no new events), guarded on `isConnected` the
 * same way (Logger.warn + no-op rather than emitting into a dead socket).
 *
 * Sample picks no longer emit directly (WOW-007B pending-pick queue): the
 * backend starts an idle pillar's clip immediately on `/new/tag`, and even a
 * backend-"queued" clip auto-fires at the next phrase boundary (see
 * sim/core/simulator.ts) — so a mere pick has to be held frontend-side
 * (`pendingPicks`, owned by `PlayModeContainer`) until the DJ explicitly taps
 * Play on the pending queue row. Picking itself happens via the sample
 * modal's per-pillar chips (`togglePillar` below) rather than a row tap —
 * every chip on every row targets its own pillar index directly, so a chip
 * tap from THIS pillar's modal can queue, remove, or move a hold on ANY of
 * the 4 pillars, and the modal stays open for further taps.
 *
 * Mute is the human-authorized volume-0 approach: the socket contract has no
 * mute event, so muting emits `set_track_volume` with `volume: 0` (saving the
 * prior raw volume first) and unmuting restores it (or a 0.6 fallback if
 * nothing was ever captured — e.g. muting before the initial
 * `get_track_volumes` response).
 */
export const PillarCardContainer = ({
  index,
  pillar,
  djMode,
  animationsEnabled,
  isConnected,
  pendingPicks,
  onPendingPickChange,
}: Props): JSX.Element => {
  const socket = useSocketContext();
  const { changeTrackVolume, playingClips, queuedClips, stoppingClips, trackVolume } =
    useAbletonContext();
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  // Raw (0..VOLUME_MAX) volume captured at the moment of muting, so unmute
  // can restore the exact prior level rather than a guessed default.
  const preMuteVolumeRef = useRef<number | null>(null);
  // Read inside emitVolumePercent without adding `muted` to its deps — that
  // callback's identity must stay stable across a single drag (see below).
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Must be referentially stable: useSliderEmit memoizes its throttle on this
  // function, so a fresh identity every render would rebuild the throttle each
  // tick — every drag update would emit immediately (no 100ms coalescing) and
  // superseded throttles' trailing timers could fire stale values afterwards.
  const emitVolumePercent = useCallback(
    (percent: number) => {
      changeTrackVolume({ pillar: index, volume: (percent / 100) * VOLUME_MAX });
      // Dragging/tapping the volume to an audible level while muted IS the
      // unmute (WOW-007B human decision) — the emission above already
      // carries the new volume, so this only clears the local flag; emitting
      // a second time here would be redundant.
      if (mutedRef.current && percent > 0) {
        setMuted(false);
      }
    },
    [changeTrackVolume, index],
  );
  const volumeSlider = useSliderEmit(pillar.volumePercent, emitVolumePercent);

  // Render the drag-local slider value instead of the derived percent so a
  // drag tracks the finger exactly (useSliderEmit's contract) — only for a
  // non-empty pillar; empty pillars stay display-only (no gem/asset to drag)
  // and have nothing to mute either.
  const renderedPillar: PillarView =
    pillar.status !== 'empty' ? { ...pillar, volumePercent: volumeSlider.value, muted } : pillar;

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
  const pendingPick = pendingPicks[index] ?? null;

  const stop = (): void => {
    if (!activeClip) return;
    emitGuarded('stop', '/departed/tag', { rfid: activeClip.rfid, pillar: index });
  };

  const removeQueued = (): void => {
    if (!queuedClip) return;
    emitGuarded('remove queued', '/departed/tag', { rfid: queuedClip.rfid, pillar: index });
  };

  const openSampleModal = (): void => setIsSampleModalOpen(true);

  // Live active/pending state for every catalogue rfid, across all 4
  // pillars — shared by the SampleModal's chips (rendering + click targets)
  // and by togglePillar's own read of "where (if anywhere) is this clip".
  const activeByRfid = buildActiveByRfid(playingClips, queuedClips, stoppingClips, pendingPicks);

  // Toggles the pillar chip at `pillarIndex` (0-based) for `clip` — no emit
  // (see class doc above), and does not close the modal so a DJ can keep
  // assigning clips to other pillars from the same open picker. A
  // backend-active clip never reaches here (its chips are disabled in
  // SampleModal), so only two cases matter: already pending somewhere, or
  // pending nowhere.
  const togglePillar = (pillarIndex: number, clip: SelectableClip): void => {
    const active = activeByRfid[clip.rfid];
    if (active?.state === 'pending') {
      if (active.pillarNumber === pillarIndex + 1) {
        // Tapped the chip it's already pending on — remove the hold.
        onPendingPickChange(pillarIndex, null);
        return;
      }
      // Tapped a different pillar's chip — move the hold: clear the old
      // pillar first, then set the new one, so a single tag is never held
      // pending on two pillars at once.
      onPendingPickChange(active.pillarNumber - 1, null);
      onPendingPickChange(pillarIndex, clip);
      return;
    }
    onPendingPickChange(pillarIndex, clip);
  };

  // Starts the pending pick now. Not confirm-gated: this is the DJ's first
  // explicit "go" for a hold they already chose, not a surprise destructive
  // action. If something is currently playing/stopping on this pillar, it's
  // departed first so the backend doesn't end up with two tags racing for
  // the same pillar — see the ordering caveat in the handoff report.
  const playPending = (): void => {
    if (!pendingPick) return;
    if (activeClip) {
      emitGuarded('play pending (stop active)', '/departed/tag', {
        rfid: activeClip.rfid,
        pillar: index,
      });
    }
    emitGuarded('play pending', '/new/tag', { rfid: pendingPick.rfid, pillar: index });
    onPendingPickChange(index, null);
  };

  // Drops the local hold. No emit (nothing was ever sent to the backend for
  // a pending pick), so not confirm-gated either — reversing a hold that
  // hasn't taken effect anywhere isn't destructive.
  const clearPending = (): void => {
    onPendingPickChange(index, null);
  };

  const toggleMute = (): void => {
    if (!isConnected) {
      Logger.warn('Ignored mute toggle: socket not connected');
      return;
    }
    if (muted) {
      const restoreVolume = preMuteVolumeRef.current ?? DEFAULT_UNMUTE_VOLUME;
      changeTrackVolume({ pillar: index, volume: restoreVolume });
      setMuted(false);
      return;
    }
    preMuteVolumeRef.current = trackVolume[index] ?? null;
    changeTrackVolume({ pillar: index, volume: 0 });
    setMuted(true);
  };

  // Backend-queued clip first (self-starts at the next phrase boundary, so
  // it only gets a remove action), pending pick last (gets both Play and a
  // non-confirm-gated remove) — PillarCard applies the 2-row display cap.
  const queueRows: { id: string; name: string; onPlay?: () => void; onRemove?: () => void }[] = [];
  if (queuedClip) {
    queueRows.push({
      id: queuedClip.rfid ?? queuedClip.clipName,
      name: queuedClip.clipName,
      onRemove: removeQueued,
    });
  }
  if (pendingPick) {
    queueRows.push({
      id: pendingPick.rfid,
      name: pendingPick.clipName,
      onPlay: playPending,
      onRemove: clearPending,
    });
  }

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
                muted,
                onToggleMute: toggleMute,
                queueRows,
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
        onTogglePillar={togglePillar}
        activeByRfid={activeByRfid}
      />
    </>
  );
};
