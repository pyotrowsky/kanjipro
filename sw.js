const CACHE_NAME = 'wsjj-kanji-pro-3.8-1';
const BASE = new URL('./', self.location.href);
const FRESH_PATHS = new Set([
  new URL('./data/kanji_quiz_database.json', BASE).pathname,
  new URL('./data/ui.pl.json', BASE).pathname,
  new URL('./index.html', BASE).pathname,
  new URL('./js/app.js', BASE).pathname,
  new URL('./css/styles.css', BASE).pathname,
  new URL('./manifest.webmanifest', BASE).pathname
]);
function cached(request){return caches.match(request,{ignoreSearch:true})}
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

  // KanjiVG SVGs are fetched lazily and cached only after the user opens a kanji.
  if (
    url.hostname === 'raw.githubusercontent.com' &&
    url.pathname.startsWith('/KanjiVG/kanjivg/70a0b7ae0c18ceb5cb358274b029cce0234a43bc/kanji/')
  ) {
    event.respondWith(
      cached(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
          }
          return response;
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Mutable app files and database: network first so new chapters/code appear
  // on the first launch after deployment; cached copies remain the offline fallback.
  if (FRESH_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached(event.request))
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
        .catch(() => cached(new URL('./index.html', BASE).href))
    );
    return;
  }

  // Static assets: cache first with background refresh.
  event.respondWith(
    cached(event.request).then(cachedResponse => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cachedResponse);
      return cachedResponse || network;
    })
  );
});
