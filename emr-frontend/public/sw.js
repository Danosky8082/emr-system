const CACHE_NAME = 'nexgen-emr-v1';

// Install event: activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: clean up any old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Fetch event: Network-First strategy
// This ALWAYS tries to get the latest file from the internet first.
// If the internet is down, it falls back to the cache.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the request is successful, clone it and put it in the cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If the network fails (offline), try to serve from cache
        return caches.match(event.request);
      })
  );
});