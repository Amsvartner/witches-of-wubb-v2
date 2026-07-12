import { act, renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import type { BrowserClipInfo } from 'backend/type/BrowserClipInfo';
import { ClipTypes } from 'backend/type/ClipTypes';
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
    // useAbletonContextProviderState's `if (!socket.connected) return;` guard.
    expect(() =>
      renderHook(() => useAbletonContextProviderState(), { wrapper: withSocket(placeholder) }),
    ).not.toThrow();
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

function buildClip(pillar: number, clipName: string): BrowserClipInfo {
  return {
    pillar,
    clipName,
    rfid: `rfid-${pillar}-${clipName}`,
    type: ClipTypes.Vox,
    assetName: `${clipName}.wav`,
  };
}

describe('useAbletonContextProviderState ingredient_removed pillar scoping (WOW-026)', () => {
  it("leaves pillar A's own state untouched, and correctly clears pillar B's own queued clip, when the same clip name is playing on pillar A while ingredient_removed arrives for pillar B (the actual WOW-026 bug)", () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const playingOnA = buildClip(0, 'Shared Name');
    const queuedOnB = buildClip(1, 'Shared Name');

    act(() => {
      fake.trigger('clip_started', playingOnA);
    });
    act(() => {
      fake.trigger('clip_queued', queuedOnB);
    });

    expect(result.current.playingClips[0]).toEqual(playingOnA);
    expect(result.current.queuedClips[1]).toEqual(queuedOnB);

    act(() => {
      fake.trigger('ingredient_removed', queuedOnB);
    });

    // Pillar A's own playing clip must be completely unaffected by an event
    // whose pillar is B.
    expect(result.current.playingClips[0]).toEqual(playingOnA);

    // The actual bug: the old code decided "was it playing?" by scanning
    // ALL pillars for a name match, found pillar A's clip, and wrongly took
    // the playing-clip branch for pillar B - leaving B's real queued clip
    // stuck forever (never reaching the queued branch) and marking B as
    // "stopping" a clip it never played.
    expect(result.current.queuedClips[1]).toBeFalsy();
    expect(result.current.stoppingClips[1]).toBeFalsy();
  });

  it('still handles the normal single-pillar playing removal correctly', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const playing = buildClip(2, 'Solo Clip');
    act(() => {
      fake.trigger('clip_started', playing);
    });
    expect(result.current.playingClips[2]).toEqual(playing);

    act(() => {
      fake.trigger('ingredient_removed', playing);
    });

    expect(result.current.playingClips[2]).toBeFalsy();
    expect(result.current.stoppingClips[2]).toEqual(playing);
  });

  it('still handles the normal single-pillar queued removal correctly', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const queued = buildClip(3, 'Waiting Clip');
    act(() => {
      fake.trigger('clip_queued', queued);
    });
    expect(result.current.queuedClips[3]).toEqual(queued);

    act(() => {
      fake.trigger('ingredient_removed', queued);
    });

    expect(result.current.queuedClips[3]).toBeFalsy();
  });

  it('does not fabricate a stopping clip on pillar B when a same-named clip is only playing on pillar A and pillar B has nothing at all', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const playingOnA = buildClip(0, 'Ghost Clip');
    act(() => {
      fake.trigger('clip_started', playingOnA);
    });

    // Pillar B (1) never had anything playing or queued.
    act(() => {
      fake.trigger('ingredient_removed', buildClip(1, 'Ghost Clip'));
    });

    // The old .some() scan would match pillar A and wrongly fabricate a
    // "stopping" clip on pillar B, which never played anything - exactly the
    // symptom the ticket itself describes ("set stopping-state on the other
    // pillar's UI slot").
    expect(result.current.stoppingClips[1]).toBeFalsy();
    expect(result.current.playingClips[1]).toBeFalsy();
    expect(result.current.queuedClips[1]).toBeFalsy();
    expect(result.current.playingClips[0]).toEqual(playingOnA);
  });

  it("does not wipe pillar B's own queued clip when a same-named clip is only queued on pillar A (closes the queued branch's own coverage gap)", () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const queuedOnA = buildClip(2, 'Other Clip');
    const queuedOnB = buildClip(3, 'My Own Clip');
    act(() => {
      fake.trigger('clip_queued', queuedOnA);
    });
    act(() => {
      fake.trigger('clip_queued', queuedOnB);
    });

    // Removal event for pillar B names pillar A's queued clip, not B's own.
    act(() => {
      fake.trigger('ingredient_removed', buildClip(3, 'Other Clip'));
    });

    // The old code's queued branch also scanned every pillar via .some(),
    // so it would match pillar A's "Other Clip" and wrongly clear pillar B's
    // real queued clip ("My Own Clip") even though B's own slot never
    // matched the removed name. Pillar A's own queue must stay untouched too.
    expect(result.current.queuedClips[3]).toEqual(queuedOnB);
    expect(result.current.queuedClips[2]).toEqual(queuedOnA);
  });
});
