const CACHE_NAME = 'wsjj-kanji-pro-v14-1';
const BASE = new URL('./', self.location.href);
const DB_URL = new URL('./data/kanji_quiz_database.json', BASE).href;
const UI_URL = new URL('./data/ui.pl.json', BASE).href;
const FRESH_URLS = new Set([
  DB_URL,
  UI_URL,
  new URL('./index.html', BASE).href,
  new URL('./js/app.js', BASE).href,
  new URL('./css/styles.css', BASE).href,
  new URL('./manifest.webmanifest', BASE).href
]);
const PRECACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './data/kanji_quiz_database.json',
  './data/ui.pl.json',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Mutable app files and database: network first so new chapters/code appear
  // on the first launch after deployment; cached copies remain the offline fallback.
  if (FRESH_URLS.has(url.href)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Navigation: network first, cached app shell offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(new URL('./index.html', BASE).href))
    );
    return;
  }

  // Static assets: cache first with background refresh.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
