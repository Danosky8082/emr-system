const CACHE_NAME = 'nexgen-emr-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png'
];

// Install event: cache basic assets and force update
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Tells the browser to activate the new SW immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Take control of open pages immediately
});

// Fetch event: serve from cache or network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});