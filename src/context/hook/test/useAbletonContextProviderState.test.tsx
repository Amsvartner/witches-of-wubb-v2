import { act, renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import { SocketContext } from '~/context/SocketContext';
import { useAbletonContextProviderState } from '~/context/hook/useAbletonContextProviderState';

type Handler = (...args: unknown[]) => void;

function createFakeSocket(connected: boolean) {
  const handlers: Record<string, Handler[]> = {};
  const socket = {
    connected,
    on: vi.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: vi.fn((event: string, cb?: Handler) => {
      if (!handlers[event]) return;
      handlers[event] = cb ? handlers[event].filter((h) => h !== cb) : [];
    }),
    emit: vi.fn(),
    // Test-only helper, not part of the real Socket API: simulates the
    // server firing `event` by invoking every handler registered for it.
    trigger(event: string, ...args: unknown[]) {
      (handlers[event] ?? []).forEach((cb) => cb(...args));
    },
    handlerCount(event: string) {
      return (handlers[event] ?? []).length;
    },
  };
  return socket;
}

// @testing-library/react v14's renderHook only threads initialProps/rerender
// props into the render callback, never into `wrapper` (it's always
// instantiated with `null` props - confirmed by reading dist/pure.js). So
// each test builds its own inline wrapper closing over the socket it wants
// in context, rather than trying to change the socket via rerender.
const withSocket = (socket: Socket) => {
  function SocketWrapper({ children }: PropsWithChildren) {
    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
  }
  return SocketWrapper;
};

describe('useAbletonContextProviderState reconnect behavior (WOW-019)', () => {
  it('does not subscribe or fetch while the socket is still the unconnected placeholder', () => {
    const placeholder = { connected: false } as unknown as Socket;

    // The real assertion is that rendering doesn't throw calling methods
    // that don't exist on the placeholder object - see
    // useAbletonContextProviderState's guard, which checks for real `on`/
    // `off` functions rather than `.connected` (WOW-033) precisely so it
    // can still tell this true placeholder apart from a real socket that's
    // merely disconnected, covered next.
    expect(() =>
      renderHook(() => useAbletonContextProviderState(), { wrapper: withSocket(placeholder) }),
    ).not.toThrow();
  });

  it('attaches listeners for a real-but-not-yet-connected socket, so a live connect is not missed (WOW-033 connect transition)', () => {
    const fake = createFakeSocket(false);
    renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    // The guard checks for real on/off functions, not `.connected` - a
    // socket that's real but currently disconnected still gets every
    // listener, including the 'connect' re-fetch listener, attached on
    // mount. Pre-fix, `if (!socket.connected) return;` would have skipped
    // all of this, and since the socket's object reference never changes on
    // a live reconnect, the 'connect' trigger below would have been missed
    // silently and permanently - a Copilot review caught the identical bug
    // in DebugModalContainer.tsx (WOW-024).
    expect(fake.handlerCount('connect')).toBe(1);
    expect(fake.handlerCount('clip_started')).toBe(1);

    const getCalls = (name: string) => fake.emit.mock.calls.filter(([event]) => event === name);
    expect(getCalls('get_tempo')).toHaveLength(1); // fetched immediately on mount, same as the already-connected case below

    act(() => {
      fake.trigger('connect');
    });
    expect(getCalls('get_tempo')).toHaveLength(2);
  });

  it('fetches state and subscribes once rendered with an already-connected socket', () => {
    const fake = createFakeSocket(true);
    renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const getCalls = (name: string) => fake.emit.mock.calls.filter(([event]) => event === name);
    expect(getCalls('get_track_volumes')).toHaveLength(1);
    expect(getCalls('get_playing_clips')).toHaveLength(1);
    expect(getCalls('get_queued_clips')).toHaveLength(1);
    expect(getCalls('get_tempo')).toHaveLength(1);
    expect(getCalls('get_master-key')).toHaveLength(1);
    expect(getCalls('get_keylock_state')).toHaveLength(1);
    expect(fake.handlerCount('clip_started')).toBe(1);
    expect(fake.handlerCount('master-key_changed')).toBe(1);
  });

  it('re-fetches on every future reconnect, without the socket reference or the effect needing to change (the actual bug)', () => {
    const fake = createFakeSocket(true);
    renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const getCalls = (name: string) => fake.emit.mock.calls.filter(([event]) => event === name);
    expect(getCalls('get_tempo')).toHaveLength(1); // initial connect

    // Simulate socket.io re-firing 'connect' on the SAME persistent object
    // after a disconnect/reconnect cycle - no rerender, no new socket
    // reference, exactly what a real backend restart looks like from the
    // frontend's perspective.
    act(() => {
      fake.trigger('connect');
    });
    expect(getCalls('get_tempo')).toHaveLength(2);

    act(() => {
      fake.trigger('connect');
    });
    expect(getCalls('get_tempo')).toHaveLength(3);
  });

  it('does not accumulate duplicate subscriptions across repeated reconnects', () => {
    const fake = createFakeSocket(true);
    renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    act(() => {
      fake.trigger('connect');
      fake.trigger('connect');
      fake.trigger('connect');
    });

    // Every listener - including the new 'connect' re-fetch listener itself -
    // was registered exactly once on mount and never re-registered, since
    // this effect only runs once for a given socket reference.
    expect(fake.handlerCount('connect')).toBe(1);
    expect(fake.handlerCount('clip_started')).toBe(1);
    expect(fake.handlerCount('master-key_changed')).toBe(1);
    const connectRegistrations = fake.on.mock.calls.filter(([event]) => event === 'connect');
    expect(connectRegistrations).toHaveLength(1);
  });

  it('unsubscribes everything, including the reconnect listener, on unmount', () => {
    const fake = createFakeSocket(true);
    const { unmount } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    unmount();

    expect(fake.handlerCount('connect')).toBe(0);
    expect(fake.handlerCount('clip_started')).toBe(0);
    expect(fake.handlerCount('master-key_changed')).toBe(0);
  });
});
