import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useConfirmTap } from '~/hook/useConfirmTap';

describe('useConfirmTap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts disarmed', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap(action));
    expect(result.current.armed).toBe(false);
  });

  it('arms on the first tap without firing the action', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap(action));

    act(() => {
      result.current.onTap();
    });

    expect(result.current.armed).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it('fires the action exactly once on the second tap and disarms', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap(action));

    act(() => {
      result.current.onTap();
    });
    act(() => {
      result.current.onTap();
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  it('auto-disarms after 3s without firing the action', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap(action));

    act(() => {
      result.current.onTap();
    });
    expect(result.current.armed).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.armed).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('a tap after auto-disarm arms again rather than firing', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTap(action));

    act(() => {
      result.current.onTap();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      result.current.onTap();
    });

    expect(result.current.armed).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it('clears its pending disarm timer on unmount', () => {
    const action = vi.fn();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { result, unmount } = renderHook(() => useConfirmTap(action));

    act(() => {
      result.current.onTap();
    });
    clearTimeoutSpy.mockClear();

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    // No dangling timer fires after unmount, and the action is never invoked.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(action).not.toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
