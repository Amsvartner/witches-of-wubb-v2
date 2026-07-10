import { FC, PropsWithChildren } from 'react';
import { SocketContext } from '~/context/SocketContext';
import { useSocketContextProviderState } from '~/context/hook/useSocketContextProviderState';

export const SocketProvider: FC<PropsWithChildren> = ({ children }) => {
  const socket = useSocketContextProviderState();

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};
