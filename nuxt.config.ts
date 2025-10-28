/// <reference types="@vite-pwa/nuxt" />
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Framolux',
      short_name: 'Framolux',
      description: 'LED Matrix Controller',
      theme_color: '#111827',
      background_color: '#111827',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      navigateFallback: '/',
      runtimeCaching: [
        // Do not cache device proxy calls; always network-first
        {
          urlPattern: /^\/api\/device-proxy.*/,
          handler: 'NetworkOnly' as const,
        },
      ],
    },
    client: {
      installPrompt: true,
    },
  },
})