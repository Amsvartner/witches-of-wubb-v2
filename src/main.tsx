import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { MainScreen } from '~/screen/MainScreen';
import { PlayScreen } from '~/screen/PlayScreen';
import { SocketProvider } from '~/context/SocketProvider';
import { AbletonProvider } from '~/context/AbletonProvider';
import { AppErrorBoundary } from '~/component/AppErrorBoundary';

// WOW-007B production cutover: the live-wired play-mode screen is now the
// default entry. The legacy MainScreen UI is kept as an emergency show-day
// fallback behind the `#legacy` hash (not gated on DEV — it must work in the
// production build too) and should be removed once the new UI has run a show.
const isLegacy = window.location.hash.replace(/^#\/?/, '') === 'legacy';

// The hash is only read once, above — typing "#legacy" into the address bar of
// the RUNNING app fires a hashchange but no page load, so nothing would switch
// until some unrelated reload happened minutes later (human bug report
// 2026-07-20). Reload on every hash change so the fallback switch is instant.
window.addEventListener('hashchange', () => {
  window.location.reload();
});

// The boundary wraps the PROVIDERS too: a crash anywhere in the tree shows
// the themed recovery screen instead of a bare black page (WOW-007D — a
// kiosk has no one watching the console).
const app = (
  <AppErrorBoundary>
    <SocketProvider>
      <AbletonProvider>{isLegacy ? <MainScreen /> : <PlayScreen />}</AbletonProvider>
    </SocketProvider>
  </AppErrorBoundary>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>{app}</StrictMode>,
);
