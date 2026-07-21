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
  setDjMode: vi.fn(),
  ...overrides,
});

const createSocket = (connected = true): Socket =>
  ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected } as unknown as Socket);

// Full catalogue, same filter/sort/instrument-join as the container's
// module-level `clips` — used to pick real, pickable clips for the draft
// tests. Must match exactly (including `instrument`): these objects are
// asserted for deep equality against what the container actually passes to
// onPendingPickChange.
const catalogue: SelectableClip[] = Object.entries(ClipDatabaseUtil.rfidToClipMap)
  .map(([rfid, data]) => ({
    ...data,
    rfid,
    instrument: ClipDatabaseUtil.rfidToInstrumentMap[rfid],
  }))
  .filter((clip) => Boolean(clip.clipName && clip.type))
  .sort((a, b) => a.clipName.localeCompare(b.clipName));

/** A live-clip fixture that reuses a real catalogue clip's identity, so the
 * modal renders a row (and chips) for the currently-playing clip. */
const liveFixture = (pillar: number, clip: SelectableClip): BrowserClipInfo =>
  clipFixture(pillar, clip.clipName, clip.type, clip.rfid);

/**
 * Mirrors `PlayModeContainer`'s lifted `pendingPicks` state locally, so a
 * single `PillarCardContainer` can be exercised end-to-end (draft -> Apply ->
 * pending rows -> Play/Remove) exactly the way it's driven in the real tree.
 * Every call to `onPendingPickChange` also goes through
 * `onPendingPickChangeSpy`, so tests can assert the exact per-pillar arrays
 * Apply produces without losing the real state-driven UI updates (pending
 * rows, chip states) that come from actually applying them.
 */
function renderContainer(
  abletonState: AbletonContextState,
  socket: Socket,
  containerProps: { index: number; djMode: boolean; isConnected: boolean; helpActive?: boolean },
) {
  const pillars = PillarViewUtil.derivePillars(
    abletonState.playingClips,
    abletonState.queuedClips,
    abletonState.stoppingClips,
    abletonState.trackVolume,
  );
  const onPendingPickChangeSpy = vi.fn();

  function Wrapper() {
    const [pendingPicks, setPendingPicks] = useState<SelectableClip[][]>([[], [], [], []]);
    const onPendingPickChange = (index: number, picks: SelectableClip[]) => {
      onPendingPickChangeSpy(index, picks);
      setPendingPicks((current) => current.map((existing, i) => (i === index ? picks : existing)));
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
            helpActive={containerProps.helpActive}
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

    // WOW-007C item 3 (human spec): every queue row gets Play, including the
    // backend-queued one — forcing an immediate start instead of waiting for
    // the next phrase boundary.
    it('plays a backend-queued clip: departs the active clip, dequeues, then re-places it, in that order', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-active'),
          null,
          null,
          null,
        ],
        queuedClips: [
          clipFixture(0, 'Melody Loop', ClipTypes.Melody, 'rfid-queued'),
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

      fireEvent.click(getByRole('button', { name: 'Play Melody Loop' }));

      expect(socket.emit).toHaveBeenNthCalledWith(1, '/departed/tag', {
        rfid: 'rfid-active',
        pillar: 0,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(2, '/departed/tag', {
        rfid: 'rfid-queued',
        pillar: 0,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(3, '/new/tag', {
        rfid: 'rfid-queued',
        pillar: 0,
      });
      expect(socket.emit).toHaveBeenCalledTimes(3);
    });

    it('plays a backend-queued clip with nothing active: dequeues then re-places it, no departed for an active clip', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        queuedClips: [
          clipFixture(1, 'Bass Drop', ClipTypes.Bass, 'rfid-queued-idle'),
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

      fireEvent.click(getByRole('button', { name: 'Play Bass Drop' }));

      expect(socket.emit).toHaveBeenNthCalledWith(1, '/departed/tag', {
        rfid: 'rfid-queued-idle',
        pillar: 0,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(2, '/new/tag', {
        rfid: 'rfid-queued-idle',
        pillar: 0,
      });
      expect(socket.emit).toHaveBeenCalledTimes(2);
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

  describe('draft + apply (WOW-007C, replaces instant chip toggling)', () => {
    // Chip aria-labels are 1-based on the tapped pillar; the container's own
    // `index` prop is 0-based. index 2 -> pillar 3, etc.
    const queueChipLabel = (clipName: string, pillarNumber: number) =>
      `Queue ${clipName} on pillar ${pillarNumber}`;
    const promoteChipLabel = (clipName: string, pillarNumber: number) =>
      `Set ${clipName} to play on pillar ${pillarNumber}`;
    const removeChipLabel = (clipName: string, pillarNumber: number) =>
      `Remove ${clipName} from pillar ${pillarNumber}`;

    it('a chip tap only edits the draft: gold chip, no emission, no pending row, modal stays open, Apply arms', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];
      expect(firstClip).toBeDefined();

      const { getByRole, queryByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      expect(getByRole('dialog')).toBeInTheDocument();
      expect(getByRole('button', { name: 'Apply changes' })).toBeDisabled();

      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 3) }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(getByRole('dialog')).toBeInTheDocument();
      expect(
        getByRole('button', { name: promoteChipLabel(firstClip.clipName, 3) }),
      ).toBeInTheDocument();
      // No pending row yet — nothing is held until Apply. (`hidden: true`
      // looks past Headless UI's aria-hidden on background content while the
      // Dialog is open.)
      expect(
        queryByRole('button', { name: `Play ${firstClip.clipName}`, hidden: true }),
      ).not.toBeInTheDocument();
      expect(getByRole('button', { name: 'Apply changes' })).toBeEnabled();
    });

    it('closes the modal and drops the draft when DJ mode ends (walk-away auto-exit path)', () => {
      // The auto-exit timer flips PlayModeContainer's mode without touching
      // this container directly — the djMode prop going false is the only
      // signal. Without the effect under test, the selector survived the
      // switch fully operable on the visitor-facing play screen (observed
      // live 2026-07-21).
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const pillars = PillarViewUtil.derivePillars(
        abletonState.playingClips,
        abletonState.queuedClips,
        abletonState.stoppingClips,
        abletonState.trackVolume,
      );

      const containerAt = (djMode: boolean) => (
        <SocketContext.Provider value={socket}>
          <AbletonContext.Provider value={abletonState}>
            <PillarCardContainer
              index={2}
              pillar={pillars[2]}
              djMode={djMode}
              animationsEnabled
              isConnected
              pendingPicks={[[], [], [], []]}
              onPendingPickChange={vi.fn()}
            />
          </AbletonContext.Provider>
        </SocketContext.Provider>
      );

      const { getByRole, queryByRole, rerender } = render(containerAt(true));
      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      expect(getByRole('dialog')).toBeInTheDocument();

      rerender(containerAt(false));

      expect(queryByRole('dialog')).not.toBeInTheDocument();
      expect(socket.emit).not.toHaveBeenCalled();
    });

    it('Apply turns a gold (queued) draft entry into a pending row without emitting, keeps the modal open, and disarms', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, onPendingPickChangeSpy } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 3) }));
      fireEvent.click(getByRole('button', { name: 'Apply changes' }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(onPendingPickChangeSpy).toHaveBeenCalledWith(2, [firstClip]);
      // The pending row lives on the PillarCard, behind the still-open modal.
      expect(
        getByRole('button', { name: `Play ${firstClip.clipName}`, hidden: true }),
      ).toBeInTheDocument();
      expect(getByRole('dialog')).toBeInTheDocument();
      // Rebased: the draft now matches reality again, so Apply disarms.
      expect(getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    });

    it('two taps make a green (play) entry; Apply emits only /new/tag on an idle pillar', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 3,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 4) }));
      fireEvent.click(getByRole('button', { name: promoteChipLabel(firstClip.clipName, 4) }));

      // Now green.
      expect(
        getByRole('button', { name: removeChipLabel(firstClip.clipName, 4) }),
      ).toBeInTheDocument();
      expect(socket.emit).not.toHaveBeenCalled();

      fireEvent.click(getByRole('button', { name: 'Apply changes' }));

      expect(socket.emit).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith('/new/tag', { rfid: firstClip.rfid, pillar: 3 });
    });

    it('Apply emits /departed/tag for the replaced playing clip BEFORE /new/tag for the draft play entry', () => {
      const socket = createSocket(true);
      const playingClip = catalogue[0];
      const pickClip = catalogue[1];
      expect(pickClip).toBeDefined();
      const abletonState = createAbletonState({
        playingClips: [null, null, liveFixture(2, playingClip), null],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      // outlined -> queued -> play. Promoting over the currently-playing
      // clip's slot removes the playing clip from the draft (it can't demote
      // to queued), so Apply must stop it first.
      fireEvent.click(getByRole('button', { name: queueChipLabel(pickClip.clipName, 3) }));
      fireEvent.click(getByRole('button', { name: promoteChipLabel(pickClip.clipName, 3) }));
      fireEvent.click(getByRole('button', { name: 'Apply changes' }));

      expect(socket.emit).toHaveBeenNthCalledWith(1, '/departed/tag', {
        rfid: playingClip.rfid,
        pillar: 2,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(2, '/new/tag', {
        rfid: pickClip.rfid,
        pillar: 2,
      });
      expect(socket.emit).toHaveBeenCalledTimes(2);
      // Still open for further work.
      expect(getByRole('dialog')).toBeInTheDocument();
    });

    it('a currently-playing clip’s own chip is green and goes straight to removed — no gold state — and Apply stops it', () => {
      const socket = createSocket(true);
      const playingClip = catalogue[0];
      const abletonState = createAbletonState({
        playingClips: [null, null, liveFixture(2, playingClip), null],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));

      // Baseline renders the playing clip green on its pillar.
      const greenChip = getByRole('button', { name: removeChipLabel(playingClip.clipName, 3) });
      fireEvent.click(greenChip);

      // Straight to outlined — never gold.
      expect(
        getByRole('button', { name: queueChipLabel(playingClip.clipName, 3) }),
      ).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Apply changes' }));

      expect(socket.emit).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith('/departed/tag', {
        rfid: playingClip.rfid,
        pillar: 2,
      });
    });

    it('Revert restores the draft to reality without emitting and disarms Apply', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, onPendingPickChangeSpy } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }));
      expect(getByRole('button', { name: 'Revert changes' })).toBeEnabled();

      fireEvent.click(getByRole('button', { name: 'Revert changes' }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(onPendingPickChangeSpy).not.toHaveBeenCalled();
      expect(
        getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }),
      ).toBeInTheDocument();
      expect(getByRole('button', { name: 'Apply changes' })).toBeDisabled();
      expect(getByRole('button', { name: 'Revert changes' })).toBeDisabled();
    });

    it('tapping a DIFFERENT pillar’s chip moves the drafted clip (one tag, one pillar)', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }));
      expect(
        getByRole('button', { name: promoteChipLabel(firstClip.clipName, 1) }),
      ).toBeInTheDocument();

      // Tap pillar 2's chip on the same row — a move, not a second hold.
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 2) }));

      expect(
        getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }),
      ).toBeInTheDocument();
      expect(
        getByRole('button', { name: promoteChipLabel(firstClip.clipName, 2) }),
      ).toBeInTheDocument();
    });

    it('caps a pillar’s draft at 2: queueing a third clip evicts the oldest queued hold', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const [first, second, third] = catalogue;
      expect(third).toBeDefined();

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(first.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(second.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(third.clipName, 1) }));

      // Oldest (first) evicted back to outlined; second + third still gold.
      expect(getByRole('button', { name: queueChipLabel(first.clipName, 1) })).toBeInTheDocument();
      expect(
        getByRole('button', { name: promoteChipLabel(second.clipName, 1) }),
      ).toBeInTheDocument();
      expect(
        getByRole('button', { name: promoteChipLabel(third.clipName, 1) }),
      ).toBeInTheDocument();
    });

    it('Apply with two queued holds yields two pending rows, each with Play and Remove', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const [first, second] = catalogue;
      expect(second).toBeDefined();

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(first.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(second.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: 'Apply changes' }));
      fireEvent.click(getByRole('button', { name: 'Close sample selector' }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(getByRole('button', { name: `Play ${first.clipName}` })).toBeInTheDocument();
      expect(getByRole('button', { name: `Remove ${first.clipName}` })).toBeInTheDocument();
      expect(getByRole('button', { name: `Play ${second.clipName}` })).toBeInTheDocument();
      expect(getByRole('button', { name: `Remove ${second.clipName}` })).toBeInTheDocument();
    });

    it('a pending row’s Play emits /departed/tag for the active clip first, then /new/tag, and clears that row', () => {
      const socket = createSocket(true);
      const playingClip = catalogue[2];
      const pick = catalogue[0];
      const abletonState = createAbletonState({
        playingClips: [null, null, liveFixture(2, playingClip), null],
      });

      const { getByRole, queryByRole } = renderContainer(abletonState, socket, {
        index: 2,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(pick.clipName, 3) }));
      fireEvent.click(getByRole('button', { name: 'Apply changes' }));
      fireEvent.click(getByRole('button', { name: 'Close sample selector' }));
      expect(socket.emit).not.toHaveBeenCalled();

      fireEvent.click(getByRole('button', { name: `Play ${pick.clipName}` }));

      expect(socket.emit).toHaveBeenNthCalledWith(1, '/departed/tag', {
        rfid: playingClip.rfid,
        pillar: 2,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(2, '/new/tag', { rfid: pick.rfid, pillar: 2 });
      expect(socket.emit).toHaveBeenCalledTimes(2);
      expect(queryByRole('button', { name: `Play ${pick.clipName}` })).not.toBeInTheDocument();
    });

    it('a pending row’s Remove drops only that hold, without emitting', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const [first, second] = catalogue;

      const { getByRole, queryByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(first.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(second.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: 'Apply changes' }));
      fireEvent.click(getByRole('button', { name: 'Close sample selector' }));

      fireEvent.click(getByRole('button', { name: `Remove ${first.clipName}` }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(queryByRole('button', { name: `Play ${first.clipName}` })).not.toBeInTheDocument();
      expect(getByRole('button', { name: `Play ${second.clipName}` })).toBeInTheDocument();
    });

    it('Apply while disconnected warns, emits nothing, and leaves the draft dirty', () => {
      const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
      const socket = createSocket(true);
      const abletonState = createAbletonState();
      const firstClip = catalogue[0];

      const { getByRole, onPendingPickChangeSpy } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: false,
      });

      fireEvent.click(getByRole('button', { name: 'Select sample' }));
      fireEvent.click(getByRole('button', { name: queueChipLabel(firstClip.clipName, 1) }));
      fireEvent.click(getByRole('button', { name: 'Apply changes' }));

      expect(socket.emit).not.toHaveBeenCalled();
      expect(onPendingPickChangeSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Ignored apply'));
      expect(getByRole('button', { name: 'Apply changes' })).toBeEnabled();

      warnSpy.mockRestore();
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

    // WOW-007C item 2 (human decision): the DJ can mute an EMPTY pillar too,
    // pre-setting it silent before any clip lands there — the backend
    // persists desiredVolumes per pillar (resolveClipStartVolume), so the
    // mute holds for whatever plays there next.
    it('mutes an empty pillar in DJ mode: emits set_track_volume 0, then restores on unmute, and the button reflects state', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        trackVolume: [0.5, 0, 0, 0],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      expect(getByRole('button', { name: 'Mute' })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Mute' }));
      expect(abletonState.changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 0, volume: 0 });
      expect(getByRole('button', { name: 'Unmute' })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Unmute' }));
      expect(abletonState.changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 0, volume: 0.5 });
      expect(getByRole('button', { name: 'Mute' })).toBeInTheDocument();
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

  // WOW-007D: play-mode tube hiding for a pillar with nothing audible
  // (status 'empty' or 'queued'). DJ mode and an open Help overlay both
  // override the hiding.
  describe('play-mode tube hiding (WOW-007D)', () => {
    it('hides the tube for an empty pillar in play mode', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();

      const { queryByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: false,
        isConnected: true,
      });

      expect(queryByRole('slider')).not.toBeInTheDocument();
    });

    it('hides the tube for a queued (not-yet-audible) pillar in play mode', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        queuedClips: [
          clipFixture(0, 'Melody Loop', ClipTypes.Melody, 'rfid-queued-hide'),
          null,
          null,
          null,
        ],
      });

      const { queryByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: false,
        isConnected: true,
      });

      expect(queryByRole('slider')).not.toBeInTheDocument();
    });

    it('keeps the tube visible for a playing pillar in play mode', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState({
        playingClips: [
          clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'rfid-playing-show'),
          null,
          null,
          null,
        ],
      });

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: false,
        isConnected: true,
      });

      expect(getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    });

    it('always shows the tube in DJ mode, even for an empty pillar', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();

      const { getByRole } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: true,
        isConnected: true,
      });

      expect(getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    });

    it('forces the tube visible for an empty pillar when helpActive is true, even in play mode', () => {
      const socket = createSocket(true);
      const abletonState = createAbletonState();

      const { container } = renderContainer(abletonState, socket, {
        index: 0,
        djMode: false,
        isConnected: true,
        helpActive: true,
      });

      // Display-only (no handler on an empty pillar outside DJ mode): no
      // accessible slider role, so assert via the tube's own art asset.
      expect(
        container.querySelector('img[src="/images/slider-background-empty.png"]'),
      ).toBeInTheDocument();
    });
  });
});
