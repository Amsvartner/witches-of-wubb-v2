import { render } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { MainScreen } from '~/screen/MainScreen';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { SocketContext } from '~/context/SocketContext';

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
});
