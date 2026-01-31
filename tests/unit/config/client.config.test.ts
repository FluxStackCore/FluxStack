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

    it('should have proxy object', () => {
      expect(clientConfig.proxy).toBeDefined()
      expect(typeof clientConfig.proxy).toBe('object')
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

  describe('Proxy Settings', () => {
    it('should have valid target URL', () => {
      expect(clientConfig.proxy.target).toBeDefined()
      expect(typeof clientConfig.proxy.target).toBe('string')

      // Should be a valid URL
      if (clientConfig.proxy.target) {
        expect(() => new URL(clientConfig.proxy.target!)).not.toThrow()
      }
    })

    it('should have boolean proxy flags', () => {
      expect(typeof clientConfig.proxy.changeOrigin).toBe('boolean')
      expect(typeof clientConfig.proxy.secure).toBe('boolean')
      expect(typeof clientConfig.proxy.ws).toBe('boolean')
    })

    it('should have rewrite as object', () => {
      expect(typeof clientConfig.proxy.rewrite).toBe('object')
    })
  })

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
      const proxy: typeof clientConfig.proxy = clientConfig.proxy
      const build: typeof clientConfig.build = clientConfig.build

      expect(vite).toBeDefined()
      expect(proxy).toBeDefined()
      expect(build).toBeDefined()
    })
  })
})
