// 🧪 Vitest Configuration for Live Components Tests

import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths() // ✅ Reads aliases from tsconfig.json automatically
  ],

  test: {
    name: 'live-components',
    root: './core/server/live',
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    include: [
      '**/__tests__/**/*.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/live-components',
      include: [
        'core/server/live/**/*.ts'
      ],
      exclude: [
        'core/server/live/**/__tests__/**',
        'core/server/live/**/*.test.ts',
        'core/server/live/**/*.spec.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    },
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/live-components.json'
    }
  },

  // ℹ️ resolve.alias removed: Automatically read from tsconfig.json via tsconfigPaths plugin

  esbuild: {
    target: 'node18'
  }
})
