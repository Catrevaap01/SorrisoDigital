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
const GENERATED_PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html",
  "/_expo/static/js/web/AgendamentoScreen-863a146508df1efa162b0b18c51e18f7.js",
  "/_expo/static/js/web/AnamneseScreen-82848ad0ab1563981669f674e9776656.js",
  "/_expo/static/js/web/AtribuirDentistaAgendamentoScreen-dec2aa85610b01860eaa422269af1441.js",
  "/_expo/static/js/web/AtribuirDentistaScreen-afc032d33137b114a5a0e0641f279635.js",
  "/_expo/static/js/web/CasoDetalheScreen-32ebd8aed28528511011bf45ca81495c.js",
  "/_expo/static/js/web/DentistaRelatorioScreen-f7fecc02aa063cfbd94ef85ba9d4e125.js",
  "/_expo/static/js/web/EducacaoScreen-a90603a0826f05d8c0ab5882c21a311b.js",
  "/_expo/static/js/web/GerirPacientesScreen-677f648d9b9ccd54ef475c14ce91e84a.js",
  "/_expo/static/js/web/HistoricoScreen-dd389a4524fb32ab678d986e58ca5522.js",
  "/_expo/static/js/web/index-55521547b3e8042788bdaf0b9d496012.js",
  "/_expo/static/js/web/PacienteHistoricoScreen-d2218171d3b731488f70b1e3fe8e7b60.js",
  "/_expo/static/js/web/PlanoTratamentoScreen-5c102bdb772889ebff4563b8c91ba7fc.js",
  "/_expo/static/js/web/PrescricaoScreen-fac1a5ba37bf3feb0a0a88c7c4266dd6.js",
  "/_expo/static/js/web/TriagemScreen-406cd082ce2c9f15f8670e51f7654590.js",
  "/_expo/static/js/web/__common-6db3e7c735398f121901d5aed72afeb6.js",
  "/_expo/static/js/web/__expo-metro-runtime-5fa9f06415f5b5b1390bf3ed2c580c54.js",
  "/assets/assets/forgot_password_illustration.87ec546e5586c77e805e4edd5cf83934.jpg",
  "/assets/assets/welcome_slide_1.39d829414bb18797fa0352ea949eb00f.jpg",
  "/assets/assets/welcome_slide_2.7ea9e9c95d0ba9789421cceab44b641f.png",
  "/assets/assets/welcome_slide_3.7629e2ac833c32ed73c027bcd64b075c.png",
  "/assets/assets/welcome_slide_4.ec54f58d8a7c3b59ad85405b83c76861.png",
  "/assets/assets/welcome_slide_5.5e7cc48779cff004a6e99b36a052193c.png",
  "/assets/favicon.png",
  "/assets/icon.png",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.3f78af31cca60105799838a1a7a59fbd.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.31b5ffea3daddc69dd01a1f3d6cf63c5.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/EvilIcons.140c53a7643ea949007aa9a282153849.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.b06871f281fee6b241d60582ae9369b9.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.3b89dd103490708d19a95adcae52210e.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.1f77739ca9ff2188b539c36f30ffa2be.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.605ed7926cf39a2ad5ec2d1f9d391d3d.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Brands.56c8d80832e37783f12c05db7c8849e2.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Regular.370dd5af19f8364907b6e2c41f45dbbf.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Solid.adec7d6f310bc577f05e8fe06a5daccf.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Fontisto.b49ae8ab2dbccb02c4d11caaacf09eab.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Foundation.e20945d7c929279ef7a6f1db184a4470.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Octicons.871378c6eab492a3e689a9385dc45a12.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/SimpleLineIcons.d2285965fe34b05465047401b8595dd0.ttf",
  "/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Zocial.1681f34aaca71b8dfb70756bca331eb2.ttf",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/back-icon-mask.0a328cd9c1afd0afe8e3b1ec5165b1b4.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@2x.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@3x.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@4x.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/close-icon.808e1b1b9b53114ec2838071a7e6daa7.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/close-icon.808e1b1b9b53114ec2838071a7e6daa7@2x.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/close-icon.808e1b1b9b53114ec2838071a7e6daa7@3x.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/close-icon.808e1b1b9b53114ec2838071a7e6daa7@4x.png",
  "/assets/node_modules/@react-navigation/elements/lib/module/assets/search-icon.286d67d3f74808a60a78d3ebf1a5fb57.png",
  "/favicon.ico"
];

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
