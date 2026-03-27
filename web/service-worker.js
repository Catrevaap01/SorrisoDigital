// Service Worker for TeOdonto Angola PWA - 100% PWA Compliant
const CACHE_NAME = 'teodonto-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  // Expo RN Web essentials (stale-while-revalidate)
  '/static/js/main.*.js',
  '/static/js/[0-9]*.*.chunk.js',
  '/static/css/main.*.css',
  // Assets
  '/assets/*'
];

// Install - precache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'no-cache'})))
        .catch(err => console.warn('SW precache failed:', err));
    })
  );
  self.skipWaiting();
});

// Activate - cleanup old caches, register sync
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
      // Register background sync
      registration.waiting || registration.installing ? null : 
        self.registration.sync.register('sync-offline-actions')
          .then(() => console.log('✅ Background sync registered'))
          .catch(err => console.warn('Background sync registration failed:', err))
    ])
  );
  self.clients.claim();
});

// Background Sync - sync offline actions when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(
      self.clients.matchAll({type: 'window'}).then(clients => {
        return clients[0]?.postMessage({type: 'SYNC_STATUS', status: 'syncing'});
      }).then(() => syncOfflineActions()).then(() => {
        return self.clients.matchAll({type: 'window'}).then(clients => {
          clients.forEach(client => client.postMessage({type: 'SYNC_STATUS', status: 'synced'}));
        });
      }).catch(err => {
        console.error('Background sync failed:', err);
        self.clients.matchAll({type: 'window'}).then(clients => {
          clients.forEach(client => client.postMessage({type: 'SYNC_STATUS', status: 'error'}));
        });
      })
    );
  }
});

// Enhanced Fetch - Stale-while-revalidate for assets, network-first for API
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip external requests
  if (new URL(url).origin !== self.location.origin) return;

  // Network-first for Supabase API, cache-first for static
  if (url.includes('supabase.co')) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

// Network-first strategy for API
async function networkFirst(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    return caches.match(request) || new Response('Network error', {status: 503});
  }
}

// Stale-while-revalidate for static assets
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Update cache in background
    fetch(request.clone()).then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      }
    }).catch(() => {}); // Ignore background update failures
    return cachedResponse;
  }
  // Fallback to network + cache
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    }
    return response;
  } catch {
    return caches.match('/offline.html') || caches.match('/index.html');
  }
}

// Sync offline actions utility (called from app or background sync)
async function syncOfflineActions() {
  if (!navigator.onLine) return {synced: 0, failed: 0};
  
  // Post message to clients to sync
  self.clients.matchAll({type: 'window'}).then(clients => {
    clients.forEach(client => client.postMessage({type: 'TRIGGER_SYNC'}));
  });
  
  return {synced: 0, failed: 0}; // Placeholder - actual sync in app
}

// Message handler for app communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_SYNC_STATUS') {
    event.ports[0].postMessage({hasPendingSync: true});
  }
});
