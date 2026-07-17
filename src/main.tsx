import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { MainScreen } from '~/screen/MainScreen';
import { PlayScreen } from '~/screen/PlayScreen';
import { SocketProvider } from '~/context/SocketProvider';
import { AbletonProvider } from '~/context/AbletonProvider';

// WOW-007B production cutover: the live-wired play-mode screen is now the
// default entry. The legacy MainScreen UI is kept as an emergency show-day
// fallback behind the `#legacy` hash (not gated on DEV — it must work in the
// production build too) and should be removed once the new UI has run a show.
const isLegacy = window.location.hash.replace(/^#\/?/, '') === 'legacy';

const app = (
  <SocketProvider>
    <AbletonProvider>{isLegacy ? <MainScreen /> : <PlayScreen />}</AbletonProvider>
  </SocketProvider>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>{app}</StrictMode>,
);
