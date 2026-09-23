import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { startUploadWatcher } from './lib/uploadJob';
import { startPrintListener } from './lib/printListener';
import './index.css';

// The hosted arrange page (/organize/:token) is a stateless customer screen —
// no booth session, upload job, or print listener should ever boot there, and
// no service worker either (it re-fetches fresh state every visit; a cached
// shell would serve stale/poisoned responses after SPA-rewrite mishaps).
const isOrganizePath =
  window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean)[0] === 'organize';

if (!isOrganizePath) {
  // Owns background gallery uploads independently of any mounted screen, so they
  // keep running after the customer leaves the session (store-level, not React).
  startUploadWatcher();
  // Listens for arrangement requests the gallery customer makes after arranging
  // their timed-flow photos onto the frame slots, then generates + uploads the
  // framed outputs (the admin prints framed.png from the dashboard).
  startPrintListener();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isOrganizePath) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      if (caches?.keys) {
        caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
      return;
    }
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service workers are unavailable on file:// (Electron) - safe to ignore.
    });
  });
}
