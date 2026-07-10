import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { InstallationPage } from '~/page/InstallationPage';
import { SocketioProvider } from '~/context/SocketioProvider';
import { AbletonProvider } from '~/context/AbletonProvider';
import { LoggerProvider } from '~/context/LoggerProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <LoggerProvider>
      <SocketioProvider>
        <AbletonProvider>
          <InstallationPage />
        </AbletonProvider>
      </SocketioProvider>
    </LoggerProvider>
  </StrictMode>,
);
