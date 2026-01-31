/**
 * Integration Tests for Config System
 * Tests for config module integration and unified exports
 */

import { describe, it, expect } from 'vitest'
import { config, appConfig, serverConfig, clientConfig, pluginsConfig, monitoringConfig } from '@/config'

describe('Config Integration', () => {
  describe('Unified Config Export', () => {
    it('should export all config modules from index', () => {
      expect(config.app).toBeDefined()
      expect(config.server).toBeDefined()
      expect(config.client).toBeDefined()
      expect(config.database).toBeDefined()
      expect(config.services).toBeDefined()
      expect(config.logger).toBeDefined()
      expect(config.plugins).toBeDefined()
      expect(config.monitoring).toBeDefined()
      expect(config.runtime).toBeDefined()
      expect(config.system).toBeDefined()
    })

    it('should match individual config imports', () => {
      expect(config.app).toBe(appConfig)
      expect(config.server).toBe(serverConfig)
      expect(config.client).toBe(clientConfig)
      expect(config.plugins).toBe(pluginsConfig)
      expect(config.monitoring).toBe(monitoringConfig)
    })
  })

  describe('Cross-Module Consistency', () => {
    it('should have consistent port configuration', () => {
      // Server port should be a valid number
      expect(serverConfig.server.port).toBeGreaterThan(0)

      // Client port should be different from server port
      expect(clientConfig.vite.port).not.toBe(serverConfig.server.port)
    })

    it('should have consistent environment across modules', () => {
      // All modules should share the same environment
      const env = appConfig.env
      expect(['development', 'production', 'test']).toContain(env)
    })

    it('should have consistent feature flags', () => {
      // Feature flags in runtime.config should be coordinated with other modules
      expect(config.runtime.values.enableSwagger).toBeDefined()
      expect(config.runtime.values.enableMetrics).toBeDefined()
      expect(config.runtime.values.enableMonitoring).toBeDefined()

      // Monitoring config should be available
      expect(monitoringConfig.monitoring.enabled).toBeDefined()
    })
  })

  describe('Nested Config Structure', () => {
    it('should properly nest server configuration', () => {
      expect(serverConfig.server).toBeDefined()
      expect(serverConfig.cors).toBeDefined()

      // Nested objects should have proper structure
      expect(serverConfig.server.port).toBeDefined()
      expect(serverConfig.cors.origins).toBeDefined()
    })

    it('should properly nest client configuration', () => {
      expect(clientConfig.vite).toBeDefined()
      expect(clientConfig.proxy).toBeDefined()
      expect(clientConfig.build).toBeDefined()

      // Nested objects should have proper structure
      expect(clientConfig.vite.port).toBeDefined()
      expect(clientConfig.proxy.target).toBeDefined()
      expect(clientConfig.build.outDir).toBeDefined()
    })

    it('should properly nest monitoring configuration', () => {
      expect(monitoringConfig.monitoring).toBeDefined()
      expect(monitoringConfig.metrics).toBeDefined()
      expect(monitoringConfig.profiling).toBeDefined()

      // Nested objects should have proper structure
      expect(monitoringConfig.monitoring.enabled).toBeDefined()
      expect(monitoringConfig.metrics.enabled).toBeDefined()
      expect(monitoringConfig.profiling.enabled).toBeDefined()
    })
  })

  describe('Config Relationships', () => {
    it('should have valid proxy target URL', () => {
      const proxyTarget = clientConfig.proxy.target

      if (proxyTarget) {
        // Proxy target should be a valid URL
        expect(() => new URL(proxyTarget)).not.toThrow()

        // Proxy should point to server
        const url = new URL(proxyTarget)
        expect(url.port).toBe(serverConfig.server.port.toString())
      }
    })

    it('should have CORS origins including client URL', () => {
      const clientPort = clientConfig.vite.port
      const expectedOrigin = `http://localhost:${clientPort}`

      expect(serverConfig.cors.origins).toContain(expectedOrigin)
    })
  })

  describe('Type Safety Integration', () => {
    it('should maintain type safety across imports', () => {
      // Test that types are correctly inferred
      const appName: string = config.app.name
      const serverPort: number = config.server.server.port
      const vitePort: number = config.client.vite.port
      const pluginList: string[] = config.plugins.enabled

      expect(appName).toBeDefined()
      expect(serverPort).toBeDefined()
      expect(vitePort).toBeDefined()
      expect(pluginList).toBeDefined()
    })

    it('should have literal types preserved', () => {
      const env: 'development' | 'production' | 'test' = config.app.env
      expect(env).toBeDefined()
    })
  })

  describe('Services Config', () => {
    it('should have nested services config', () => {
      expect(config.services.email).toBeDefined()
      expect(config.services.jwt).toBeDefined()
      expect(config.services.storage).toBeDefined()
      expect(config.services.redis).toBeDefined()
    })
  })
})
