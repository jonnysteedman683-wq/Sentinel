import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client'],
          'vendor-motion': ['motion/react'],
          'vendor-xstate': ['xstate', '@xstate/react'],
          'vendor-lucide': ['lucide-react'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-markdown': ['react-markdown'],
          'vendor-flow': ['reactflow'],
        },
      },
    },
  },
})
