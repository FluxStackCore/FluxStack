/**
 * Unit Tests for App Configuration
 * Tests for config/app.config.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { appConfig } from '@config'

describe('App Configuration', () => {
  describe('Basic Properties', () => {
    it('should have a valid app name', () => {
      expect(appConfig.name).toBeDefined()
      expect(typeof appConfig.name).toBe('string')
      expect(appConfig.name.length).toBeGreaterThan(0)
    })

    it('should have a valid semver version', () => {
      expect(appConfig.version).toBeDefined()
      expect(typeof appConfig.version).toBe('string')
      expect(appConfig.version).toMatch(/^\d+\.\d+\.\d+/)
    })

    it('should have a description', () => {
      expect(appConfig.description).toBeDefined()
      expect(typeof appConfig.description).toBe('string')
    })
  })

  describe('Environment Settings', () => {
    it('should have a valid environment', () => {
      expect(appConfig.env).toBeDefined()
      expect(['development', 'production', 'test']).toContain(appConfig.env)
    })
  })

  describe('Security Settings', () => {
    it('should have trustProxy as boolean', () => {
      expect(typeof appConfig.trustProxy).toBe('boolean')
    })

    it('should have optional sessionSecret', () => {
      if (appConfig.sessionSecret) {
        expect(typeof appConfig.sessionSecret).toBe('string')
        expect(appConfig.sessionSecret.length).toBeGreaterThanOrEqual(32)
      }
    })
  })

  describe('Type Safety', () => {
    it('should export correct TypeScript type', () => {
      // TypeScript compile-time check
      const config: typeof appConfig = appConfig
      expect(config).toBeDefined()
    })

    it('should have literal type for environment', () => {
      // Environment should be literal type, not just string
      const env: 'development' | 'production' | 'test' = appConfig.env
      expect(env).toBeDefined()
    })
  })
})
