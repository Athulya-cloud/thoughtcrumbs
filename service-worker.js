const CACHE_NAME = 'interstitial-journal-v11';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icon.svg',
  './src/app.js',
  './src/db.js',
  './src/filters.js',
  './src/grouping.js',
  './src/capture.js',
  './src/review.js',
  './src/things.js',
  './src/things-view.js',
  './src/picker.js',
  './src/nudge.js',
  './src/days.js',
  './src/calendar.js',
  './src/graph.js',
  './src/pill-import.js',
  './src/recap.js',
  './src/export.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Only the app's own files come from the cache; Focus Pill's local address goes straight through.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
