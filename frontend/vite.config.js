import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png'],
      manifest: {
        name: 'Labs Burger POS',
        short_name: 'Labs Burger',
        description: 'Point of Sale System for Labs Burger',
        theme_color: '#CC0000',
        background_color: '#1a0000',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https?.*\/api\/sync\/snapshot/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-snapshot', expiration: { maxAgeSeconds: 3600 } }
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:3001' }
  }
})
