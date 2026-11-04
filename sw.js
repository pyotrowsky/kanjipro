const CACHE_NAME = 'wsjj-kanji-pro-3.23-9';
const BASE = new URL('./', self.location.href);
const FRESH_PATHS = new Set([
  new URL('./data/kanji_quiz_database.json', BASE).pathname,
  new URL('./data/ui.pl.json', BASE).pathname,
  new URL('./index.html', BASE).pathname,
  new URL('./js/app.js', BASE).pathname,
  new URL('./js/japanese-text.js', BASE).pathname,
  new URL('./js/learning-math.js', BASE).pathname,
  new URL('./js/dictionary-helpers.js', BASE).pathname,
  new URL('./js/quiz-logic.js', BASE).pathname,
  new URL('./js/storage-records.js', BASE).pathname,
  new URL('./js/quiz-focus.js', BASE).pathname,
  new URL('./js/anki-audio.js', BASE).pathname,
  new URL('./js/history-merge.js', BASE).pathname,
  new URL('./js/firebase-sync.js', BASE).pathname,
  new URL('./data/firebase-config.json', BASE).pathname,
  new URL('./css/styles.css', BASE).pathname,
  new URL('./css/shiba-theme.css', BASE).pathname,
  new URL('./css/shiba-dashboard.css', BASE).pathname,
  new URL('./css/shiba-approved.css', BASE).pathname,
  new URL('./manifest.webmanifest', BASE).pathname
]);
function cached(request){return caches.match(request,{ignoreSearch:true})}
const PRECACHE = [
  './',
  './index.html',
  './css/styles.css',
  './css/shiba-theme.css',
  './css/shiba-dashboard.css',
  './css/shiba-approved.css',
  './icons/kanjipro-pastel-banner.png',
  './icons/shiba-face.svg',
  './icons/shiba-study.svg',
  './icons/shiba-peek.svg',
  './icons/shiba-cheer.svg',
  './icons/shiba-paws.svg',
  './icons/shiba-dance.svg',
  './js/app.js',
  './js/japanese-text.js',
  './js/learning-math.js',
  './js/dictionary-helpers.js',
  './js/quiz-logic.js',
  './js/storage-records.js',
  './js/quiz-focus.js',
  './js/anki-audio.js',
  './js/history-merge.js',
  './js/firebase-sync.js',
  './data/firebase-config.json',
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
