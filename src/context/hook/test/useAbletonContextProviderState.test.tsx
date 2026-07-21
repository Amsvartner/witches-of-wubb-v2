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
    // useAbletonContextProviderState's guard, which checks for real `on`/
    // `off` functions rather than `.connected` (WOW-035) precisely so it
    // can still tell this true placeholder apart from a real socket that's
    // merely disconnected, covered next.
    expect(() =>
      renderHook(() => useAbletonContextProviderState(), { wrapper: withSocket(placeholder) }),
    ).not.toThrow();
  });

  it('attaches listeners for a real-but-not-yet-connected socket, so a live connect is not missed (WOW-035 connect transition)', () => {
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

describe('useAbletonContextProviderState WOW-007C (cauldron sample/volume, idle timeout)', () => {
  it('fetches cauldron volume and idle timeout config on mount, alongside the existing get_* calls', () => {
    const fake = createFakeSocket(true);
    renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const getCalls = (name: string) => fake.emit.mock.calls.filter(([event]) => event === name);
    expect(getCalls('get_cauldron_volume')).toHaveLength(1);
    expect(getCalls('get_idle_timeout')).toHaveLength(1);
  });

  it('triggerCauldronSample emits trigger_cauldron_sample with no payload', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    act(() => {
      result.current.triggerCauldronSample();
    });

    expect(fake.emit).toHaveBeenCalledWith('trigger_cauldron_sample');
  });

  it('changeCauldronVolume emits set_cauldron_volume with the raw volume', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    act(() => {
      result.current.changeCauldronVolume(0.35);
    });

    expect(fake.emit).toHaveBeenCalledWith('set_cauldron_volume', { volume: 0.35 });
  });

  it('applies get_cauldron_volume ack and the cauldron_volume_changed broadcast to state', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    const ackCall = fake.emit.mock.calls.find(([event]) => event === 'get_cauldron_volume');
    const ackCallback = ackCall?.[2] as (volume: number) => void;
    act(() => {
      ackCallback(0.42);
    });
    expect(result.current.cauldronVolume).toBeCloseTo(0.42);

    act(() => {
      fake.trigger('cauldron_volume_changed', { volume: 0.2 });
    });
    expect(result.current.cauldronVolume).toBeCloseTo(0.2);
  });

  it('changeIdleTimeout emits set_idle_timeout and applies the acked result to state', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    act(() => {
      result.current.changeIdleTimeout({ enabled: false, timeoutMs: 60000 });
    });

    expect(fake.emit).toHaveBeenCalledWith(
      'set_idle_timeout',
      { enabled: false, timeoutMs: 60000 },
      expect.any(Function),
    );

    const setCall = fake.emit.mock.calls.find(([event]) => event === 'set_idle_timeout');
    const ackCallback = setCall?.[2] as (config: { enabled: boolean; timeoutMs: number }) => void;
    act(() => {
      ackCallback({ enabled: false, timeoutMs: 60000 });
    });
    expect(result.current.idleTimeout).toEqual({ enabled: false, timeoutMs: 60000 });
  });

  it('applies the idle_timeout_changed broadcast to state', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    act(() => {
      fake.trigger('idle_timeout_changed', { enabled: true, timeoutMs: 90000 });
    });

    expect(result.current.idleTimeout).toEqual({ enabled: true, timeoutMs: 90000 });
  });

  it('unsubscribes the new listeners on unmount', () => {
    const fake = createFakeSocket(true);
    const { unmount } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    expect(fake.handlerCount('cauldron_volume_changed')).toBe(1);
    expect(fake.handlerCount('idle_timeout_changed')).toBe(1);

    unmount();

    expect(fake.handlerCount('cauldron_volume_changed')).toBe(0);
    expect(fake.handlerCount('idle_timeout_changed')).toBe(0);
  });
});

// WOW-007C item 4: DJ-mode idle-timeout suppression failsafe chain — this
// hook's only responsibility is the fire-and-forget emit; PlayModeContainer
// owns when it's called (mode change + reconnect).
describe('useAbletonContextProviderState WOW-007C item 4 (DJ mode)', () => {
  it('setDjMode emits set_dj_mode with { active } and no ack callback', () => {
    const fake = createFakeSocket(true);
    const { result } = renderHook(() => useAbletonContextProviderState(), {
      wrapper: withSocket(fake as unknown as Socket),
    });

    act(() => {
      result.current.setDjMode(true);
    });

    expect(fake.emit).toHaveBeenCalledWith('set_dj_mode', { active: true });

    act(() => {
      result.current.setDjMode(false);
    });

    expect(fake.emit).toHaveBeenCalledWith('set_dj_mode', { active: false });
  });
});
