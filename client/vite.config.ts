import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'offline.html'],
      manifest: {
        name: 'auf gehts',
        short_name: 'auf gehts',
        description: 'German learning app',
        theme_color: '#0f1015',
        background_color: '#0f1015',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Pre-cache the build assets and the offline fallback HTML.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Read-cache safe GET API endpoints with NetworkFirst (fall back to cache when offline).
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/') && (
                url.pathname.startsWith('/api/sets/') ||
                url.pathname === '/api/sets/library' ||
                url.pathname.startsWith('/api/weeks') ||
                url.pathname.startsWith('/api/reading-texts') ||
                url.pathname.startsWith('/api/dictionary/')
              ),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-read-cache',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/audio/letters/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'letter-audio',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5175',
        changeOrigin: true,
      },
    },
  },
})
