import { renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { useAbletonContext } from '~/context/hook/useAbletonContext';

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
};

describe('useAbletonContext', () => {
  it('throws when used outside an AbletonProvider', () => {
    expect(() => renderHook(() => useAbletonContext())).toThrow(
      'useAbletonContext must be used within an AbletonProvider',
    );
  });

  it('returns the context value when a provider is present', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <AbletonContext.Provider value={abletonStub}>{children}</AbletonContext.Provider>
    );
    const { result } = renderHook(() => useAbletonContext(), { wrapper });

    expect(result.current).toBe(abletonStub);
  });
});
