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
  ...overrides,
});

const createSocket = (connected = true): Socket =>
  ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected } as unknown as Socket);

// Full catalogue, same filter/sort as the container's module-level `clips` —
// used to pick a real, pickable clip for the pending-pick tests.
const catalogue: SelectableClip[] = Object.entries(ClipDatabaseUtil.rfidToClipMap)
  .map(([rfid, data]) => ({ ...data, rfid }))
  .filter((clip) => Boolean(clip.clipName && clip.type))
  .sort((a, b) => a.clipName.localeCompare(b.clipName));

/**
 * Mirrors `PlayModeContainer`'s lifted `pendingPicks` state locally, so a
 * single `PillarCardContainer` can be exercised end-to-end (pick -> hold ->
 * Play/Remove) exactly the way it's driven in the real tree.
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

  function Wrapper() {
    const [pendingPicks, setPendingPicks] = useState<(SelectableClip | null)[]>([
      null,
      null,
      null,
      null,
    ]);
    const onPendingPickChange = (index: number, clip: SelectableClip | null) => {
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

  return render(<Wrapper />);
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

  describe('pending-pick queue (WOW-007B)', () => {
    it('holds a picked sample locally as a pending row, without emitting', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];
      expect(firstClip).toBeDefined();

      const { getByRole, getByText, queryByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      expect(getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(getByText(firstClip.clipName).closest('button') as HTMLButtonElement);

      expect(socket.emit).not.toHaveBeenCalled();
      expect(queryByRole('dialog')).not.toBeInTheDocument();
      expect(getByRole('button', { name: `Play ${firstClip.clipName}` })).toBeInTheDocument();
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

      const { getByRole, getByText } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByText(firstClip.clipName).closest('button') as HTMLButtonElement);
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

      const { getByRole, getByText } = renderContainer(abletonState, socket, {
        index: 3,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByText(firstClip.clipName).closest('button') as HTMLButtonElement);
      fireEvent.click(getByRole('button', { name: `Play ${firstClip.clipName}` }));

      expect(socket.emit).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith('/new/tag', { rfid: firstClip.rfid, pillar: 3 });
    });

    it('Play clears the pending row after firing (no longer shown)', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, getByText, queryByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByText(firstClip.clipName).closest('button') as HTMLButtonElement);
      fireEvent.click(getByRole('button', { name: `Play ${firstClip.clipName}` }));

      expect(queryByRole('button', { name: `Play ${firstClip.clipName}` })).not.toBeInTheDocument();
    });

    it('Remove on the pending row clears the hold locally without emitting, not confirm-gated', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, getByText, queryByText } = renderContainer(abletonState, socket, {
        index: 1,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByText(firstClip.clipName).closest('button') as HTMLButtonElement);

      // Single tap — no "Confirm remove" step, unlike the backend-queued row.
      fireEvent.click(getByRole('button', { name: `Remove ${firstClip.clipName}` }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(queryByText(firstClip.clipName)).not.toBeInTheDocument();
      expect(getByRole('button', { name: 'Select sample' })).toBeInTheDocument();
    });

    it('picking a new sample replaces the existing pending pick', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const [firstClip, secondClip] = catalogue;
      expect(secondClip).toBeDefined();

      const { getByRole, getByText, queryByText } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByText(firstClip.clipName).closest('button') as HTMLButtonElement);
      expect(getByRole('button', { name: `Play ${firstClip.clipName}` })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByText(secondClip.clipName).closest('button') as HTMLButtonElement);

      expect(queryByText(firstClip.clipName)).not.toBeInTheDocument();
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
  });
});
