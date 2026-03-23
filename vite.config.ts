import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import reactNativeWeb from 'vite-plugin-react-native-web/dist/es/index.js';

export default defineConfig({
  plugins: [
    reactNativeWeb(),
    react({
      include: "**/*.{jsx,tsx,ts,js}",
    }),
    VitePWA({
      // Atualiza automaticamente o SW para entregar nova versão em reload
      registerType: 'autoUpdate',
      // Assets que devem ser sempre gerados no build e incluídos em cache inicial
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'robots.txt',
        'apple-touch-icon.png',
        'offline.html',
      ],
      // Manifest diretamente aqui, alinhado com web/manifest.json
      manifest: {
        name: 'TeOdonto Angola',
        short_name: 'TeOdonto',
        description: 'Sistema PWA de gestão odontológica com uso offline e sync',
        theme_color: '#1E88E5',
        background_color: '#F5F5F5',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/assets/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/assets/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/assets/icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Faz cache dos recursos estáticos com CacheFirst (offline-first).
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|mjs|css|html|png|jpg|jpeg|svg|woff2|woff)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-v1',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
              },
            },
          },
          {
            urlPattern: /\/(?:api|rest)\/.*$/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache-v1',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24, // 1 dia
              },
            },
          },
        ],
        // Quando navegação falha, redireciona para página offline.
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],

  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  publicDir: 'web',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});
