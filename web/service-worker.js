/**
 * Service Worker - TeOdonto Angola PWA
 *
 * Static app shell: cache first.
 * Supabase REST GET: network first, cache fallback.
 * Images: stale while revalidate.
 */

const CACHE_VERSION = 'v3.0.0';
const CACHE_STATIC = `teodonto-static-${CACHE_VERSION}`;
const CACHE_IMAGES = `teodonto-images-${CACHE_VERSION}`;
const CACHE_API = `teodonto-api-${CACHE_VERSION}`;
const GENERATED_PRECACHE_ASSETS = self.__TEODONTO_PRECACHE_ASSETS__ || [];

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  ...GENERATED_PRECACHE_ASSETS,
].filter((asset, index, list) => list.indexOf(asset) === index);

const NETWORK_ONLY_PATTERNS = [
  /resend\.com/,
  /\/auth\//,
  /\.hot-update\./,
];

const API_CACHE_PATTERNS = [
  /supabase\.co\/rest\/v1\//,
];

const IMAGE_PATTERNS = [
  /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith('teodonto-') &&
              name !== CACHE_STATIC &&
              name !== CACHE_IMAGES &&
              name !== CACHE_API
          )
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(request.url))) return;

  if (API_CACHE_PATTERNS.some((pattern) => pattern.test(request.url))) {
    event.respondWith(networkFirst(request, CACHE_API));
    return;
  }

  if (IMAGE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    return;
  }

  event.respondWith(cacheFirstWithOfflineFallback(request));
});

async function cacheFirstWithOfflineFallback(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
      return caches.match('/index.html');
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ error: 'Offline e sem dados em cache para este recurso.' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'TeOdonto Angola', {
        body: data.body || 'Tem uma nova notificacao.',
        icon: '/assets/icon.png',
        badge: '/assets/favicon.png',
        tag: data.tag || 'teodonto-notification',
        data: { url: data.url || '/' },
      })
    );
  } catch (error) {
    console.warn('[SW] Push notification parse error:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
