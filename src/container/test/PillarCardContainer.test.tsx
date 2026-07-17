import { fireEvent, render } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import { BrowserClipInfo } from 'backend/type/BrowserClipInfo';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarCardContainer } from '~/container/PillarCardContainer';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { SocketContext } from '~/context/SocketContext';
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

function renderContainer(
  abletonState: AbletonContextState,
  socket: Socket,
  props: { index: number; djMode: boolean; isConnected: boolean },
) {
  const pillars = PillarViewUtil.derivePillars(
    abletonState.playingClips,
    abletonState.queuedClips,
    abletonState.stoppingClips,
    abletonState.trackVolume,
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <SocketContext.Provider value={socket}>
      <AbletonContext.Provider value={abletonState}>{children}</AbletonContext.Provider>
    </SocketContext.Provider>
  );
  return render(
    <PillarCardContainer
      index={props.index}
      pillar={pillars[props.index]}
      djMode={props.djMode}
      animationsEnabled
      isConnected={props.isConnected}
    />,
    { wrapper },
  );
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

    it('removes a queued clip via /departed/tag {rfid, pillar}, confirm-gated', () => {
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

    it('picks a sample from the modal via /new/tag {rfid, pillar} and closes the modal', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const catalogue = Object.entries(ClipDatabaseUtil.rfidToClipMap)
        .map(([rfid, data]) => ({ ...data, rfid }))
        .filter((clip) => Boolean(clip.clipName && clip.type))
        .sort((a, b) => a.clipName.localeCompare(b.clipName));
      const firstClip = catalogue[0];
      expect(firstClip).toBeDefined();

      const { getByRole, getByText, queryByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      expect(getByRole('dialog')).toBeInTheDocument();

      const clipButton = getByText(firstClip.clipName).closest('button');
      fireEvent.click(clipButton as HTMLButtonElement);

      expect(socket.emit).toHaveBeenCalledWith('/new/tag', { rfid: firstClip.rfid, pillar: 2 });
      expect(queryByRole('dialog')).not.toBeInTheDocument();
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
