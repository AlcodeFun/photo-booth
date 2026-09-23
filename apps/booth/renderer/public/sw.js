/* PhotoBooth service worker
 * - Pre-caches the app shell on install
 * - Network-first for navigations (fallback to cached shell when offline)
 * - Cache-first for static assets (hashed by Vite in production)
 * Bump CACHE_NAME whenever you ship a new build so caches refresh.
 */
const CACHE_NAME = 'photobooth-v2';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  // Only treat same-origin requests for real static files as cacheable. A
  // SPA rewrite can answer *any* request with index.html (text/html), and we
  // must never put that HTML into the asset cache for e.g. /organize/:token
  // paths — otherwise future deploys keep serving the poisoned response.
  const looksStatic = /\.(js|css|webmanifest|png|ico|gif|jpe?g|svg|woff2?)$/i.test(url.pathname);
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && looksStatic) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});