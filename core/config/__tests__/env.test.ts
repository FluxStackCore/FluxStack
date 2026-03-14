/**
 * Tests for Environment Configuration System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getEnvironmentInfo,
  EnvConverter,
  EnvironmentProcessor,
  ConfigMerger,
  EnvironmentConfigApplier,
  isDevelopment,
  isProduction,
  isTest,
  getEnvironmentRecommendations
} from '../env'
import { defaultFluxStackConfig } from '../schema'

describe('Environment Configuration System', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clean environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('FLUXSTACK_') || key.startsWith('TEST_')) {
        delete process.env[key]
      }
    })
  })

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv }
  })

  describe('getEnvironmentInfo', () => {
    it('should return development info by default', () => {
      delete process.env.NODE_ENV
      const info = getEnvironmentInfo()
      
      expect(info.name).toBe('development')
      expect(info.isDevelopment).toBe(true)
      expect(info.isProduction).toBe(false)
      expect(info.isTest).toBe(false)
      expect(info.nodeEnv).toBe('development')
    })

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production'
      const info = getEnvironmentInfo()
      
      expect(info.name).toBe('production')
      expect(info.isDevelopment).toBe(false)
      expect(info.isProduction).toBe(true)
      expect(info.isTest).toBe(false)
    })

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test'
      const info = getEnvironmentInfo()
      
      expect(info.name).toBe('test')
      expect(info.isDevelopment).toBe(false)
      expect(info.isProduction).toBe(false)
      expect(info.isTest).toBe(true)
    })
  })

  describe('EnvConverter', () => {
    describe('toNumber', () => {
      it('should convert valid numbers', () => {
        expect(EnvConverter.toNumber('123', 0)).toBe(123)
        expect(EnvConverter.toNumber('0', 100)).toBe(0)
        expect(EnvConverter.toNumber('-50', 0)).toBe(-50)
      })

      it('should return default for invalid numbers', () => {
        expect(EnvConverter.toNumber('abc', 42)).toBe(42)
        expect(EnvConverter.toNumber('', 100)).toBe(100)
        expect(EnvConverter.toNumber(undefined, 200)).toBe(200)
      })
    })

    describe('toBoolean', () => {
      it('should convert truthy values', () => {
        expect(EnvConverter.toBoolean('true', false)).toBe(true)
        expect(EnvConverter.toBoolean('1', false)).toBe(true)
        expect(EnvConverter.toBoolean('yes', false)).toBe(true)
        expect(EnvConverter.toBoolean('on', false)).toBe(true)
        expect(EnvConverter.toBoolean('TRUE', false)).toBe(true)
      })

      it('should convert falsy values', () => {
        expect(EnvConverter.toBoolean('false', true)).toBe(false)
        expect(EnvConverter.toBoolean('0', true)).toBe(false)
        expect(EnvConverter.toBoolean('no', true)).toBe(false)
        expect(EnvConverter.toBoolean('off', true)).toBe(false)
      })

      it('should return default for undefined', () => {
        expect(EnvConverter.toBoolean(undefined, true)).toBe(true)
        expect(EnvConverter.toBoolean(undefined, false)).toBe(false)
      })
    })

    describe('toArray', () => {
      it('should convert comma-separated values', () => {
        expect(EnvConverter.toArray('a,b,c')).toEqual(['a', 'b', 'c'])
        expect(EnvConverter.toArray('one, two, three')).toEqual(['one', 'two', 'three'])
        expect(EnvConverter.toArray('single')).toEqual(['single'])
      })

      it('should handle empty values', () => {
        expect(EnvConverter.toArray('')).toEqual([])
        expect(EnvConverter.toArray(undefined)).toEqual([])
        expect(EnvConverter.toArray('a,,b')).toEqual(['a', 'b']) // Filters empty strings
      })
    })

    describe('toLogLevel', () => {
      it('should convert valid log levels', () => {
        expect(EnvConverter.toLogLevel('debug', 'info')).toBe('debug')
        expect(EnvConverter.toLogLevel('INFO', 'debug')).toBe('info')
        expect(EnvConverter.toLogLevel('warn', 'info')).toBe('warn')
        expect(EnvConverter.toLogLevel('error', 'info')).toBe('error')
      })

      it('should return default for invalid levels', () => {
        expect(EnvConverter.toLogLevel('invalid', 'info')).toBe('info')
        expect(EnvConverter.toLogLevel(undefined, 'warn')).toBe('warn')
      })
    })

    describe('toObject', () => {
      it('should parse valid JSON', () => {
        expect(EnvConverter.toObject('{"key": "value"}', {})).toEqual({ key: 'value' })
        expect(EnvConverter.toObject('[1,2,3]', [] as unknown as Record<string, unknown>)).toEqual([1, 2, 3])
      })

      it('should return default for invalid JSON', () => {
        expect(EnvConverter.toObject('invalid-json', { default: true })).toEqual({ default: true })
        expect(EnvConverter.toObject(undefined, null)).toBe(null)
      })
    })
  })

  describe('EnvironmentProcessor', () => {
    it('should process basic environment variables', () => {
      process.env.PORT = '4000'
      process.env.HOST = 'example.com'
      process.env.FLUXSTACK_APP_NAME = 'test-app'

      const processor = new EnvironmentProcessor()
      const config = processor.processEnvironmentVariables()

      expect(config.server?.port).toBe(4000)
      expect(config.server?.host).toBe('example.com')
      expect(config.app?.name).toBe('test-app')
    })

    it('should process CORS configuration', () => {
      process.env.CORS_ORIGINS = 'http://localhost:3000,https://example.com'
      process.env.CORS_METHODS = 'GET,POST,PUT'
      process.env.CORS_CREDENTIALS = 'true'

      const processor = new EnvironmentProcessor()
      const config = processor.processEnvironmentVariables()

      expect(config.server?.cors?.origins).toEqual(['http://localhost:3000', 'https://example.com'])
      expect(config.server?.cors?.methods).toEqual(['GET', 'POST', 'PUT'])
      expect(config.server?.cors?.credentials).toBe(true)
    })

    it('should process build configuration', () => {
      process.env.BUILD_TARGET = 'node'
      process.env.BUILD_MINIFY = 'false'
      process.env.BUILD_SOURCEMAPS = 'true'

      const processor = new EnvironmentProcessor()
      const config = processor.processEnvironmentVariables()

      expect(config.build?.target).toBe('node')
      expect(config.build?.optimization?.minify).toBe(false)
      expect(config.build?.sourceMaps).toBe(true)
    })


    it('should track precedence information', () => {
      process.env.PORT = '5000'
      process.env.FLUXSTACK_APP_NAME = 'precedence-test'

      const processor = new EnvironmentProcessor()
      processor.processEnvironmentVariables()

      const precedence = processor.getPrecedenceInfo()
      
      expect(precedence.has('server.port')).toBe(true)
      expect(precedence.has('app.name')).toBe(true)
      expect(precedence.get('server.port')?.source).toBe('environment')
      expect(precedence.get('server.port')?.priority).toBe(3)
    })
  })

  describe('ConfigMerger', () => {
    it('should merge configurations with precedence', () => {
      const merger = new ConfigMerger()
      
      const baseConfig = {
        app: { name: 'base-app', version: '1.0.0' },
        server: { 
          port: 3000, 
          host: 'localhost',
          apiPrefix: '/api',
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
      
      const envConfig = {
        server: { 
          port: 4000,
          host: 'localhost',
          apiPrefix: '/api',
          cors: {
            origins: ['*'],
            methods: ['GET', 'POST'],
            headers: ['Content-Type'],
            credentials: false,
            maxAge: 86400
          },
          middleware: []
        },
        logging: { 
          level: 'debug' as const,
          format: 'pretty' as const,
          transports: [{ type: 'console' as const, level: 'debug' as const, format: 'pretty' as const }]
        }
      }

      const result = merger.merge(
        { config: baseConfig, source: 'file' },
        { config: envConfig, source: 'environment' }
      )

      expect(result.app.name).toBe('base-app') // From base
      expect(result.server.port).toBe(4000) // Overridden by env
      expect(result.server.host).toBe('localhost') // From base
      expect(result.logging?.level).toBe('debug') // From env
    })

    it('should handle nested object merging', () => {
      const merger = new ConfigMerger()
      
      const config1 = {
        server: {
          port: 3000,
          host: 'localhost',
          apiPrefix: '/api',
          cors: {
            origins: ['http://localhost:3000'],
            methods: ['GET', 'POST'],
            headers: ['Content-Type'],
            credentials: false,
            maxAge: 86400
          },
          middleware: []
        }
      }
      
      const config2 = {
        server: {
          port: 3000,
          host: 'localhost',
          apiPrefix: '/api',
          cors: {
            origins: ['https://example.com'],
            methods: ['GET', 'POST'],
            headers: ['Content-Type'],
            credentials: true,
            maxAge: 86400
          },
          middleware: []
        }
      }

      const result = merger.merge(
        { config: config1, source: 'default' },
        { config: config2, source: 'environment' }
      )

      expect(result.server.cors.origins).toEqual(['https://example.com'])
      expect(result.server.cors.methods).toEqual(['GET', 'POST'])
      expect(result.server.cors.credentials).toBe(true)
    })
  })

  describe('EnvironmentConfigApplier', () => {
    it('should apply environment-specific configuration', () => {
      const applier = new EnvironmentConfigApplier()
      
      const baseConfig = {
        ...defaultFluxStackConfig,
        environments: {
          production: {
            logging: { 
              level: 'error' as const,
              format: 'json' as const,
              transports: [{ type: 'console' as const, level: 'error' as const, format: 'json' as const }]
            },
            monitoring: { 
              enabled: true,
              metrics: { 
                enabled: true, 
                collectInterval: 30000,
                httpMetrics: true,
                systemMetrics: true,
                customMetrics: false
              },
              profiling: { 
                enabled: true, 
                sampleRate: 0.01,
                memoryProfiling: true,
                cpuProfiling: true
              },
              exporters: ['prometheus']
            }
          }
        }
      }

      const result = applier.applyEnvironmentConfig(baseConfig, 'production')

      expect(result.logging.level).toBe('error')
      expect(result.monitoring.enabled).toBe(true)
    })

    it('should get available environments', () => {
      const applier = new EnvironmentConfigApplier()
      
      const config = {
        ...defaultFluxStackConfig,
        environments: {
          staging: {},
          production: {},
          custom: {}
        }
      }

      const environments = applier.getAvailableEnvironments(config)
      
      expect(environments).toEqual(['staging', 'production', 'custom'])
    })

    it('should validate environment configuration', () => {
      const applier = new EnvironmentConfigApplier()
      
      const config = {
        ...defaultFluxStackConfig,
        environments: {
          production: {
            logging: { 
              level: 'debug' as const,
              format: 'json' as const,
              transports: [{ type: 'console' as const, level: 'debug' as const, format: 'json' as const }]
            } // Bad for production
          }
        }
      }

      const result = applier.validateEnvironmentConfig(config, 'production')
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('debug'))).toBe(true)
    })
  })

  describe('Environment Helper Functions', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development'
      expect(isDevelopment()).toBe(true)
      expect(isProduction()).toBe(false)
      expect(isTest()).toBe(false)
    })

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production'
      expect(isDevelopment()).toBe(false)
      expect(isProduction()).toBe(true)
      expect(isTest()).toBe(false)
    })

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test'
      expect(isDevelopment()).toBe(false)
      expect(isProduction()).toBe(false)
      expect(isTest()).toBe(true)
    })
  })

  describe('getEnvironmentRecommendations', () => {
    it('should provide development recommendations', () => {
      const recommendations = getEnvironmentRecommendations('development')
      
      expect(recommendations.logging?.level).toBe('debug')
      expect(recommendations.logging?.format).toBe('pretty')
      expect(recommendations.build?.optimization?.minify).toBe(false)
      expect(recommendations.monitoring?.enabled).toBe(false)
    })

    it('should provide production recommendations', () => {
      const recommendations = getEnvironmentRecommendations('production')
      
      expect(recommendations.logging?.level).toBe('warn')
      expect(recommendations.logging?.format).toBe('json')
      expect(recommendations.build?.optimization?.minify).toBe(true)
      expect(recommendations.monitoring?.enabled).toBe(true)
    })

    it('should provide test recommendations', () => {
      const recommendations = getEnvironmentRecommendations('test')
      
      expect(recommendations.logging?.level).toBe('error')
      expect(recommendations.server?.port).toBe(0)
      expect(recommendations.client?.port).toBe(0)
      expect(recommendations.monitoring?.enabled).toBe(false)
    })

    it('should return empty for unknown environments', () => {
      const recommendations = getEnvironmentRecommendations('unknown')
      
      expect(Object.keys(recommendations)).toHaveLength(0)
    })
  })
})