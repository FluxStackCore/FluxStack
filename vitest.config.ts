import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths() // ✅ Reads aliases from tsconfig.json automatically
  ],

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
  }

  // ℹ️ resolve.alias removed: Automatically read from tsconfig.json via tsconfigPaths plugin
})
