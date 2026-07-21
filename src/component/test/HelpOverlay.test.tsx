import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { HelpOverlay } from '~/component/HelpOverlay';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// uses internally (same stub pattern as DebugModalContainer.test.tsx /
// PlayScreen.test.tsx).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

describe('HelpOverlay', () => {
  it('renders nothing when closed', () => {
    const { queryByRole } = render(<HelpOverlay open={false} onClose={vi.fn()} />);
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with all five callouts and their copy when open', () => {
    const { getByRole, getByText } = render(<HelpOverlay open onClose={vi.fn()} />);

    expect(getByRole('dialog', { name: 'Help' })).toBeInTheDocument();
    expect(
      getByText('Place an ingredient upon a pillar and its voice joins the spell ✦'),
    ).toBeInTheDocument();
    expect(getByText('Stroke the potion tube to tame or unleash its voice')).toBeInTheDocument();
    expect(
      getByText('Tap the cauldron — it loves attention (and makes noises)'),
    ).toBeInTheDocument();
    expect(
      getByText('The lower grimoire bends time and key — twist the tempo, raise the pitch'),
    ).toBeInTheDocument();
    expect(getByText('Deeper magicks hide behind the Settings sigil')).toBeInTheDocument();
  });

  it('closes via the explicit ✕ close button', () => {
    const onClose = vi.fn();
    const { getByRole } = render(<HelpOverlay open onClose={onClose} />);

    fireEvent.click(getByRole('button', { name: 'Close help' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('closes via tapping the scrim', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<HelpOverlay open onClose={onClose} />);

    fireEvent.click(getByTestId('help-scrim'));

    expect(onClose).toHaveBeenCalled();
  });

  it('closes via Escape', () => {
    const onClose = vi.fn();
    const { getByRole } = render(<HelpOverlay open onClose={onClose} />);

    fireEvent.keyDown(getByRole('dialog', { name: 'Help' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
