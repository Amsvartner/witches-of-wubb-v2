import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useSliderEmit } from '~/hook/useSliderEmit';

describe('useSliderEmit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the context value', () => {
    const emit = vi.fn();
    const { result } = renderHook(() => useSliderEmit(50, emit));
    expect(result.current.value).toBe(50);
  });

  it('updates the displayed value immediately on the first call and emits (throttle leading edge)', () => {
    const emit = vi.fn();
    const { result } = renderHook(() => useSliderEmit(50, emit));

    act(() => {
      result.current.onValue(60);
    });

    expect(result.current.value).toBe(60);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(60);
  });

  it('throttles rapid emits: the display value tracks every call, but emit coalesces until the 100ms window elapses', () => {
    const emit = vi.fn();
    const { result } = renderHook(() => useSliderEmit(0, emit));

    act(() => {
      result.current.onValue(10); // leading edge - emits immediately
    });
    expect(emit).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.onValue(20); // inside the cooldown window - queued as pending
      result.current.onValue(30); // supersedes the pending value
    });

    // The drag-local display value always tracks the latest call...
    expect(result.current.value).toBe(30);
    // ...but per throttle.ts's leading/trailing semantics, no second emit has
    // fired yet - only the queued (most recent) value is pending.
    expect(emit).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // The trailing call lands once the cooldown elapses, carrying the last
    // value the drag actually reached.
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith(30);
  });

  it('does not resync from the context value while a drag is in progress', () => {
    const emit = vi.fn();
    const { result, rerender } = renderHook(
      ({ contextValue }) => useSliderEmit(contextValue, emit),
      {
        initialProps: { contextValue: 50 },
      },
    );

    act(() => {
      result.current.onDragStart();
    });

    // A context update mid-drag (e.g. a backend echo) must not snap the
    // display value backward/forward while the visitor is still dragging.
    rerender({ contextValue: 999 });
    expect(result.current.value).toBe(50);
  });

  it('resumes syncing from the context value once the drag ends', () => {
    const emit = vi.fn();
    const { result, rerender } = renderHook(
      ({ contextValue }) => useSliderEmit(contextValue, emit),
      {
        initialProps: { contextValue: 50 },
      },
    );

    act(() => {
      result.current.onDragStart();
    });
    rerender({ contextValue: 999 }); // suppressed while dragging
    expect(result.current.value).toBe(50);

    act(() => {
      result.current.onDragEnd();
    });

    // A subsequent context change (post-drag) now applies normally.
    rerender({ contextValue: 1000 });
    expect(result.current.value).toBe(1000);
  });
});
