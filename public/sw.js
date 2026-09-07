/**
 * Offline-first service worker.
 *
 * The app must work on a trailhead with no signal: the shell is precached on
 * install and served from cache first, while everything else falls back to the
 * network. Run data never goes through here — it lives in IndexedDB.
 *
 * Every path is derived from the worker's own scope rather than hardcoded to
 * "/", so the same file works at the root and under a subpath such as a
 * GitHub Pages project site.
 */
const CACHE = 'mtb-telemetry-v2';
const BASE = new URL('./', self.location).pathname;
const SHELL = [BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One missing entry must not abort the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((path) => cache.add(path))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigations: serve the app shell so deep links work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(`${BASE}index.html`).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          // Only cache our own successful same-origin responses.
          if (response.ok && new URL(request.url).origin === self.location.origin) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
