import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { MainScreen } from '~/screen/MainScreen';
import { PlayScreen } from '~/screen/PlayScreen';
import { SocketProvider } from '~/context/SocketProvider';
import { AbletonProvider } from '~/context/AbletonProvider';

// WOW-007A: hash-based demo switch for the play-mode visual-fidelity spike.
// This is a temporary DEV/demo entry only — NOT the mode-routing feature
// (deferred to a follow-up; ADR-005) and NOT a production cutover: the default
// entry below is unchanged, and the switch is dead in production builds.
// Open http://localhost:<port>/#play-spike under `yarn dev` to view the static
// spike (it renders outside the socket/Ableton providers — no live connection).
const isPlaySpike =
  import.meta.env.DEV && window.location.hash.replace(/^#\/?/, '') === 'play-spike';

const app = isPlaySpike ? (
  <PlayScreen />
) : (
  <SocketProvider>
    <AbletonProvider>
      <MainScreen />
    </AbletonProvider>
  </SocketProvider>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>{app}</StrictMode>,
);
