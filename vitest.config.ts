import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// ES modules compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        'dist/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/core': resolve(__dirname, './core'),
      '@/app': resolve(__dirname, './app'),
      '@/config': resolve(__dirname, './config'),
      '@/shared': resolve(__dirname, './app/shared')
    }
  }
})
