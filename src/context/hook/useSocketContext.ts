import { useContext } from 'react';
import { Socket } from 'socket.io-client';
import { SocketContext } from '~/context/SocketContext';

export const useSocketContext = (): Socket => {
  const state = useContext(SocketContext);

  if (!state) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }

  return state;
};
