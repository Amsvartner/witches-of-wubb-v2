import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { InstallationPage } from '~/page/InstallationPage';
import { SocketProvider } from '~/context/SocketProvider';
import { AbletonProvider } from '~/context/AbletonProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SocketProvider>
      <AbletonProvider>
        <InstallationPage />
      </AbletonProvider>
    </SocketProvider>
  </StrictMode>,
);
