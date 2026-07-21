import { fireEvent, render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { TempoSliderContainer } from '~/container/TempoSliderContainer';

function buildContextValue(overrides: Partial<AbletonContextState> = {}): AbletonContextState {
  return {
    getTracksAndClips: vi.fn(),
    changeTempo: vi.fn(),
    changeTrackVolume: vi.fn(),
    tempo: 120,
    trackVolume: [0, 0, 0, 0],
    queuedClips: [null, null, null, null],
    playingClips: [null, null, null, null],
    stoppingClips: [null, null, null, null],
    clipTempo: [null, null, null, null],
    masterKey: '',
    changeMasterKey: vi.fn(),
    keylock: true,
    changeKeylock: vi.fn(),
    // WOW-007C
    triggerCauldronSample: vi.fn(),
    cauldronVolume: 0.6,
    changeCauldronVolume: vi.fn(),
    idleTimeout: { enabled: true, timeoutMs: 3 * 60 * 1000 },
    changeIdleTimeout: vi.fn(),
    setDjMode: vi.fn(),
    ...overrides,
  };
}

function withAbletonContext(value: AbletonContextState) {
  return function AbletonWrapper({ children }: PropsWithChildren) {
    return <AbletonContext.Provider value={value}>{children}</AbletonContext.Provider>;
  };
}

describe('TempoSliderContainer (WOW-027)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the visible slider position and label immediately on every drag step, before any throttled emission fires', () => {
    const changeTempo = vi.fn();
    render(<TempoSliderContainer />, {
      wrapper: withAbletonContext(buildContextValue({ tempo: 120, changeTempo })),
    });

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '130' } });

    expect(slider).toHaveValue('130');
    expect(screen.getByText('130')).toBeInTheDocument();
    // The visual update above is synchronous; the emission below is not
    // asserted yet on purpose - it's covered by the throttling tests below.
  });

  it('throttles set_tempo emission during a rapid drag instead of firing on every input event', () => {
    const changeTempo = vi.fn();
    render(<TempoSliderContainer />, {
      wrapper: withAbletonContext(buildContextValue({ tempo: 120, changeTempo })),
    });

    const slider = screen.getByRole('slider');
    for (let value = 121; value <= 130; value++) {
      fireEvent.change(slider, { target: { value: String(value) } });
    }

    // Leading-edge call only - the other 9 rapid changes are suppressed
    // within the throttle window, not one emission per pixel of drag.
    expect(changeTempo).toHaveBeenCalledTimes(1);
    expect(changeTempo).toHaveBeenCalledWith(121);
  });

  it('always emits the released position once the throttle window elapses, even after a burst of intermediate values', () => {
    const changeTempo = vi.fn();
    render(<TempoSliderContainer />, {
      wrapper: withAbletonContext(buildContextValue({ tempo: 120, changeTempo })),
    });

    const slider = screen.getByRole('slider');
    for (let value = 121; value <= 130; value++) {
      fireEvent.change(slider, { target: { value: String(value) } });
    }
    expect(changeTempo).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    expect(changeTempo).toHaveBeenCalledTimes(2);
    expect(changeTempo).toHaveBeenLastCalledWith(130);
  });

  it('re-syncs the displayed tempo when the context tempo changes externally (e.g. another client, or a reconnect refetch)', () => {
    // A mutable closure variable read by Wrapper on every render, mutated
    // between renders and picked up via rerender() on the SAME mounted
    // TempoSliderContainer instance - this actually exercises the
    // useEffect(() => setDisplayTempo(tempo), [tempo]) sync path, unlike
    // mounting a second independent instance with a different initial value.
    let currentValue = buildContextValue({ tempo: 120 });
    function Wrapper() {
      return (
        <AbletonContext.Provider value={currentValue}>
          <TempoSliderContainer />
        </AbletonContext.Provider>
      );
    }

    const { rerender } = render(<Wrapper />);
    expect(screen.getByText('120')).toBeInTheDocument();

    currentValue = buildContextValue({ tempo: 140 });
    rerender(<Wrapper />);

    expect(screen.getByText('140')).toBeInTheDocument();
  });

  it('does not let a stale leading-edge echo snap the display backward while the user is still dragging', () => {
    const changeTempo = vi.fn();
    let currentValue = buildContextValue({ tempo: 120, changeTempo });
    function Wrapper() {
      return (
        <AbletonContext.Provider value={currentValue}>
          <TempoSliderContainer />
        </AbletonContext.Provider>
      );
    }

    const { rerender } = render(<Wrapper />);
    const slider = screen.getByRole('slider');

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '121' } }); // leading edge: 121
    fireEvent.change(slider, { target: { value: '135' } }); // user keeps dragging past it
    expect(slider).toHaveValue('135');

    // The leading edge's own ack/broadcast echo (tempo: 121) lands back in
    // context while the pointer is still down - exactly the scenario the
    // implementer's own live-verification methodology (a burst of events
    // faster than one network round trip) would have hit in a real drag.
    currentValue = buildContextValue({ tempo: 121, changeTempo });
    rerender(<Wrapper />);

    // Must NOT snap back to the stale 121 echo while still dragging.
    expect(slider).toHaveValue('135');

    fireEvent.pointerUp(slider);

    // Once released, a genuinely new external change still syncs normally.
    currentValue = buildContextValue({ tempo: 150, changeTempo });
    rerender(<Wrapper />);

    expect(slider).toHaveValue('150');
  });

  it('recovers from a drag interrupted without pointerup/pointercancel/blur on the element itself, via a window-level pointerup fallback', () => {
    const changeTempo = vi.fn();
    let currentValue = buildContextValue({ tempo: 120, changeTempo });
    function Wrapper() {
      return (
        <AbletonContext.Provider value={currentValue}>
          <TempoSliderContainer />
        </AbletonContext.Provider>
      );
    }

    const { rerender } = render(<Wrapper />);
    const slider = screen.getByRole('slider');

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '130' } });
    expect(slider).toHaveValue('130');

    // Drag ends without pointerup/pointercancel/blur ever firing on the
    // element (e.g. OS/window focus loss while the mouse button is still
    // held) - only a window-level pointerup fires, as it would natively
    // once the button is eventually released off-element.
    fireEvent.pointerUp(window);

    // If isDraggingRef were stuck true, this external change would be
    // suppressed and the slider would stay at the stale drag value.
    currentValue = buildContextValue({ tempo: 150, changeTempo });
    rerender(<Wrapper />);

    expect(slider).toHaveValue('150');
  });
});
