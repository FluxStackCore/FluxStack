/**
 * Unit Tests for Plugins Configuration
 * Tests for config/plugins.config.ts
 */

import { describe, it, expect } from 'vitest'
import { pluginsConfig } from '@config'

describe('Plugins Configuration', () => {
  describe('Plugin Management', () => {
    it('should have enabled plugins array', () => {
      expect(Array.isArray(pluginsConfig.enabled)).toBe(true)
      pluginsConfig.enabled.forEach(plugin => {
        expect(typeof plugin).toBe('string')
      })
    })

    it('should have disabled plugins array', () => {
      expect(Array.isArray(pluginsConfig.disabled)).toBe(true)
    })

    it('should have autoDiscover flag', () => {
      expect(typeof pluginsConfig.autoDiscover).toBe('boolean')
    })

    it('should have valid pluginsDir', () => {
      expect(pluginsConfig.pluginsDir).toBeDefined()
      expect(typeof pluginsConfig.pluginsDir).toBe('string')
    })
  })

  describe('Core Plugins', () => {
    it('should include essential plugins', () => {
      const essentialPlugins = ['logger', 'swagger', 'vite', 'cors']
      essentialPlugins.forEach(plugin => {
        expect(pluginsConfig.enabled).toContain(plugin)
      })
    })
  })

  describe('Swagger Plugin Settings', () => {
    it('should have valid swagger title', () => {
      expect(pluginsConfig.swaggerTitle).toBeDefined()
      expect(typeof pluginsConfig.swaggerTitle).toBe('string')
    })

    it('should have valid swagger version', () => {
      expect(pluginsConfig.swaggerVersion).toBeDefined()
      expect(typeof pluginsConfig.swaggerVersion).toBe('string')
      expect(pluginsConfig.swaggerVersion).toMatch(/^\d+\.\d+\.\d+/)
    })

    it('should have valid swagger description', () => {
      expect(pluginsConfig.swaggerDescription).toBeDefined()
      expect(typeof pluginsConfig.swaggerDescription).toBe('string')
    })

    it('should have valid swagger path', () => {
      expect(pluginsConfig.swaggerPath).toBeDefined()
      expect(typeof pluginsConfig.swaggerPath).toBe('string')
      expect(pluginsConfig.swaggerPath).toMatch(/^\//)
    })
  })

  describe('Static Files Plugin Settings', () => {
    it('should have static files enabled flag', () => {
      expect(typeof pluginsConfig.staticFilesEnabled).toBe('boolean')
    })

    it('should have valid directory paths', () => {
      expect(typeof pluginsConfig.staticPublicDir).toBe('string')
      expect(typeof pluginsConfig.staticUploadsDir).toBe('string')
    })

    it('should have valid cache max age', () => {
      expect(typeof pluginsConfig.staticCacheMaxAge).toBe('number')
      expect(pluginsConfig.staticCacheMaxAge).toBeGreaterThanOrEqual(0)
    })

    it('should have boolean enable flags', () => {
      expect(typeof pluginsConfig.staticEnableUploads).toBe('boolean')
      expect(typeof pluginsConfig.staticEnablePublic).toBe('boolean')
    })
  })

  describe('Other Plugin Flags', () => {
    it('should have vite plugin flag', () => {
      expect(typeof pluginsConfig.viteEnabled).toBe('boolean')
    })

    it('should have logger plugin flag', () => {
      expect(typeof pluginsConfig.loggerEnabled).toBe('boolean')
    })
  })
})
