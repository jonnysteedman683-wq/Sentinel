import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Sentinel — Neural Memory Engine',
        short_name: 'Sentinel',
        description: 'Neural memory consolidation engine with RL, dreaming, and swarm intelligence',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    // vendor-tfjs (~0.9MB) and vendor-three (~1.4MB, the three.js + force-graph
    // stack) are irreducible third-party library sizes. Both are isolated below
    // into their own cache-stable chunks, and vendor-three is lazy-loaded only
    // when a graph view opens. Raise the limit so the warning fires only for
    // genuinely unexpected growth.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) return 'vendor-react'
            // TensorFlow.js — large; kept out of the app entry chunk so source
            // edits don't invalidate its cached blob.
            if (id.includes('@tensorflow')) return 'vendor-tfjs'
            // three.js + the force-graph wrappers form one coupled, lazy-loaded
            // stack (MindMap and KnowledgeGraph3D pull both together), so they
            // share a single chunk that is never in the initial bundle.
            if (id.includes('/three/') || id.includes('force-graph') || id.includes('forcegraph') || id.includes('three-render-objects')) return 'vendor-three'
            if (id.includes('motion/')) return 'vendor-motion'
            if (id.includes('xstate') || id.includes('@xstate')) return 'vendor-xstate'
            if (id.includes('lucide-react')) return 'vendor-lucide'
            if (id.includes('firebase')) return 'vendor-firebase'
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified') || id.includes('micromark') || id.includes('mdast') || id.includes('hast')) return 'vendor-markdown'
            // Shared d3 modules deduped into one chunk (used by recharts,
            // reactflow, and force-graph) instead of being absorbed by whichever
            // vendor rule matches first.
            if (id.includes('d3-') || id.includes('/d3/')) return 'vendor-d3'
            if (id.includes('reactflow')) return 'vendor-flow'
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('dexie')) return 'vendor-dexie'
            if (id.includes('@google/genai')) return 'vendor-genai'
            if (id.includes('groq-sdk')) return 'vendor-groq'
            if (id.includes('date-fns')) return 'vendor-datefns'
            if (id.includes('zod')) return 'vendor-zod'
          }
        },
      },
    },
  },
})
