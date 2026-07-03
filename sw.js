const CACHE_NAME = 'stretching-timer-v1';
const ASSETS = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icon.svg'
];

// Install event - cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
// Fetch event - network first with cache fallback
self.addEventListener('fetch', (e) => {
  // Share Target GET requests 등 쿼리스트링 파라미터는 캐싱 없이 통과
  if (e.request.url.includes('index.html?')) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
