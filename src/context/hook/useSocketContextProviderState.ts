import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Logger } from '~/util/Logger';

/* This may seem contrived, but the conventional React pattern is to keep the provider and state + subscriptions separate,
 as to keep single responsibility for each and allow for unit testing state & subscriptions in isolation without having
 to render the component tree and reaching state via consumers. // Vidar
 */
export const useSocketContextProviderState = (): Socket => {
  const [socket, setSocket] = useState<Socket>({} as Socket);

  useEffect(() => {
    if (!socket.connected) {
      const sock = io(
        `${import.meta.env.VITE_WS_SERVER_ADDRESS}:${import.meta.env.VITE_WS_SERVER_PORT}`,
      );

      sock.on('connect', () => {
        setSocket(sock);
        Logger.debug('Connected to socket.io server');
      });
      sock.onAny((event, ...args) => {
        Logger.debug(`${event} received with:`, args);
      });
    }
  }, [socket.connected]);

  return socket;
};
