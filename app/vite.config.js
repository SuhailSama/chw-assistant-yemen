import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the app from /<repo>/, so the base path is set at build time.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "مساعد العاملين الصحيين",
        short_name: "CHW مساعد",
        description: "أداة دعم طبي ميداني للعاملين الصحيين في اليمن",
        theme_color: "#1a6b4a",
        background_color: "#f5f5f0",
        display: "standalone",
        dir: "rtl",
        lang: "ar",
        start_url: ".",
        scope: ".",
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache'
            }
          }
        ]
      }
    })
  ]
})
