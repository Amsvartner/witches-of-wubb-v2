import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { SettingsModal } from '~/component/SettingsModal';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// uses internally (same stub pattern as DebugModalContainer.test.tsx).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// djActive true by default: most tests exercise the DJ-only sections
// (cauldron loudness / pause music / DJ auto-exit), which only render for a
// DJ (WOW-007C human safety decision 2026-07-20).
const defaultProps = {
  open: true,
  onClose: vi.fn(),
  mode: 'play' as const,
  onModeChange: vi.fn(),
  djActive: true,
  animationsEnabled: true,
  onAnimationsEnabledChange: vi.fn(),
  cauldronVolume: 0.42,
  onCauldronVolumeChange: vi.fn(),
  idleTimeout: { enabled: true, timeoutMs: 3 * 60 * 1000 },
  onIdleTimeoutChange: vi.fn(),
  djAutoExitMs: 5 * 60 * 1000,
  onDjAutoExitMsChange: vi.fn(),
};

describe('SettingsModal (WOW-007C)', () => {
  describe('DJ gating (human safety decision 2026-07-20)', () => {
    it('hides cauldron loudness, pause music, and DJ auto-exit when djActive is false (visitor view)', () => {
      const { queryByText, queryByRole, getByText, getByRole } = render(
        <SettingsModal {...defaultProps} djActive={false} />,
      );

      expect(queryByText('Cauldron loudness')).not.toBeInTheDocument();
      expect(queryByRole('slider', { name: 'Cauldron loudness' })).not.toBeInTheDocument();
      expect(queryByText('Pause music')).not.toBeInTheDocument();
      expect(queryByText('DJ auto-exit')).not.toBeInTheDocument();

      // Visitors keep Mode + Animations.
      expect(getByText('Mode')).toBeInTheDocument();
      expect(getByRole('button', { name: 'Animations' })).toBeInTheDocument();
    });

    it('shows all three sections when djActive is true', () => {
      const { getByText } = render(<SettingsModal {...defaultProps} djActive />);

      expect(getByText('Cauldron loudness')).toBeInTheDocument();
      expect(getByText('Pause music')).toBeInTheDocument();
      expect(getByText('DJ auto-exit')).toBeInTheDocument();
    });
  });

  it('renders all three new sections: cauldron loudness, pause music, DJ auto-exit', () => {
    const { getByText, getByRole } = render(<SettingsModal {...defaultProps} />);

    expect(getByText('Cauldron loudness')).toBeInTheDocument();
    expect(getByRole('slider', { name: 'Cauldron loudness' })).toBeInTheDocument();

    expect(getByText('Pause music')).toBeInTheDocument();
    expect(getByRole('button', { name: 'Pause music' })).toBeInTheDocument();
    expect(
      getByText(
        'After this long without interaction, all pillars stop and the pause music takes over.',
      ),
    ).toBeInTheDocument();

    expect(getByText('DJ auto-exit')).toBeInTheDocument();
    expect(
      getByText('DJ mode returns to play mode after this long without touches.'),
    ).toBeInTheDocument();
  });

  it('shows the cauldron volume mapped to a 0-100% slider (0.42 / 0.7 ceiling)', () => {
    const { getByRole } = render(<SettingsModal {...defaultProps} />);
    const slider = getByRole('slider', { name: 'Cauldron loudness' });
    expect(slider).toHaveValue('60'); // round(0.42 / 0.7 * 100) = 60
  });

  it('emits the mapped raw volume (0..0.7) when the slider changes', () => {
    const onCauldronVolumeChange = vi.fn();
    const { getByRole } = render(
      <SettingsModal {...defaultProps} onCauldronVolumeChange={onCauldronVolumeChange} />,
    );

    fireEvent.change(getByRole('slider', { name: 'Cauldron loudness' }), {
      target: { value: '100' },
    });

    expect(onCauldronVolumeChange).toHaveBeenCalledWith(0.7);
  });

  it('toggling pause music calls onIdleTimeoutChange with enabled flipped, timeoutMs unchanged', () => {
    const onIdleTimeoutChange = vi.fn();
    const { getByRole } = render(
      <SettingsModal
        {...defaultProps}
        idleTimeout={{ enabled: true, timeoutMs: 120000 }}
        onIdleTimeoutChange={onIdleTimeoutChange}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Pause music' }));

    expect(onIdleTimeoutChange).toHaveBeenCalledWith({ enabled: false, timeoutMs: 120000 });
  });

  it('picking a pause-music minutes choice calls onIdleTimeoutChange with the new duration', () => {
    const onIdleTimeoutChange = vi.fn();
    const { getByRole } = render(
      <SettingsModal {...defaultProps} onIdleTimeoutChange={onIdleTimeoutChange} />,
    );

    fireEvent.click(getByRole('button', { name: 'Pause music after 10 min' }));

    expect(onIdleTimeoutChange).toHaveBeenCalledWith({ enabled: true, timeoutMs: 10 * 60 * 1000 });
  });

  it('marks the current pause-music duration as pressed', () => {
    const { getByRole } = render(
      <SettingsModal {...defaultProps} idleTimeout={{ enabled: true, timeoutMs: 3 * 60 * 1000 }} />,
    );
    expect(getByRole('button', { name: 'Pause music after 3 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('disables the pause-music minutes buttons when the toggle is off', () => {
    const { getByRole } = render(
      <SettingsModal {...defaultProps} idleTimeout={{ enabled: false, timeoutMs: 60000 }} />,
    );
    expect(getByRole('button', { name: 'Pause music after 1 min' })).toBeDisabled();
  });

  it('picking a DJ auto-exit minutes choice calls onDjAutoExitMsChange (persistence lives in the caller)', () => {
    const onDjAutoExitMsChange = vi.fn();
    const { getByRole } = render(
      <SettingsModal {...defaultProps} onDjAutoExitMsChange={onDjAutoExitMsChange} />,
    );

    fireEvent.click(getByRole('button', { name: 'DJ auto-exit after 30 min' }));

    expect(onDjAutoExitMsChange).toHaveBeenCalledWith(30 * 60 * 1000);
  });

  it('marks the current DJ auto-exit duration as pressed', () => {
    const { getByRole } = render(<SettingsModal {...defaultProps} djAutoExitMs={10 * 60 * 1000} />);
    expect(getByRole('button', { name: 'DJ auto-exit after 10 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
