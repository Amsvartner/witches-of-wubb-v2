import { fireEvent, render } from '@testing-library/react';
import { PlayScreen } from '~/screen/PlayScreen';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// uses internally (same stub pattern as DebugModalContainer.test.tsx).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

describe('PlayScreen (WOW-007A play-mode spike)', () => {
  it('renders the ceremonial wordmark as the single h1', () => {
    const { getByRole } = render(<PlayScreen />);
    expect(getByRole('heading', { level: 1, name: 'HEXOLOGY' })).toBeInTheDocument();
  });

  it('renders the cauldron centrepiece as a clickable control', () => {
    // The wireframe marks the cauldron clickable (random SFX when wired).
    const { getByRole } = render(<PlayScreen />);
    expect(getByRole('button', { name: 'Cauldron' })).toBeInTheDocument();
  });

  it('renders four pillars headed by the four categories', () => {
    const { getByRole, getAllByText } = render(<PlayScreen />);
    // Category names are the card headings (pillar names removed 2026-07-17).
    ['VOCALS', 'MELODY', 'BASS', 'DRUMS'].forEach((name) => {
      expect(getByRole('heading', { level: 2, name })).toBeInTheDocument();
      // Each category name also appears again in the legend.
      expect(getAllByText(name).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('opens the Settings modal with the animations kill-switch', () => {
    const { getByRole, queryByRole } = render(<PlayScreen />);
    expect(queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /settings/i }));
    expect(getByRole('dialog')).toBeInTheDocument();

    const toggle = getByRole('button', { name: 'Animations' });
    // The Animations kill-switch is the one wired control — it stays enabled.
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes a disabled Help affordance and an enabled Settings control', () => {
    // Settings opens the modal (wired); Help has no content yet, so it is a
    // real disabled button rather than a focusable no-op (WOW-007A).
    const { getByRole } = render(<PlayScreen />);
    expect(getByRole('button', { name: /help/i })).toBeDisabled();
    expect(getByRole('button', { name: /settings/i })).toBeEnabled();
  });

  it('renders the settings band with static (disabled) key + auto-adjust controls', () => {
    // The tempo/key band is display-only in the spike: its controls are real
    // disabled buttons until wired in a follow-up ticket.
    const { getByText, getByRole } = render(<PlayScreen />);
    expect(getByText('130')).toBeInTheDocument();
    expect(getByRole('button', { name: /raise/i })).toBeDisabled();
    expect(getByRole('button', { name: /lower/i })).toBeDisabled();
    expect(getByRole('button', { name: /reset/i })).toBeDisabled();
    expect(getByRole('button', { name: /auto-adjust key/i })).toBeDisabled();
  });

  it('renders the sample-type legend', () => {
    const { getByText } = render(<PlayScreen />);
    expect(getByText(/sample types/i)).toBeInTheDocument();
  });
});
