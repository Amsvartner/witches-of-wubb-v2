import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { Logger } from '~/util/Logger';

type FakeSocket = {
  connected: boolean;
  handlers: Record<string, (...args: unknown[]) => void>;
  anyHandlers: ((event: string, ...args: unknown[]) => void)[];
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  onAny: (cb: (event: string, ...args: unknown[]) => void) => void;
};

// vi.mock auto-hoisting is not active in this vitest setup, so we register the
// socket.io-client mock with vi.doMock and dynamically import the hook so it
// picks up the mocked `io`. Logger is a plain singleton we can spy on directly.
let useSocketContextProviderState: typeof import('~/context/hook/useSocketContextProviderState')['useSocketContextProviderState'];
let ioMock: Mock;

beforeAll(async () => {
  vi.doMock('socket.io-client', () => ({
    io: vi.fn(() => {
      const socket: FakeSocket = {
        connected: false,
        handlers: {},
        anyHandlers: [],
        on: (event, cb) => {
          socket.handlers[event] = cb;
        },
        onAny: (cb) => {
          socket.anyHandlers.push(cb);
        },
      };
      return socket;
    }),
    Socket: class {},
  }));

  const socketModule = await import('socket.io-client');
  ioMock = socketModule.io as unknown as Mock;
  ({ useSocketContextProviderState } = await import(
    '~/context/hook/useSocketContextProviderState'
  ));
});

const lastSocket = (): FakeSocket => ioMock.mock.results[0].value as FakeSocket;

describe('useSocketContextProviderState', () => {
  let debug: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ioMock.mockClear();
    debug = vi.spyOn(Logger, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    debug.mockRestore();
  });

  it('opens a socket connection on mount and returns the socket once connected', () => {
    const { result } = renderHook(() => useSocketContextProviderState());

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(result.current.connected).toBeFalsy();

    const socket = lastSocket();
    act(() => {
      socket.connected = true;
      socket.handlers['connect']();
    });

    expect(result.current).toBe(socket);
    expect(debug).toHaveBeenCalledWith('Connected to socket.io server');
  });

  it('does not open a second connection after it is already connected', () => {
    renderHook(() => useSocketContextProviderState());

    const socket = lastSocket();
    act(() => {
      socket.connected = true;
      socket.handlers['connect']();
    });

    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('logs every received event via onAny', () => {
    renderHook(() => useSocketContextProviderState());

    const socket = lastSocket();
    act(() => {
      socket.anyHandlers[0]('clip_started', { pillar: 0 });
    });

    expect(debug).toHaveBeenCalledWith('clip_started received with:', [{ pillar: 0 }]);
  });
});
