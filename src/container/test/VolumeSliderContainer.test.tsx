import { fireEvent, render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { VolumeSliderContainer } from '~/container/VolumeSliderContainer';

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
    ...overrides,
  };
}

function withAbletonContext(value: AbletonContextState) {
  return function AbletonWrapper({ children }: PropsWithChildren) {
    return <AbletonContext.Provider value={value}>{children}</AbletonContext.Provider>;
  };
}

describe('VolumeSliderContainer (WOW-027)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the visible slider position immediately on every drag step', () => {
    render(<VolumeSliderContainer pillar={0} />, {
      wrapper: withAbletonContext(buildContextValue({ trackVolume: [0.3, 0, 0, 0] })),
    });

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.5' } });

    expect(slider).toHaveValue('0.5');
  });

  it('throttles set_track_volume emission during a rapid drag instead of firing on every input event', () => {
    const changeTrackVolume = vi.fn();
    render(<VolumeSliderContainer pillar={2} />, {
      wrapper: withAbletonContext(
        buildContextValue({ trackVolume: [0, 0, 0.1, 0], changeTrackVolume }),
      ),
    });

    const slider = screen.getByRole('slider');
    for (let step = 1; step <= 10; step++) {
      fireEvent.change(slider, { target: { value: String(0.1 + step * 0.01) } });
    }

    expect(changeTrackVolume).toHaveBeenCalledTimes(1);
    expect(changeTrackVolume).toHaveBeenCalledWith({ pillar: 2, volume: 0.11 });
  });

  it('always emits the released volume once the throttle window elapses, tagged with the correct pillar', () => {
    const changeTrackVolume = vi.fn();
    render(<VolumeSliderContainer pillar={3} />, {
      wrapper: withAbletonContext(
        buildContextValue({ trackVolume: [0, 0, 0, 0.1], changeTrackVolume }),
      ),
    });

    const slider = screen.getByRole('slider');
    for (let step = 1; step <= 10; step++) {
      fireEvent.change(slider, { target: { value: String(0.1 + step * 0.01) } });
    }
    expect(changeTrackVolume).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    expect(changeTrackVolume).toHaveBeenCalledTimes(2);
    expect(changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 3, volume: 0.2 });
  });

  it('resetting the volume updates the visible position immediately, not just after a round trip', () => {
    const changeTrackVolume = vi.fn();
    render(<VolumeSliderContainer pillar={1} />, {
      wrapper: withAbletonContext(
        buildContextValue({ trackVolume: [0, 0.1, 0, 0], changeTrackVolume }),
      ),
    });

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(screen.getByRole('slider')).toHaveValue('0.6');
    expect(changeTrackVolume).toHaveBeenCalledWith({ pillar: 1, volume: 0.6 });
  });

  it('re-syncs the displayed volume when the context volume changes externally (e.g. another client, or a reconnect refetch)', () => {
    let currentValue = buildContextValue({ trackVolume: [0.2, 0, 0, 0] });
    function Wrapper() {
      return (
        <AbletonContext.Provider value={currentValue}>
          <VolumeSliderContainer pillar={0} />
        </AbletonContext.Provider>
      );
    }

    const { rerender } = render(<Wrapper />);
    expect(screen.getByRole('slider')).toHaveValue('0.2');

    currentValue = buildContextValue({ trackVolume: [0.45, 0, 0, 0] });
    rerender(<Wrapper />);

    expect(screen.getByRole('slider')).toHaveValue('0.45');
  });

  it("does not let a pending drag's stale trailing emission undo a Reset pressed moments later (the Reset/throttle race)", () => {
    const changeTrackVolume = vi.fn();
    render(<VolumeSliderContainer pillar={1} />, {
      wrapper: withAbletonContext(
        buildContextValue({ trackVolume: [0, 0.1, 0, 0], changeTrackVolume }),
      ),
    });

    const slider = screen.getByRole('slider');
    // Leading edge fires immediately; the second change is queued as a
    // pending trailing call still waiting inside the throttle window.
    fireEvent.change(slider, { target: { value: '0.2' } });
    fireEvent.change(slider, { target: { value: '0.3' } });
    expect(changeTrackVolume).toHaveBeenCalledTimes(1);

    // Reset pressed before that pending 0.3 would have fired.
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 1, volume: 0.6 });

    // The stale pending drag value must never fire afterward.
    vi.advanceTimersByTime(1000);

    expect(changeTrackVolume).toHaveBeenCalledTimes(2);
    expect(changeTrackVolume).toHaveBeenLastCalledWith({ pillar: 1, volume: 0.6 });
    expect(slider).toHaveValue('0.6');
  });

  it('does not let a stale leading-edge echo snap the display backward while the user is still dragging', () => {
    const changeTrackVolume = vi.fn();
    let currentValue = buildContextValue({ trackVolume: [0.1, 0, 0, 0], changeTrackVolume });
    function Wrapper() {
      return (
        <AbletonContext.Provider value={currentValue}>
          <VolumeSliderContainer pillar={0} />
        </AbletonContext.Provider>
      );
    }

    const { rerender } = render(<Wrapper />);
    const slider = screen.getByRole('slider');

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '0.2' } }); // leading edge: 0.2
    fireEvent.change(slider, { target: { value: '0.5' } }); // user keeps dragging past it
    expect(slider).toHaveValue('0.5');

    // The leading edge's own broadcast echo (volume_changed: 0.2) lands
    // back in context while the pointer is still down.
    currentValue = buildContextValue({ trackVolume: [0.2, 0, 0, 0], changeTrackVolume });
    rerender(<Wrapper />);

    // Must NOT snap back to the stale 0.2 echo while still dragging.
    expect(slider).toHaveValue('0.5');

    fireEvent.pointerUp(slider);

    // Once released, a genuinely new external change still syncs normally.
    currentValue = buildContextValue({ trackVolume: [0.65, 0, 0, 0], changeTrackVolume });
    rerender(<Wrapper />);

    expect(slider).toHaveValue('0.65');
  });
});
