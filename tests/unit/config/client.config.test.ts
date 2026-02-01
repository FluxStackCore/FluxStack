/**
 * Unit Tests for Client Configuration
 * Tests for config/client.config.ts (nested: vite, proxy, build)
 */

import { describe, it, expect } from 'vitest'
import { clientConfig } from '@/config'

describe('Client Configuration', () => {
  describe('Nested Structure', () => {
    it('should have vite object', () => {
      expect(clientConfig.vite).toBeDefined()
      expect(typeof clientConfig.vite).toBe('object')
    })

    it('should have build object', () => {
      expect(clientConfig.build).toBeDefined()
      expect(typeof clientConfig.build).toBe('object')
    })
  })

  describe('Vite Settings', () => {
    it('should have valid port number', () => {
      expect(clientConfig.vite.port).toBeDefined()
      expect(typeof clientConfig.vite.port).toBe('number')
      expect(clientConfig.vite.port).toBeGreaterThan(0)
      expect(clientConfig.vite.port).toBeLessThanOrEqual(65535)
    })

    it('should have valid host', () => {
      expect(clientConfig.vite.host).toBeDefined()
      expect(typeof clientConfig.vite.host).toBe('string')
    })

    it('should have boolean flags', () => {
      expect(typeof clientConfig.vite.strictPort).toBe('boolean')
      expect(typeof clientConfig.vite.open).toBe('boolean')
      expect(typeof clientConfig.vite.enableLogging).toBe('boolean')
    })
  })

  // ℹ️ Proxy Settings removed: Not needed in FluxStack architecture
  // All requests go through Elysia which handles routing to Vite dev server

  describe('Build Settings', () => {
    it('should have valid outDir', () => {
      expect(clientConfig.build.outDir).toBeDefined()
      expect(typeof clientConfig.build.outDir).toBe('string')
      expect(clientConfig.build.outDir.length).toBeGreaterThan(0)
    })

    it('should have boolean build flags', () => {
      expect(typeof clientConfig.build.sourceMaps).toBe('boolean')
      expect(typeof clientConfig.build.minify).toBe('boolean')
      expect(typeof clientConfig.build.cssCodeSplit).toBe('boolean')
      expect(typeof clientConfig.build.emptyOutDir).toBe('boolean')
    })

    it('should have valid target', () => {
      expect(clientConfig.build.target).toBeDefined()
      expect(typeof clientConfig.build.target).toBe('string')
    })

    it('should have valid assetsDir', () => {
      expect(clientConfig.build.assetsDir).toBeDefined()
      expect(typeof clientConfig.build.assetsDir).toBe('string')
    })

    it('should have chunkSizeWarningLimit as positive number', () => {
      expect(typeof clientConfig.build.chunkSizeWarningLimit).toBe('number')
      expect(clientConfig.build.chunkSizeWarningLimit).toBeGreaterThan(0)
    })
  })

  describe('Type Safety', () => {
    it('should have correct nested types', () => {
      const vite: typeof clientConfig.vite = clientConfig.vite
      const build: typeof clientConfig.build = clientConfig.build

      expect(vite).toBeDefined()
      expect(build).toBeDefined()
    })
  })
})
