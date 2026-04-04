import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    tsconfigPaths()
  ],

  resolve: {
    alias: {
      '@/': resolve(__dirname, './') + '/',
      '@server/': resolve(__dirname, './app/server/') + '/',
      '@client/': resolve(__dirname, './app/client/') + '/',
      '@core/': resolve(__dirname, './core/') + '/',
      '@config/': resolve(__dirname, './config/') + '/',
      '@app/': resolve(__dirname, './app/') + '/',
      '@shared/': resolve(__dirname, './app/shared/') + '/',
    }
  },

  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        'dist/',
        'ai-context/',
        'examples/'
      ],
      thresholds: {
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0
      }
    }
  }
})
