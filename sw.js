/**
 * LA SOFT AI — sw.js
 * ------------------------------------------------------------
 * Caches only the app shell (HTML/CSS/JS/logo) so the interface
 * itself loads offline. This is intentionally separate from the
 * AI model cache, which WebLLM manages on its own.
 * ------------------------------------------------------------
 */
const CACHE_NAME = 'lasoft-ai-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/llm.js',
  './js/storage.js',
  './js/share.js',
  './js/memory-extract.js',
  './assets/la-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GET requests for the app shell.
  // Everything else (model downloads, fonts) passes straight through.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
