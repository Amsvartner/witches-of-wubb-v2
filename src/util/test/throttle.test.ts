import { vi } from 'vitest';
import { throttle } from '~/util/throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function immediately on the first call (leading edge)', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('suppresses further calls that land inside the wait window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(1);
    throttled(2);
    throttled(3);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('fires a trailing call with the most recent args once the window elapses (the released position always lands)', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(1);
    vi.advanceTimersByTime(30);
    throttled(2);
    vi.advanceTimersByTime(30);
    throttled(3);

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it('does not fire a redundant trailing call for a single tap (no calls during the window)', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(1);
    vi.advanceTimersByTime(1000);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps bounding emissions across a drag that outlasts one window, still landing the true final value', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    // ~50 drag events, 10ms apart (500ms of continuous dragging).
    for (let i = 1; i <= 50; i++) {
      throttled(i);
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(100);

    // Bounded: nowhere near one call per input event.
    expect(fn.mock.calls.length).toBeGreaterThan(1);
    expect(fn.mock.calls.length).toBeLessThan(10);
    // The very last value the user dragged to must be the last thing sent.
    expect(fn).toHaveBeenLastCalledWith(50);
  });

  it('treats a call after the cooldown has fully elapsed as a new leading edge', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(1);
    vi.advanceTimersByTime(150);

    throttled(2);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(2);
  });

  it('passes multiple arguments through untouched', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('pillar', 2);

    expect(fn).toHaveBeenCalledWith('pillar', 2);
  });
});
