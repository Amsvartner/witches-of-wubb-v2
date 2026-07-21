import { useCallback, useRef, useState } from 'react';
import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
import { ClipDatabaseUtil } from '~/util/ClipDatabaseUtil';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { useSocketContext } from '~/context/hook/useSocketContext';
import { useSliderEmit } from '~/hook/useSliderEmit';
import { PillarCard } from '~/component/PillarCard';
import {
  SampleModal,
  type ActiveByRfid,
  type PillarDraft,
  type SelectableClip,
} from '~/component/SampleModal';
import { PillarView } from '~/type/PillarView';
import { PillarDraftUtil } from '~/util/PillarDraftUtil';
import { Logger } from '~/util/Logger';

import { VOLUME_MAX } from '~/util/PillarViewUtil';

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
 * pillars) plus every pillar's local pending picks (WOW-007C: now up to 2 per
 * pillar). Under the draft/apply model this only drives the Pillar column's
 * sort/state hints — chip rendering comes from the draft. Precedence within a
 * pillar is playing > stopping > queued > pending, so a genuinely live clip
 * is never masked by a stale pending hold for the same rfid — not expected in
 * practice (a tag can only be one place), but keeps the mapping deterministic
 * if it ever happens.
 */
const buildActiveByRfid = (
  playingClips: BrowserClipInfoList,
  queuedClips: BrowserClipInfoList,
  stoppingClips: BrowserClipInfoList,
  pendingPicks: SelectableClip[][],
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
    for (const pick of pendingPicks[i] ?? []) {
      record(pick.rfid, i + 1, 'pending');
    }
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
  /** Every pillar's held-but-not-started picks (WOW-007C: up to 2 per
   * pillar), lifted to `PlayModeContainer` so this pillar's picker can see
   * what's pending everywhere, not just on itself. */
  pendingPicks: SelectableClip[][];
  /** Replaces pillar `index`'s whole pending-picks array. */
  onPendingPickChange: (index: number, picks: SelectableClip[]) => void;
  /**
   * True while the Help overlay is open (human spec 2026-07-20). Overrides
   * the play-mode volume-tube hiding below — a visitor reading Help must
   * still see every tube it points at, even on an otherwise-hidden empty/
   * queued pillar. Defaults false so existing call sites/tests are
   * unaffected.
   */
  helpActive?: boolean;
};

/**
 * Wires one `PillarCard` to the live Ableton/socket layer (WOW-007B): volume
 * dragging (both modes — visitor-operable volume is a human decision) and,
 * in DJ mode, stop/mute/select-sample/queue management. Tag placement/removal
 * reuses the exact `/new/tag` + `/departed/tag` events the legacy debug modal
 * used (frozen socket contract — no new events), guarded on `isConnected` the
 * same way (Logger.warn + no-op rather than emitting into a dead socket).
 *
 * Sample picking is a DRAFT + APPLY flow (WOW-007C, replacing WOW-007B's
 * instant chip toggling): chip taps in the sample modal only edit a local
 * draft (`draftEdits`, all 4 pillars at once — `PillarDraftUtil.tapChip`),
 * and NOTHING reaches the socket until the DJ taps Apply, which diffs the
 * draft against live reality (`PillarDraftUtil.diffForApply`) and emits all
 * `/departed/tag`s before all `/new/tag`s. Draft 'queued' entries that the
 * backend isn't already holding become frontend pending picks (`pendingPicks`,
 * owned by `PlayModeContainer`) — the backend starts an idle pillar's clip
 * immediately on `/new/tag` and even a backend-"queued" clip auto-fires at
 * the next phrase boundary (see sim/core/simulator.ts), so a mere hold can't
 * reach the socket at all. While `draftEdits` is null the rendered draft IS
 * the live baseline (recomputed every render), so Apply/Revert both "rebase"
 * by simply clearing the edits; reality changing under an open modal updates
 * the baseline for the dirty diff without clobbering the DJ's edits.
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
  helpActive = false,
}: Props): JSX.Element => {
  const socket = useSocketContext();
  const { changeTrackVolume, playingClips, queuedClips, stoppingClips, trackVolume } =
    useAbletonContext();
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  // The DJ's draft edits (WOW-007C), or null while no edit has been made
  // since the modal opened / the last Apply / the last Revert — null means
  // "track the live baseline", which is what makes Apply/Revert rebasing and
  // live reality changes free (see the class doc above).
  const [draftEdits, setDraftEdits] = useState<PillarDraft[] | null>(null);
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

  // WOW-007C: an empty pillar's volume is only interactive in DJ mode (DJing
  // ahead — pre-setting a pillar's level before anything's placed there); a
  // play-mode visitor still can't touch an empty pillar's volume (nothing to
  // mute either — the empty medallion isn't even DJ's Add-sample button
  // outside DJ mode). A non-empty pillar stays interactive in both modes, as
  // before.
  const showVolumeControls = pillar.status !== 'empty' || djMode;

  // WOW-007D: in play mode, a pillar with nothing audible (status 'empty' or
  // 'queued' — a queued clip hasn't started sounding yet) has no meaningful
  // volume to show, so its tube is hidden entirely and the card centers its
  // remaining content instead. DJ mode always shows tubes (DJing ahead —
  // pre-setting levels), and an open Help overlay forces them visible too,
  // since Help points at a tube that must actually be there to point at.
  const hideVolume =
    !djMode && !helpActive && pillar.status !== 'playing' && pillar.status !== 'paused';

  // Render the drag-local slider value instead of the derived percent so a
  // drag tracks the finger exactly (useSliderEmit's contract) — only while
  // volume is actually interactive; otherwise render the plain derived view.
  const renderedPillar: PillarView = showVolumeControls
    ? { ...pillar, volumePercent: volumeSlider.value, muted }
    : pillar;

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
  const myPendingPicks = pendingPicks[index] ?? [];

  const stop = (): void => {
    if (!activeClip) return;
    emitGuarded('stop', '/departed/tag', { rfid: activeClip.rfid, pillar: index });
  };

  const removeQueued = (): void => {
    if (!queuedClip) return;
    emitGuarded('remove queued', '/departed/tag', { rfid: queuedClip.rfid, pillar: index });
  };

  const openSampleModal = (): void => {
    // A fresh open always starts from reality (spec: draft := baseline copy
    // on open) — clearing here rather than on close keeps a mid-session
    // close+reopen honest even if a stale edit somehow survived.
    setDraftEdits(null);
    setIsSampleModalOpen(true);
  };

  // Live active/pending state for every catalogue rfid, across all 4
  // pillars — Pillar column sort/state hints only (chips read the draft).
  const activeByRfid = buildActiveByRfid(playingClips, queuedClips, stoppingClips, pendingPicks);

  // What reality looks like right now, as a draft — recomputed every render
  // so the dirty diff always compares against CURRENT reality (scenario or
  // visitor tags can change it while the modal is open).
  const baseline = PillarDraftUtil.buildBaseline({
    playingClips,
    stoppingClips,
    queuedClips,
    pendingPicks,
    catalogue: clips,
  });
  const renderedDraft = draftEdits ?? baseline;
  const isDraftDirty = !PillarDraftUtil.draftsEqual(renderedDraft, baseline);
  const liveRfids = PillarDraftUtil.toLiveRfids(playingClips, stoppingClips);

  // Advances the tapped chip's draft cycle (outlined -> queued -> play ->
  // removed, with the live-clip exception) — local edit only, no emission,
  // and the modal stays open so a DJ can keep assigning clips to other
  // pillars from the same open picker.
  const handleTapChip = (pillarIndex: number, clip: SelectableClip): void => {
    const nextDraft = PillarDraftUtil.tapChip({
      draft: renderedDraft,
      pillarIndex,
      clip,
      liveRfids,
    });
    setDraftEdits(nextDraft);
  };

  // Sends the draft's diff against current reality to the backend (WOW-007C):
  // all /departed/tag emissions first, then all /new/tag — see
  // PillarDraftUtil.diffForApply for the full ordering contract. Guarded as a
  // whole on isConnected (partial application against a dead socket would
  // desync pendingPicks from what the backend actually saw). The modal stays
  // open; clearing draftEdits rebases the draft onto reality, so Apply
  // disables until the next edit.
  const handleApply = (): void => {
    if (!isConnected) {
      Logger.warn('Ignored apply: socket not connected');
      return;
    }
    const { emissions, nextPendingPicks } = PillarDraftUtil.diffForApply({
      draft: renderedDraft,
      playingClips,
      stoppingClips,
      queuedClips,
    });
    for (const emission of emissions) {
      emitGuarded('apply draft', emission.event, { rfid: emission.rfid, pillar: emission.pillar });
    }
    for (let i = 0; i < PILLAR_COUNT; i += 1) {
      onPendingPickChange(i, nextPendingPicks[i]);
    }
    setDraftEdits(null);
  };

  // Discards the edits — the rendered draft falls back to the live baseline.
  const handleRevert = (): void => {
    setDraftEdits(null);
  };

  // Starts the pending pick at `pickIndex` now. Not confirm-gated: this is
  // the DJ's first explicit "go" for a hold they already chose, not a
  // surprise destructive action. If something is currently playing/stopping
  // on this pillar, it's departed first so the backend doesn't end up with
  // two tags racing for the same pillar.
  const playPending = (pickIndex: number): void => {
    const pick = myPendingPicks[pickIndex];
    if (!pick) return;
    if (activeClip) {
      emitGuarded('play pending (stop active)', '/departed/tag', {
        rfid: activeClip.rfid,
        pillar: index,
      });
    }
    emitGuarded('play pending', '/new/tag', { rfid: pick.rfid, pillar: index });
    const remainingPicks = myPendingPicks.filter((_, i) => i !== pickIndex);
    onPendingPickChange(index, remainingPicks);
  };

  // Drops one local hold. No emit (nothing was ever sent to the backend for
  // a pending pick), so not confirm-gated either — reversing a hold that
  // hasn't taken effect anywhere isn't destructive.
  const clearPending = (pickIndex: number): void => {
    const remainingPicks = myPendingPicks.filter((_, i) => i !== pickIndex);
    onPendingPickChange(index, remainingPicks);
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
  // it only gets a remove action), then up to 2 pending picks (each with
  // both Play and a non-confirm-gated remove) — PillarCard applies the
  // 2-row display cap.
  const queueRows: { id: string; name: string; onPlay?: () => void; onRemove?: () => void }[] = [];
  if (queuedClip) {
    queueRows.push({
      id: queuedClip.rfid ?? queuedClip.clipName,
      name: queuedClip.clipName,
      onRemove: removeQueued,
    });
  }
  for (const [pickIndex, pick] of myPendingPicks.entries()) {
    queueRows.push({
      id: pick.rfid,
      name: pick.clipName,
      onPlay: () => playPending(pickIndex),
      onRemove: () => clearPending(pickIndex),
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
        onVolumePercentChange={showVolumeControls ? volumeSlider.onValue : undefined}
        onVolumeDragStart={showVolumeControls ? volumeSlider.onDragStart : undefined}
        onVolumeDragEnd={showVolumeControls ? volumeSlider.onDragEnd : undefined}
        hideVolume={hideVolume}
      />
      <SampleModal
        open={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        clips={clips}
        draft={renderedDraft}
        onTapChip={handleTapChip}
        activeByRfid={activeByRfid}
        dirty={isDraftDirty}
        onApply={handleApply}
        onRevert={handleRevert}
      />
    </>
  );
};
