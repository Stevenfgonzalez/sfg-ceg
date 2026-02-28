// Service Worker for CEG (Community Emergency Guide)
// Strategy: Cache-first for static assets, network-first for API routes

const CACHE_NAME = 'ceg-v1';
const STATIC_ASSETS = [
  '/',
  '/checkin',
  '/ems',
  '/help',
  '/reunify',
  '/shelter',
  '/stuck',
  '/skills',
];

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first for pages, network-only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API routes — always network (offline queue handles POST failures client-side)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Static assets and pages — cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached, also update cache in background
        event.waitUntil(
          fetch(event.request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {
            // Offline — cached version is fine
          })
        );
        return cached;
      }

      // Not cached — try network, cache on success
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline and not cached — return offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
