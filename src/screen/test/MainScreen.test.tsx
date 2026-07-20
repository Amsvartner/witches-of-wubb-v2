import { fireEvent, render } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { MainScreen } from '~/screen/MainScreen';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { SocketContext } from '~/context/SocketContext';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// (the debug modal, once opened) uses internally — same stub pattern as
// DebugModalContainer.test.tsx / PlayScreen.test.tsx.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const abletonStub: AbletonContextState = {
  getTracksAndClips: () => {},
  changeTempo: () => {},
  changeTrackVolume: () => {},
  tempo: 120,
  trackVolume: [],
  queuedClips: [],
  playingClips: [],
  stoppingClips: [],
  clipTempo: [],
  masterKey: '',
  changeMasterKey: () => {},
  keylock: true,
  changeKeylock: () => {},
  // WOW-007C
  triggerCauldronSample: () => {},
  cauldronVolume: 0.6,
  changeCauldronVolume: () => {},
  idleTimeout: { enabled: true, timeoutMs: 3 * 60 * 1000 },
  changeIdleTimeout: () => {},
};

const TestProviders = ({ children }: PropsWithChildren) => (
  <SocketContext.Provider value={{} as Socket}>
    <AbletonContext.Provider value={abletonStub}>{children}</AbletonContext.Provider>
  </SocketContext.Provider>
);

describe('MainScreen', () => {
  it('renders the cauldron centerpiece', () => {
    const { getByTestId } = render(<MainScreen />, { wrapper: TestProviders });

    expect(getByTestId('cauldron')).toBeInTheDocument();
  });

  // WOW-007D: RecipeBoxContainer (+ its invisible hidden-gesture trigger
  // button) is removed per the confirmed design direction (UX_UI_PRINCIPLES:
  // "Recipe suggestions AND random spell names removed entirely").
  it('renders no recipe box', () => {
    const { queryByText, container } = render(<MainScreen />, { wrapper: TestProviders });

    expect(queryByText('Suggested Recipe:')).not.toBeInTheDocument();
    expect(container.querySelector('#container_recipe_box')).not.toBeInTheDocument();
  });

  it('renders a visible Debug toggle button, closed by default', () => {
    const { getByRole, queryByRole } = render(<MainScreen />, { wrapper: TestProviders });

    const debugButton = getByRole('button', { name: 'Debug' });
    expect(debugButton).toHaveAttribute('aria-pressed', 'false');
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the debug modal on click, reflected via aria-pressed', () => {
    const { getByRole } = render(<MainScreen />, { wrapper: TestProviders });

    fireEvent.click(getByRole('button', { name: 'Debug' }));

    expect(getByRole('dialog')).toBeInTheDocument();
    // `hidden: true`: Headless UI's Dialog marks the rest of the page inert
    // (aria-hidden) while open for focus containment, so the trigger button
    // itself drops out of the accessibility tree — same pattern as
    // PillarCardContainer.test.tsx's post-Apply pending-row queries.
    expect(getByRole('button', { name: 'Debug', hidden: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('closes the debug modal on a second click', () => {
    const { getByRole, queryByRole } = render(<MainScreen />, { wrapper: TestProviders });

    fireEvent.click(getByRole('button', { name: 'Debug' }));
    expect(getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'Debug', hidden: true }));
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });
});
