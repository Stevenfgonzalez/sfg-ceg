// Service Worker for CEG (Community Emergency Guide)
// Strategy: Cache-first for static assets, network-first for API routes
// FCC data caching for offline EMS access

const CACHE_NAME = 'ceg-v2';
const FCC_DATA_CACHE = 'fcc-data-v1';
const FCC_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours (matches session TTL)

const STATIC_ASSETS = [
  '/',
  '/checkin',
  '/ems',
  '/help',
  '/reunify',
  '/shelter',
  '/stuck',
  '/skills',
  '/fcc',
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
        keys
          .filter((key) => key !== CACHE_NAME && key !== FCC_DATA_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_FCC_CACHE') {
    caches.delete(FCC_DATA_CACHE);
  }
});

// Check if a cached FCC response is still valid (within 4-hour TTL)
async function getCachedFccData(request) {
  const cache = await caches.open(FCC_DATA_CACHE);
  const cachedResponse = await cache.match(request);
  if (!cachedResponse) return null;

  const cachedTime = cachedResponse.headers.get('X-FCC-Cached-At');
  if (cachedTime) {
    const age = Date.now() - parseInt(cachedTime, 10);
    if (age > FCC_CACHE_TTL) {
      await cache.delete(request);
      return null;
    }
  }

  // Return with offline header
  const headers = new Headers(cachedResponse.headers);
  headers.set('X-FCC-Offline', 'true');
  return new Response(cachedResponse.body, {
    status: cachedResponse.status,
    statusText: cachedResponse.statusText,
    headers,
  });
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // FCC unlock POST — network-first with offline fallback from cache
  if (url.pathname.match(/^\/api\/fcc\/[^/]+\/unlock$/) && event.request.method === 'POST') {
    event.respondWith(
      fetch(event.request.clone())
        .then(async (response) => {
          // Cache successful unlock responses
          if (response.ok) {
            const cache = await caches.open(FCC_DATA_CACHE);
            const cloned = response.clone();
            const body = await cloned.text();
            const headers = new Headers(cloned.headers);
            headers.set('X-FCC-Cached-At', String(Date.now()));
            const cachedResp = new Response(body, {
              status: cloned.status,
              statusText: cloned.statusText,
              headers,
            });
            await cache.put(event.request, cachedResp);
          }
          return response;
        })
        .catch(async () => {
          // Offline — try cache
          const cached = await getCachedFccData(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Offline and no cached data' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // Other API routes — network only
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
