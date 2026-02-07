/**
 * Tests for FluxStack Framework Server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FluxStackFramework } from '../server'
import type { Plugin } from '../../plugins/types'

// Mock dependencies
vi.mock('@config', () => ({
  getConfigSync: vi.fn(() => ({
    server: {
      port: 3000,
      apiPrefix: '/api',
      cors: {
        origins: ['*'],
        methods: ['GET', 'POST'],
        headers: ['Content-Type'],
        credentials: false
      }
    },
    app: {
      name: 'test-app',
      version: '1.0.0'
    }
  })),
  getEnvironmentInfo: vi.fn(() => ({
    isDevelopment: true,
    isProduction: false,
    isTest: true,
    name: 'test'
  }))
}))

vi.mock('@core/utils/logger', () => ({
  logger: {
    framework: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      framework: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }))
  }
}))

vi.mock('@core/utils/errors/handlers', () => ({
  createErrorHandler: vi.fn(() => vi.fn())
}))

vi.mock('elysia', () => ({
  Elysia: vi.fn(() => ({
    onRequest: vi.fn().mockReturnThis(),
    onAfterHandle: vi.fn().mockReturnThis(),
    onError: vi.fn().mockReturnThis(),
    options: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    listen: vi.fn((_port, callback) => {
      if (callback) callback()
    })
  }))
}))

describe('FluxStackFramework', () => {
  let framework: FluxStackFramework

  beforeEach(() => {
    framework = new FluxStackFramework()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize framework with default config', () => {
      expect(framework).toBeInstanceOf(FluxStackFramework)
      expect(framework.getContext()).toBeDefined()
      expect(framework.getApp()).toBeDefined()
      expect(framework.getPluginRegistry()).toBeDefined()
    })

    it('should initialize framework with custom config', () => {
      const customConfig = {
        server: {
          port: 4000,
          host: 'localhost',
          apiPrefix: '/custom-api',
          cors: {
            origins: ['*'],
            methods: ['GET', 'POST'],
            headers: ['Content-Type'],
            credentials: false,
            maxAge: 86400
          },
          middleware: []
        }
      }
      
      const customFramework = new FluxStackFramework(customConfig)
      const context = customFramework.getContext()
      
      expect(context.config.server.port).toBe(4000)
      expect(context.config.server.apiPrefix).toBe('/custom-api')
    })

    it('should set up context correctly', () => {
      const context = framework.getContext()
      
      expect(context.isDevelopment).toBe(true)
      expect(context.isProduction).toBe(false)
      expect(context.isTest).toBe(true)
      expect(context.environment).toBe('test')
    })
  })

  describe('Plugin Management', () => {
    it('should register plugins successfully', () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        setup: vi.fn()
      }

      expect(() => framework.use(mockPlugin)).not.toThrow()
      expect(framework.getPluginRegistry().get('test-plugin')).toBe(mockPlugin)
    })

    it('should throw error when registering duplicate plugin', () => {
      const mockPlugin: Plugin = {
        name: 'duplicate-plugin',
        setup: vi.fn()
      }

      framework.use(mockPlugin)
      expect(() => framework.use(mockPlugin)).toThrow()
    })

    it('should validate plugin dependencies', async () => {
      const pluginA: Plugin = {
        name: 'plugin-a',
        setup: vi.fn()
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        setup: vi.fn()
      }

      framework.use(pluginA)
      framework.use(pluginB)

      await expect(framework.start()).resolves.not.toThrow()
    })

    it('should throw error for missing dependencies', async () => {
      const pluginWithMissingDep: Plugin = {
        name: 'plugin-with-missing-dep',
        dependencies: ['non-existent-plugin'],
        setup: vi.fn()
      }

      framework.use(pluginWithMissingDep)
      await expect(framework.start()).rejects.toThrow()
    })
  })

  describe('Lifecycle Management', () => {
    it('should start framework successfully', async () => {
      const mockPlugin: Plugin = {
        name: 'lifecycle-plugin',
        setup: vi.fn(),
        onServerStart: vi.fn()
      }

      framework.use(mockPlugin)
      await framework.start()

      expect(mockPlugin.setup).toHaveBeenCalled()
      expect(mockPlugin.onServerStart).toHaveBeenCalled()
    })

    it('should stop framework successfully', async () => {
      const mockPlugin: Plugin = {
        name: 'lifecycle-plugin',
        setup: vi.fn(),
        onServerStart: vi.fn(),
        onServerStop: vi.fn()
      }

      framework.use(mockPlugin)
      await framework.start()
      await framework.stop()

      expect(mockPlugin.onServerStop).toHaveBeenCalled()
    })

    it('should not start framework twice', async () => {
      await framework.start()
      await framework.start() // Should not throw or cause issues
      
      // Should log warning about already started
      const { logger } = await import('@core/utils/logger')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should handle plugin setup errors', async () => {
      const errorPlugin: Plugin = {
        name: 'error-plugin',
        setup: vi.fn().mockRejectedValue(new Error('Setup failed'))
      }

      framework.use(errorPlugin)
      await expect(framework.start()).rejects.toThrow('Setup failed')
    })
  })

  describe('Routes', () => {
    it('should add routes to the app', () => {
      const mockRouteModule = { get: vi.fn() }
      
      expect(() => framework.routes(mockRouteModule)).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should set up error handling', async () => {
      const { createErrorHandler } = await import('@core/utils/errors/handlers')
      expect(createErrorHandler).toHaveBeenCalled()
    })
  })
})