import { renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { SocketContext } from '~/context/SocketContext';
import { useSocketContext } from '~/context/hook/useSocketContext';

describe('useSocketContext', () => {
  it('throws when used outside a SocketProvider', () => {
    expect(() => renderHook(() => useSocketContext())).toThrow(
      'useSocketContext must be used within a SocketProvider',
    );
  });

  it('returns the socket when a provider is present', () => {
    const socketStub = {} as Socket;
    const wrapper = ({ children }: PropsWithChildren) => (
      <SocketContext.Provider value={socketStub}>{children}</SocketContext.Provider>
    );
    const { result } = renderHook(() => useSocketContext(), { wrapper });

    expect(result.current).toBe(socketStub);
  });
});
