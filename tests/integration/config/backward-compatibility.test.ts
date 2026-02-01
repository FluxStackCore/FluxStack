/**
 * Backward Compatibility Tests
 * Tests for compatibility with old config system (core/config/schema.ts)
 */

import { describe, it, expect } from 'vitest'
import { config as fluxStackConfig } from '@/config/fluxstack.config'
import type { FluxStackConfig } from '@/core/config/schema'

describe('Backward Compatibility', () => {
  describe('FluxStackConfig Type', () => {
    it('should export FluxStackConfig type from old location', () => {
      // Type check - should compile without errors
      const config: FluxStackConfig = fluxStackConfig

      expect(config).toBeDefined()
    })

    it('should have all required FluxStackConfig properties', () => {
      expect(fluxStackConfig.app).toBeDefined()
      expect(fluxStackConfig.server).toBeDefined()
      expect(fluxStackConfig.client).toBeDefined()
      expect(fluxStackConfig.build).toBeDefined()
      expect(fluxStackConfig.plugins).toBeDefined()
      expect(fluxStackConfig.logging).toBeDefined()
      expect(fluxStackConfig.monitoring).toBeDefined()
    })
  })

  describe('Config Structure Compatibility', () => {
    it('should maintain app config structure', () => {
      expect(fluxStackConfig.app.name).toBeDefined()
      expect(fluxStackConfig.app.version).toBeDefined()
      expect(typeof fluxStackConfig.app.name).toBe('string')
      expect(typeof fluxStackConfig.app.version).toBe('string')
    })

    it('should maintain server config structure', () => {
      expect(fluxStackConfig.server.port).toBeDefined()
      expect(fluxStackConfig.server.host).toBeDefined()
      expect(fluxStackConfig.server.apiPrefix).toBeDefined()
      expect(fluxStackConfig.server.cors).toBeDefined()

      expect(typeof fluxStackConfig.server.port).toBe('number')
      expect(typeof fluxStackConfig.server.host).toBe('string')
      expect(typeof fluxStackConfig.server.apiPrefix).toBe('string')
    })

    it('should maintain CORS config structure', () => {
      const cors = fluxStackConfig.server.cors

      expect(Array.isArray(cors.origins)).toBe(true)
      expect(Array.isArray(cors.methods)).toBe(true)
      expect(Array.isArray(cors.headers)).toBe(true)
      expect(typeof cors.credentials).toBe('boolean')
      expect(typeof cors.maxAge).toBe('number')
    })

    it('should maintain client config structure', () => {
      expect(fluxStackConfig.client.port).toBeDefined()
      expect(fluxStackConfig.client.build).toBeDefined()

      expect(typeof fluxStackConfig.client.port).toBe('number')
      // ℹ️ Proxy config removed - not needed in FluxStack architecture
    })

    it('should maintain build config structure', () => {
      expect(fluxStackConfig.build.target).toBeDefined()
      expect(fluxStackConfig.build.outDir).toBeDefined()
      expect(fluxStackConfig.build.optimization).toBeDefined()

      expect(typeof fluxStackConfig.build.target).toBe('string')
      expect(typeof fluxStackConfig.build.outDir).toBe('string')
      expect(typeof fluxStackConfig.build.optimization).toBe('object')
    })

    it('should maintain plugins config structure', () => {
      expect(Array.isArray(fluxStackConfig.plugins.enabled)).toBe(true)
      expect(Array.isArray(fluxStackConfig.plugins.disabled)).toBe(true)
      expect(typeof fluxStackConfig.plugins.config).toBe('object')
    })

    it('should maintain logging config structure', () => {
      expect(fluxStackConfig.logging.level).toBeDefined()
      expect(fluxStackConfig.logging.format).toBeDefined()
      expect(Array.isArray(fluxStackConfig.logging.transports)).toBe(true)

      expect(['debug', 'info', 'warn', 'error']).toContain(fluxStackConfig.logging.level)
      expect(['json', 'pretty']).toContain(fluxStackConfig.logging.format)
    })

    it('should maintain monitoring config structure', () => {
      expect(typeof fluxStackConfig.monitoring.enabled).toBe('boolean')
      expect(typeof fluxStackConfig.monitoring.metrics).toBe('object')
      expect(typeof fluxStackConfig.monitoring.profiling).toBe('object')
      expect(Array.isArray(fluxStackConfig.monitoring.exporters)).toBe(true)
    })
  })

  describe('Optional Configs Compatibility', () => {
    it('should handle optional database config', () => {
      if (fluxStackConfig.database) {
        expect(typeof fluxStackConfig.database).toBe('object')
      }
    })

    it('should handle optional auth config', () => {
      if (fluxStackConfig.auth) {
        expect(typeof fluxStackConfig.auth).toBe('object')
      }
    })

    it('should handle optional email config', () => {
      if (fluxStackConfig.email) {
        expect(typeof fluxStackConfig.email).toBe('object')
      }
    })

    it('should handle optional storage config', () => {
      if (fluxStackConfig.storage) {
        expect(typeof fluxStackConfig.storage).toBe('object')
      }
    })
  })

  describe('Environment Overrides Compatibility', () => {
    it('should have environments property', () => {
      expect(fluxStackConfig.environments).toBeDefined()
      expect(typeof fluxStackConfig.environments).toBe('object')
    })

    it('should have development environment config', () => {
      expect(fluxStackConfig.environments?.development).toBeDefined()
    })

    it('should have production environment config', () => {
      expect(fluxStackConfig.environments?.production).toBeDefined()
    })

    it('should have test environment config', () => {
      expect(fluxStackConfig.environments?.test).toBeDefined()
    })
  })

  describe('Values Consistency', () => {
    it('should compose values from new modular configs', async () => {
      // Import new configs to compare
      const { appConfig } = await import('../../../config/app.config')
      const { serverConfig } = await import('../../../config/server.config')

      // Values should match
      expect(fluxStackConfig.app.name).toBe(appConfig.name)
      expect(fluxStackConfig.app.version).toBe(appConfig.version)
      expect(fluxStackConfig.server.port).toBe(serverConfig.server.port)
      expect(fluxStackConfig.server.host).toBe(serverConfig.server.host)
    })
  })

  describe('Plugin Config Compatibility', () => {
    it('should have swagger plugin config', () => {
      expect(fluxStackConfig.plugins.config.swagger).toBeDefined()
      expect(typeof fluxStackConfig.plugins.config.swagger.title).toBe('string')
      expect(typeof fluxStackConfig.plugins.config.swagger.version).toBe('string')
    })

    it('should have static files plugin config', () => {
      expect(fluxStackConfig.plugins.config.staticFiles).toBeDefined()
      expect(typeof fluxStackConfig.plugins.config.staticFiles.publicDir).toBe('string')
      expect(typeof fluxStackConfig.plugins.config.staticFiles.uploadsDir).toBe('string')
    })
  })
})
