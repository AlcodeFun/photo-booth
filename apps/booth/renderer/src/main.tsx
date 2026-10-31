import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { startUploadWatcher } from './lib/uploadJob';
import { startPrintListener } from './lib/printListener';
import { startPrintQueueSync, startAutoQueueSync } from './lib/printQueueSync';
import { useBoothAppearance } from './store/appearanceStore';
import './index.css';
import { startBoothSettingsSync } from './lib/boothSettings';

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

// "Add to Home Screen" opens the manifest's start_url. The shared manifest
// starts at the booth root, so the admin gets its own (start_url /admin), and
// the organize page drops the manifest: its link carries the guest's token,
// which no static start_url can, and without a manifest iOS saves the current URL.
const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
if (isOrganizePath) {
  manifestLink?.remove();
} else if (isAdminWindow && manifestLink) {
  manifestLink.href = '/manifest-admin.webmanifest';
}

if (!isOrganizePath && !isAdminWindow) {
  // Owns background gallery uploads independently of any mounted screen, so they
  // keep running after the customer leaves the session (store-level, not React).
  startUploadWatcher();
  // Mirrors the admin's global access / print mode into this device's config.
  startBoothSettingsSync();
  // Owns the main-process print queue bridge: resolves framed images for jobs
  // just-in-time and mirrors job state onto each session's print_status.
  startPrintQueueSync();
}

// Flow 2 prints: takes the prints guests' phones generated into the queue, and
// generates them here when a phone could not. Runs in the booth AND the admin
// window, so the booth screen does not have to stay open (a request is claimed
// with status 'processing', so two windows never render the same one).
if (!isOrganizePath) {
  startPrintListener();
}

// Auto-queues ready_to_print sessions once their framed sheet exists — no
// manual "Add to queue" staging. Runs in BOTH the booth window and the admin
// window so the queue fills even when the operator only has the dashboard
// open; the main-process PrintQueue dedupes by token, so concurrent sweeps in
// both windows can never double-enqueue a session.
if (!isOrganizePath) {
  startAutoQueueSync();
}

// Booth appearance (admin-editable theme/copy/background). The cached copy is
// already applied synchronously by the store; this refreshes it from Supabase in
// the background. Also runs in the admin window so its live preview is accurate,
// and on the organize page so the guest sees the theme saved in the dashboard.
void useBoothAppearance.getState().loadAppearance();

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
    // Root-absolute over http(s): './sw.js' would resolve against nested routes
    // (/admin/sesi -> /admin/sw.js) and register a second, /admin-scoped worker.
    const swUrl = location.protocol.startsWith('http') ? '/sw.js' : './sw.js';
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Service workers are unavailable on file:// (Electron) - safe to ignore.
    });
  });
}
