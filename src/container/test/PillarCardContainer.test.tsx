import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import { BrowserClipInfo } from 'backend/type/BrowserClipInfo';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarCardContainer } from '~/container/PillarCardContainer';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { SocketContext } from '~/context/SocketContext';
import { type SelectableClip } from '~/component/SampleModal';
import { ClipDatabaseUtil } from '~/util/ClipDatabaseUtil';
import { PillarViewUtil } from '~/util/PillarViewUtil';
import { Logger } from '~/util/Logger';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// (the SampleModal) uses internally (same stub pattern as
// DebugModalContainer.test.tsx / PlayScreen.test.tsx).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const clipFixture = (
  pillar: number,
  clipName: string,
  type: ClipTypes,
  rfid: string,
): BrowserClipInfo => ({
  pillar,
  rfid,
  clipName,
  type,
  assetName: `${type}.png`,
});

const createAbletonState = (overrides: Partial<AbletonContextState> = {}): AbletonContextState => ({
  tempo: 130,
  masterKey: '',
  keylock: false,
  trackVolume: [0, 0, 0, 0],
  playingClips: [null, null, null, null],
  queuedClips: [null, null, null, null],
  stoppingClips: [null, null, null, null],
  clipTempo: [null, null, null, null],
  changeTempo: vi.fn(),
  changeTrackVolume: vi.fn(),
  changeMasterKey: vi.fn(),
  changeKeylock: vi.fn(),
  getTracksAndClips: vi.fn(),
  // WOW-007C
  triggerCauldronSample: vi.fn(),
  cauldronVolume: 0.6,
  changeCauldronVolume: vi.fn(),
  idleTimeout: { enabled: true, timeoutMs: 3 * 60 * 1000 },
  changeIdleTimeout: vi.fn(),
  ...overrides,
});

const createSocket = (connected = true): Socket =>
  ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected } as unknown as Socket);

// Full catalogue, same filter/sort/instrument-join as the container's
// module-level `clips` — used to pick a real, pickable clip for the
// pending-pick tests. Must match exactly (including `instrument`): these
// objects are asserted for reference equality against what the container
// actually passes to onPendingPickChange.
const catalogue: SelectableClip[] = Object.entries(ClipDatabaseUtil.rfidToClipMap)
  .map(([rfid, data]) => ({
    ...data,
    rfid,
    instrument: ClipDatabaseUtil.rfidToInstrumentMap[rfid],
  }))
  .filter((clip) => Boolean(clip.clipName && clip.type))
  .sort((a, b) => a.clipName.localeCompare(b.clipName));

/**
 * Mirrors `PlayModeContainer`'s lifted `pendingPicks` state locally, so a
 * single `PillarCardContainer` can be exercised end-to-end (pick -> hold ->
 * Play/Remove) exactly the way it's driven in the real tree. Every call to
 * `onPendingPickChange` also goes through `onPendingPickChangeSpy`, so tests
 * can assert the exact calls/order `togglePillar` makes (queue/remove/move)
 * without losing the real state-driven UI updates (Play/Remove rows,
 * SampleModal chip states) that come from actually applying them.
 */
function renderContainer(
  abletonState: AbletonContextState,
  socket: Socket,
  containerProps: { index: number; djMode: boolean; isConnected: boolean },
) {
  const pillars = PillarViewUtil.derivePillars(
    abletonState.playingClips,
    abletonState.queuedClips,
    abletonState.stoppingClips,
    abletonState.trackVolume,
  );
  const onPendingPickChangeSpy = vi.fn();

  function Wrapper() {
    const [pendingPicks, setPendingPicks] = useState<(SelectableClip | null)[]>([
      null,
      null,
      null,
      null,
    ]);
    const onPendingPickChange = (index: number, clip: SelectableClip | null) => {
      onPendingPickChangeSpy(index, clip);
      setPendingPicks((current) => current.map((existing, i) => (i === index ? clip : existing)));
    };

    return (
      <SocketContext.Provider value={socket}>
        <AbletonContext.Provider value={abletonState}>
          <PillarCardContainer
            index={containerProps.index}
            pillar={pillars[containerProps.index]}
            djMode={containerProps.djMode}
            animationsEnabled
            isConnected={containerProps.isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={onPendingPickChange}
          />
        </AbletonContext.Provider>
      </SocketContext.Provider>
    );
  }

  const utils = render(<Wrapper />);
  return { ...utils, onPendingPickChangeSpy };
}

describe('PillarCardContainer', () => {
  describe('DJ tag emits', () => {
    it('stops the active clip via /departed/tag {rfid, pillar}, confirm-gated', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-stop'),
          null,
          null,
          null,
        ],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Stop' }));
      expect(socket.emit).not.toHaveBeenCalled();
      fireEvent.click(getByRole('button', { name: 'Confirm stop' }));

      expect(socket.emit).toHaveBeenCalledWith('/departed/tag', { rfid: 'rfid-stop', pillar: 0 });
    });

    it('removes a backend-queued clip via /departed/tag {rfid, pillar}, confirm-gated', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        queuedClips: [
          null,
          clipFixture(1, 'Melody Loop', ClipTypes.Melody, 'rfid-queued'),
          null,
          null,
        ],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 1,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Remove Melody Loop' }));
      expect(socket.emit).not.toHaveBeenCalled();
      fireEvent.click(getByRole('button', { name: 'Confirm remove Melody Loop' }));

      expect(socket.emit).toHaveBeenCalledWith('/departed/tag', { rfid: 'rfid-queued', pillar: 1 });
    });

    it('does not emit and warns via Logger when disconnected', () => {
      const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-stop'),
          null,
          null,
          null,
        ],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: false,
      });

      fireEvent.click(getByRole('button', { name: 'Stop' }));
      fireEvent.click(getByRole('button', { name: 'Confirm stop' }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Ignored stop'));

      warnSpy.mockRestore();
    });
  });

  describe('pending-pick queue (WOW-007B chip queueing)', () => {
    // Chip aria-labels are 1-based on the tapped pillar; the container's own
    // `index` prop is 0-based. index 2 -> pillar 3, etc.
    const queueChipLabel = (clipName: string, pillarNumber: number) =>
      `Queue ${clipName} on pillar ${pillarNumber}`;
    const removeChipLabel = (clipName: string, pillarNumber: number) =>
      `Remove ${clipName} from pillar ${pillarNumber} queue`;

    it('tapping this pillar’s own chip holds the sample locally as a pending row, without emitting, and keeps the modal open', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];
      expect(firstClip).toBeDefined();

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      expect(getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 3) }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(getByRole('dialog')).toBeInTheDocument();
      // The pending row lives on the PillarCard, behind the still-open modal
      // — Headless UI marks background content aria-hidden while a Dialog is
      // open, so this needs `hidden: true` to look past that and confirm the
      // row is really there (not just present-but-inert).
      expect(
        getByRole('button', { name: `Play ${firstClip.clipName}`, hidden: true }),
      ).toBeInTheDocument();
    });

    it('Play emits /departed/tag for the active clip first, then /new/tag for the pick, in order', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          null,
          null,
          clipFixture(2, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-active'),
          null,
        ],
      });
      const firstClip = catalogue[0];
      expect(firstClip).toBeDefined();

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 3) }));
      fireEvent.click(getByRole('button', { name: /close/i }));
      fireEvent.click(getByRole('button', { name: `Play ${firstClip.clipName}` }));

      expect(socket.emit).toHaveBeenNthCalledWith(1, '/departed/tag', {
        rfid: 'rfid-active',
        pillar: 2,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(2, '/new/tag', {
        rfid: firstClip.rfid,
        pillar: 2,
      });
      expect(socket.emit).toHaveBeenCalledTimes(2);
    });

    it('Play emits only /new/tag when nothing is active on the pillar', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];
      expect(firstClip).toBeDefined();

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 3,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 4) }));
      fireEvent.click(getByRole('button', { name: /close/i }));
      fireEvent.click(getByRole('button', { name: `Play ${firstClip.clipName}` }));

      expect(socket.emit).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith('/new/tag', { rfid: firstClip.rfid, pillar: 3 });
    });

    it('Play clears the pending row after firing (no longer shown)', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, queryByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: /close/i }));
      fireEvent.click(getByRole('button', { name: `Play ${firstClip.clipName}` }));

      expect(queryByRole('button', { name: `Play ${firstClip.clipName}` })).not.toBeInTheDocument();
    });

    it('tapping the same pillar’s chip again (now filled/pressed) removes the hold locally without emitting', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, queryByRole, onPendingPickChangeSpy } = renderContainer(
        abletonState,
        socket,
        { index: 1, djMode: true, isConnected: true },
      );

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 2) }));

      const pendingChip = getByRole('button', { name: removeChipLabel(firstClip.clipName, 2) });
      expect(pendingChip).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(pendingChip);

      expect(socket.emit).not.toHaveBeenCalled();
      // Identity-match by rfid/name: the container's catalogue entry also
      // carries the frontend-joined `instrument`, which this test's local
      // rebuild deliberately doesn't replicate.
      expect(onPendingPickChangeSpy).toHaveBeenNthCalledWith(
        1,
        1,
        expect.objectContaining({ rfid: firstClip.rfid, clipName: firstClip.clipName }),
      );
      expect(onPendingPickChangeSpy).toHaveBeenNthCalledWith(2, 1, null);
      fireEvent.click(getByRole('button', { name: /close/i }));
      expect(queryByRole('button', { name: `Play ${firstClip.clipName}` })).not.toBeInTheDocument();
    });

    it('tapping a DIFFERENT pillar’s chip moves the hold: clears the old pillar, then sets the new one, in order', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, queryByRole, onPendingPickChangeSpy } = renderContainer(
        abletonState,
        socket,
        { index: 0, djMode: true, isConnected: true },
      );

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      // Queue on pillar 1 (this pillar, index 0). The pending row it creates
      // is behind the still-open modal, so `hidden: true` looks past Headless
      // UI's aria-hidden on background content while the Dialog is open.
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }));
      expect(
        getByRole('button', { name: `Play ${firstClip.clipName}`, hidden: true }),
      ).toBeInTheDocument();

      // Tap pillar 2's chip on the same still-open row — a move, not a queue.
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 2) }));

      expect(onPendingPickChangeSpy).toHaveBeenCalledTimes(3);
      expect(onPendingPickChangeSpy).toHaveBeenNthCalledWith(1, 0, firstClip); // queue on pillar 1
      expect(onPendingPickChangeSpy).toHaveBeenNthCalledWith(2, 0, null); // clear pillar 1
      expect(onPendingPickChangeSpy).toHaveBeenNthCalledWith(3, 1, firstClip); // set pillar 2
      // This pillar (index 0) no longer shows the pending row — it moved away.
      expect(
        queryByRole('button', { name: `Play ${firstClip.clipName}`, hidden: true }),
      ).not.toBeInTheDocument();
    });

    it('picking a different sample on the same pillar replaces the existing pending pick', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const [firstClip, secondClip] = catalogue;
      expect(secondClip).toBeDefined();

      const { getByRole, queryByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }));
      // Behind the still-open modal — see the `hidden: true` note above.
      expect(
        getByRole('button', { name: `Play ${firstClip.clipName}`, hidden: true }),
      ).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: queueChipLabel(secondClip.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: /close/i }));

      expect(queryByRole('button', { name: `Play ${firstClip.clipName}` })).not.toBeInTheDocument();
      expect(getByRole('button', { name: `Play ${secondClip.clipName}` })).toBeInTheDocument();
    });
  });

  describe('mute (WOW-007B human-authorized volume-0 approach)', () => {
    it('mutes to volume 0, then restores the captured raw volume on unmute', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-mute'),
          null,
          null,
          null,
        ],
        trackVolume: [0.42, 0, 0, 0],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Mute' }));
      expect(abletonState.changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 0, volume: 0 });
      expect(getByRole('button', { name: 'Unmute' })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Unmute' }));
      expect(abletonState.changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 0, volume: 0.42 });
      expect(getByRole('button', { name: 'Mute' })).toBeInTheDocument();
    });

    it('shows the MUTED status label while muted', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-mute'),
          null,
          null,
          null,
        ],
      });

      const { getByRole, getByText } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Mute' }));
      expect(getByText('MUTED')).toBeInTheDocument();
    });

    it('falls back to 0.6 on unmute when no raw volume was ever captured for this pillar', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-mute'),
          null,
          null,
          null,
        ],
        // No entry for pillar 0 — trackVolume[0] is undefined.
        trackVolume: [],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Mute' }));
      fireEvent.click(getByRole('button', { name: 'Unmute' }));

      expect(abletonState.changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 0, volume: 0.6 });
    });

    it('does not emit and warns via Logger when muting while disconnected', () => {
      const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-mute'),
          null,
          null,
          null,
        ],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: false,
      });

      fireEvent.click(getByRole('button', { name: 'Mute' }));

      expect(abletonState.changeTrackVolume).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Ignored mute toggle'));
      warnSpy.mockRestore();
    });

    it('clears mute when the volume is dragged/nudged to an audible level, with no separate unmute emit', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-mute'),
          null,
          null,
          null,
        ],
        trackVolume: [0.42, 0, 0, 0],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Mute' }));
      expect(getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
      const callsBeforeNudge = (abletonState.changeTrackVolume as ReturnType<typeof vi.fn>).mock
        .calls.length;

      const slider = getByRole('slider', { name: 'Volume' });
      fireEvent.keyDown(slider, { key: 'ArrowUp' });

      // The nudge is itself the unmute — exactly one further volume
      // emission, not two (no extra "restore" call riding along with it).
      const callsAfterNudge = (abletonState.changeTrackVolume as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(callsAfterNudge.length - callsBeforeNudge).toBe(1);
      expect(callsAfterNudge.at(-1)).toEqual([{ pillar: 0, volume: expect.any(Number) }]);
      expect(getByRole('button', { name: 'Mute' })).toBeInTheDocument();
    });
  });

  describe('volume interaction', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('nudges the volume via the tube slider ArrowUp and calls changeTrackVolume with (percent/100)*0.7', () => {
      const socket = createSocket(true);
      // trackVolume 0.42 of a 0.7 max -> 60%.
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-vol'),
          null,
          null,
          null,
        ],
        trackVolume: [0.42, 0, 0, 0],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: false,
        isConnected: true,
      });

      const slider = getByRole('slider', { name: 'Volume' });
      expect(slider).toHaveAttribute('aria-valuenow', '60');

      fireEvent.keyDown(slider, { key: 'ArrowUp' });

      // 60% + KEY_STEP(5) = 65% -> (65/100) * 0.7 (computed, not hardcoded,
      // to sidestep float-precision mismatches like 0.45499999999999996).
      const expectedVolume = (65 / 100) * 0.7;
      expect(abletonState.changeTrackVolume).toHaveBeenCalledWith({
        pillar: 0,
        volume: expectedVolume,
      });
    });

    // WOW-007C: an empty pillar's volume is only interactive in DJ mode (DJing
    // ahead - pre-setting a level before anything's placed there); a play-mode
    // visitor still can't touch an empty pillar's volume.
    describe('empty pillar (WOW-007C)', () => {
      it('renders no volume slider for an empty pillar in play mode', () => {
        const socket = createSocket(true);
        const abletonState = createAbletonState({
          playingClips: [null, null, null, null],
          trackVolume: [0.3, 0, 0, 0],
        });

        const { queryByRole } = renderContainer(abletonState, socket, {
          index: 0,
          djMode: false,
          isConnected: true,
        });

        expect(queryByRole('slider')).not.toBeInTheDocument();
      });

      it('renders an interactive volume slider for an empty pillar in DJ mode', () => {
        const socket = createSocket(true);
        // trackVolume 0.35 of a 0.7 max -> 50%.
        const abletonState = createAbletonState({
          playingClips: [null, null, null, null],
          trackVolume: [0.35, 0, 0, 0],
        });

        const { getByRole } = renderContainer(abletonState, socket, {
          index: 0,
          djMode: true,
          isConnected: true,
        });

        const slider = getByRole('slider', { name: 'Volume' });
        expect(slider).toHaveAttribute('aria-valuenow', '50');
      });

      it('calls changeTrackVolume when an empty pillar’s slider is nudged in DJ mode', () => {
        const socket = createSocket(true);
        const abletonState = createAbletonState({
          playingClips: [null, null, null, null],
          trackVolume: [0.35, 0, 0, 0],
        });

        const { getByRole } = renderContainer(abletonState, socket, {
          index: 0,
          djMode: true,
          isConnected: true,
        });

        fireEvent.keyDown(getByRole('slider', { name: 'Volume' }), { key: 'ArrowUp' });

        // 50% + KEY_STEP(5) = 55% -> (55/100) * 0.7.
        const expectedVolume = (55 / 100) * 0.7;
        expect(abletonState.changeTrackVolume).toHaveBeenCalledWith({
          pillar: 0,
          volume: expectedVolume,
        });
      });

      it('a non-empty pillar keeps its interactive slider in both modes (unaffected by the empty-pillar gating)', () => {
        const socket = createSocket(true);
        const abletonState = createAbletonState({
          playingClips: [
            clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-vol'),
            null,
            null,
            null,
          ],
          trackVolume: [0.42, 0, 0, 0],
        });

        const { getByRole } = renderContainer(abletonState, socket, {
          index: 0,
          djMode: false,
          isConnected: true,
        });

        expect(getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
      });
    });
  });
});
