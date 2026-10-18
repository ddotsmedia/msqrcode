const CACHE_NAME = 'milestones-v4';
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
  // Only our own hashed build files are cache-first; other sites' files (map tiles, images) go to the network.
  if (request.method === 'GET' && url.origin === self.location.origin && /\.(js|css|png|jpg|svg|woff|woff2)$/.test(url.pathname)) {
    if (!url.pathname.startsWith('/assets/')) {
      // Unhashed files (logo, gallery) can change: network first, cache as fallback.
      e.respondWith(
        fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const copy = resp.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return resp;
          })
          .catch(() => caches.match(request))
      );
      return;
    }
    e.respondWith(
      caches.match(request).then((r) => {
        if (r) return r;
        return fetch(request).then((resp) => {
          if (resp.ok) {
            const cache_resp = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cache_resp));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Network-first for navigations, fallback to shell
  e.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((r) => {
        if (r.status === 200) {
          const cache_resp = r.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cache_resp));
          return r;
        }
        return caches.match(request).then((c) => c || r);
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
  );
});

// Rewards notifications (stamp reminders, double-stamp hours, offers).
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'Milestones Coffee', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Milestones Coffee', {
      body: data.body || '',
      icon: '/logo/logo-180.png',
      badge: '/logo/logo-180.png',
      data: { url: data.url || '/loyalty' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/loyalty';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
