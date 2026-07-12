import { act, fireEvent, render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import { ClipTypes } from 'backend/type/ClipTypes';
import { DebugModalContainer } from '~/container/DebugModalContainer';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { SocketContext } from '~/context/SocketContext';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// uses internally; it wasn't reached by this file's original single-render
// test, but the extra act()-flushed render cycle the connection-indicator
// tests below trigger (simulating live connect/disconnect) does reach it.
// Not a fix specific to this ticket's logic - a real, pre-existing gap in
// the test environment, only surfaced now. Scoped to this file rather than
// the shared src/test/setup-tests.ts (out of this ticket's allowed files).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// Real clip names can contain spaces (e.g. `"Doink U" Vox 122`, per WOW-016) - a
// synthetic name is used here (rather than a real CSV entry) so this test can't collide
// with the "available clips" list, which is built from the real Music Database.csv and
// would otherwise render the same clip name a second time on other pillars. The
// space-stripped clipNameToInfoMap lookup this test guards against threw on exactly
// this shape, since queued_clip events arrive with the raw (spaced) clip name.
const SPACED_CLIP_NAME = 'Test Fixture Clip With Spaces 5A 100';
const SPACED_CLIP_RFID = 'test-fixture-rfid-0001';
const QUEUED_PILLAR_INDEX = 1;

const abletonStub: AbletonContextState = {
  getTracksAndClips: () => {},
  changeTempo: () => {},
  changeTrackVolume: () => {},
  tempo: 120,
  trackVolume: [],
  queuedClips: [
    null,
    {
      pillar: QUEUED_PILLAR_INDEX,
      clipName: SPACED_CLIP_NAME,
      rfid: SPACED_CLIP_RFID,
      type: ClipTypes.Melody,
      assetName: 'doink-u',
      artist: 'Doink',
      songTitle: 'U',
    },
    null,
    null,
  ],
  playingClips: [null, null, null, null],
  stoppingClips: [null, null, null, null],
  clipTempo: [],
  masterKey: '',
  changeMasterKey: () => {},
  keylock: true,
  changeKeylock: () => {},
};

function renderModal(socket: Socket) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <SocketContext.Provider value={socket}>
      <AbletonContext.Provider value={abletonStub}>{children}</AbletonContext.Provider>
    </SocketContext.Provider>
  );
  return render(<DebugModalContainer isModalOpen setIsModalOpen={() => {}} />, { wrapper });
}

type Handler = (...args: unknown[]) => void;

// Supports live connect/disconnect simulation via `trigger`, for the
// "connection indicator" tests below (WOW-024).
function createFakeSocket(connected: boolean) {
  const handlers: Record<string, Handler[]> = {};
  const socket = {
    connected,
    emit: vi.fn(),
    on: vi.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: vi.fn((event: string, cb?: Handler) => {
      if (!handlers[event]) return;
      handlers[event] = cb ? handlers[event].filter((h) => h !== cb) : [];
    }),
    trigger(event: 'connect' | 'disconnect') {
      // Mirrors real socket.io-client: .connected flips alongside the event.
      socket.connected = event === 'connect';
      (handlers[event] ?? []).forEach((cb) => cb());
    },
  };
  return socket;
}

describe('DebugModalContainer', () => {
  it('unqueues a clip whose name contains spaces without throwing, using rfid directly', () => {
    const emit = vi.fn();
    // connected: true + on/off no-ops represent an already-connected socket -
    // this test is about the spaced-name unqueue behavior, not connection
    // state (see the "connection indicator" describe block below for that).
    const socket = { emit, connected: true, on: vi.fn(), off: vi.fn() } as unknown as Socket;

    // The .not.toThrow() wrappers below are belt-and-suspenders only: in this
    // React/jsdom stack, fireEvent.click() never rethrows an onClick handler's
    // exception to the caller (jsdom reports it per-listener instead - see
    // EventTarget-impl.js), so they can't actually fail here. The real regression
    // guard against the pre-fix crash is the toHaveBeenCalledWith assertion below -
    // pre-fix, the handler throws before reaching emit(), so emit is never called
    // and that assertion fails cleanly. Don't remove it while trusting the
    // .not.toThrow() lines to still catch the bug.
    expect(() => renderModal(socket)).not.toThrow();

    const clipButton = screen.getByText(SPACED_CLIP_NAME).closest('button');
    expect(clipButton).not.toBeNull();

    expect(() => fireEvent.click(clipButton as HTMLButtonElement)).not.toThrow();

    expect(emit).toHaveBeenCalledWith('/departed/tag', {
      rfid: SPACED_CLIP_RFID,
      pillar: QUEUED_PILLAR_INDEX,
    });
  });

  // WOW-024: connection indicator + inert clip buttons until connected.
  //
  // "connect transition" here specifically means "disconnect, then reconnect
  // on the same live socket" (tests 3+4 below), not "mounts while the
  // placeholder socket is still connecting, then swaps to the real one" -
  // that transition is a React-context *reference* change
  // (useSocketContextProviderState only ever calls setSocket once it's
  // already connected, per WOW-019), and @testing-library/react's render()
  // wrapper - like renderHook's - doesn't let a test swap the value a
  // wrapper closure captured after the fact. The reconnect-on-the-same-object
  // path covered here is the one that matters for a socket that's already
  // live in the tree, which is the actual risk this ticket cares about.
  describe('connection indicator', () => {
    it('shows a connecting indicator and makes clip buttons inert before the socket connects', () => {
      const socket = createFakeSocket(false);
      renderModal(socket as unknown as Socket);

      expect(screen.getByText(/connecting to backend/i)).toBeInTheDocument();

      const clipButton = screen.getByText(SPACED_CLIP_NAME).closest('button');
      fireEvent.click(clipButton as HTMLButtonElement);

      expect(socket.emit).not.toHaveBeenCalled();
    });

    it('hides the indicator and allows clicks once already connected', () => {
      const socket = createFakeSocket(true);
      renderModal(socket as unknown as Socket);

      expect(screen.queryByText(/connecting to backend/i)).not.toBeInTheDocument();

      const clipButton = screen.getByText(SPACED_CLIP_NAME).closest('button');
      fireEvent.click(clipButton as HTMLButtonElement);

      expect(socket.emit).toHaveBeenCalledWith('/departed/tag', {
        rfid: SPACED_CLIP_RFID,
        pillar: QUEUED_PILLAR_INDEX,
      });
    });

    it('flips to disconnected live: shows the indicator again and makes clicks inert (disconnect transition)', () => {
      const socket = createFakeSocket(true);
      renderModal(socket as unknown as Socket);

      act(() => {
        socket.trigger('disconnect');
      });

      expect(screen.getByText(/connecting to backend/i)).toBeInTheDocument();

      const clipButton = screen.getByText(SPACED_CLIP_NAME).closest('button');
      fireEvent.click(clipButton as HTMLButtonElement);

      expect(socket.emit).not.toHaveBeenCalled();
    });

    it('flips back to connected on reconnect: hides the indicator and allows clicks again (connect transition)', () => {
      const socket = createFakeSocket(true);
      renderModal(socket as unknown as Socket);

      act(() => {
        socket.trigger('disconnect');
        socket.trigger('connect');
      });

      expect(screen.queryByText(/connecting to backend/i)).not.toBeInTheDocument();

      const clipButton = screen.getByText(SPACED_CLIP_NAME).closest('button');
      fireEvent.click(clipButton as HTMLButtonElement);

      expect(socket.emit).toHaveBeenCalledWith('/departed/tag', {
        rfid: SPACED_CLIP_RFID,
        pillar: QUEUED_PILLAR_INDEX,
      });
    });
  });
});
