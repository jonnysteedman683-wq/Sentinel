import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register/react': path.resolve(__dirname, 'tests/mocks/pwa-register-react.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'server.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/scripts/**',
      ],
      // Floor set just below the current baseline so it guards against
      // regression; raise it as coverage improves.
      thresholds: {
        statements: 20,
        branches: 14,
        functions: 16,
        lines: 21,
      },
    },
  },
});
