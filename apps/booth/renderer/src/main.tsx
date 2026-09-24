import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { startUploadWatcher } from './lib/uploadJob';
import { startPrintListener } from './lib/printListener';
import { startPrintQueueSync } from './lib/printQueueSync';
import './index.css';

// The hosted arrange page (/organize/:token) is a stateless customer screen —
// no booth session, upload job, or print listener should ever boot there, and
// no service worker either (it re-fetches fresh state every visit; a cached
// shell would serve stale/poisoned responses after SPA-rewrite mishaps).
const isOrganizePath =
  window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean)[0] === 'organize';

// The dev admin window opens directly on /#/admin. It is a control surface
// only — the booth window owns uploads, gallery polling and print resolution,
// so skip the background watchers here to avoid doing everything twice.
const isAdminWindow =
  window.location.hash.startsWith('#/admin') ||
  window.location.pathname.replace(/\/+$/, '').startsWith('/admin');

if (!isOrganizePath && !isAdminWindow) {
  // Owns background gallery uploads independently of any mounted screen, so they
  // keep running after the customer leaves the session (store-level, not React).
  startUploadWatcher();
  // Listens for arrangement requests the gallery customer makes after arranging
  // their timed-flow photos onto the frame slots, then generates + uploads the
  // framed outputs (the admin queues framed.png from the Print Queue).
  startPrintListener();
  // Owns the main-process print queue bridge: resolves framed images for jobs
  // just-in-time and mirrors job state onto each session's print_status.
  startPrintQueueSync();
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
