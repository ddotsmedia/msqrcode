const CACHE_NAME = 'milestones-v1';
const ASSETS_TO_CACHE = ['/index.html'];

// Precache app shell on install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Network-first for navigations, cache-first for assets, never cache /api/
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never cache API requests
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request));
    return;
  }

  // Cache-first for static assets
  if (request.method === 'GET' && /\.(js|css|png|jpg|svg|woff|woff2)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((r) => {
        if (r) return r;
        return fetch(request).then((resp) => {
          const cache_resp = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cache_resp));
          return resp;
        });
      })
    );
    return;
  }

  // Network-first for navigations, fallback to shell
  e.respondWith(
    fetch(request)
      .then((r) => {
        if (r.status === 200) {
          const cache_resp = r.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cache_resp));
          return r;
        }
        return caches.match(request);
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
  );
});
