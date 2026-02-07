/**
 * Unit Tests for Server Configuration
 * Tests for config/server.config.ts (nested structure)
 */

import { describe, it, expect } from 'vitest'
import { serverConfig } from '@config'

describe('Server Configuration', () => {
  describe('Nested Structure', () => {
    it('should have server object', () => {
      expect(serverConfig.server).toBeDefined()
      expect(typeof serverConfig.server).toBe('object')
    })

    it('should have cors object', () => {
      expect(serverConfig.cors).toBeDefined()
      expect(typeof serverConfig.cors).toBe('object')
    })
  })

  describe('Server Settings', () => {
    it('should have valid port number', () => {
      expect(serverConfig.server.port).toBeDefined()
      expect(typeof serverConfig.server.port).toBe('number')
      expect(serverConfig.server.port).toBeGreaterThan(0)
      expect(serverConfig.server.port).toBeLessThanOrEqual(65535)
    })

    it('should have valid host', () => {
      expect(serverConfig.server.host).toBeDefined()
      expect(typeof serverConfig.server.host).toBe('string')
      expect(serverConfig.server.host.length).toBeGreaterThan(0)
    })

    it('should have valid API prefix', () => {
      expect(serverConfig.server.apiPrefix).toBeDefined()
      expect(typeof serverConfig.server.apiPrefix).toBe('string')
      expect(serverConfig.server.apiPrefix).toMatch(/^\//)
    })

    it('should have backendPort as number', () => {
      expect(serverConfig.server.backendPort).toBeDefined()
      expect(typeof serverConfig.server.backendPort).toBe('number')
      expect(serverConfig.server.backendPort).toBeGreaterThan(0)
    })

    it('should have boolean feature flags', () => {
      expect(typeof serverConfig.server.enableRequestLogging).toBe('boolean')
      expect(typeof serverConfig.server.showBanner).toBe('boolean')
    })
  })

  describe('CORS Settings', () => {
    it('should have origins array', () => {
      expect(Array.isArray(serverConfig.cors.origins)).toBe(true)
      expect(serverConfig.cors.origins.length).toBeGreaterThan(0)
      serverConfig.cors.origins.forEach(origin => {
        expect(typeof origin).toBe('string')
      })
    })

    it('should have methods array with valid HTTP methods', () => {
      expect(Array.isArray(serverConfig.cors.methods)).toBe(true)
      expect(serverConfig.cors.methods.length).toBeGreaterThan(0)

      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']
      serverConfig.cors.methods.forEach(method => {
        expect(validMethods).toContain(method)
      })
    })

    it('should have headers array', () => {
      expect(Array.isArray(serverConfig.cors.headers)).toBe(true)
      expect(serverConfig.cors.headers.length).toBeGreaterThan(0)
    })

    it('should have credentials as boolean', () => {
      expect(typeof serverConfig.cors.credentials).toBe('boolean')
    })

    it('should have maxAge as positive number', () => {
      expect(typeof serverConfig.cors.maxAge).toBe('number')
      expect(serverConfig.cors.maxAge).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Type Safety', () => {
    it('should have correct nested types', () => {
      // TypeScript compile-time check
      const server: typeof serverConfig.server = serverConfig.server
      const cors: typeof serverConfig.cors = serverConfig.cors

      expect(server).toBeDefined()
      expect(cors).toBeDefined()
    })
  })
})
