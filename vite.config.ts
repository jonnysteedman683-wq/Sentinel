import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) return 'vendor-react'
            if (id.includes('motion/')) return 'vendor-motion'
            if (id.includes('xstate') || id.includes('@xstate')) return 'vendor-xstate'
            if (id.includes('lucide-react')) return 'vendor-lucide'
            if (id.includes('firebase')) return 'vendor-firebase'
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified') || id.includes('micromark') || id.includes('mdast') || id.includes('hast')) return 'vendor-markdown'
            if (id.includes('reactflow') || id.includes('d3-') || id.includes('/d3/')) return 'vendor-flow'
            if (id.includes('three') || id.includes('force-graph')) return 'vendor-three'
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          }
        },
      },
    },
  },
})
