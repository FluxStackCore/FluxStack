/**
 * Tests for Configuration Validator
 */

import { describe, it, expect } from 'vitest'
import { 
  validateConfig, 
  validateConfigStrict,
  createEnvironmentValidator,
  validatePartialConfig,
  getConfigSuggestions
} from '../validator'
import { defaultFluxStackConfig } from '../schema'
import type { FluxStackConfig } from '../schema'

describe('Configuration Validator', () => {
  describe('validateConfig', () => {
    it('should validate default configuration successfully', () => {
      const result = validateConfig(defaultFluxStackConfig)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required properties', () => {
      const invalidConfig = {
        app: { name: 'test' }, // missing version
        server: defaultFluxStackConfig.server,
        client: defaultFluxStackConfig.client,
        build: defaultFluxStackConfig.build,
        plugins: defaultFluxStackConfig.plugins,
        logging: defaultFluxStackConfig.logging,
        monitoring: defaultFluxStackConfig.monitoring
      } as FluxStackConfig

      const result = validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('version'))).toBe(true)
    })

    it('should detect invalid port numbers', () => {
      const invalidConfig = {
        ...defaultFluxStackConfig,
        server: {
          ...defaultFluxStackConfig.server,
          port: 70000 // Invalid port
        }
      }

      const result = validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('port'))).toBe(true)
    })

    it('should detect port conflicts', () => {
      const conflictConfig = {
        ...defaultFluxStackConfig,
        server: { ...defaultFluxStackConfig.server, port: 3000 },
        client: { ...defaultFluxStackConfig.client, port: 3000 }
      }

      const result = validateConfig(conflictConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('different'))).toBe(true)
    })

    it('should warn about security issues', () => {
      const insecureConfig = {
        ...defaultFluxStackConfig,
        server: {
          ...defaultFluxStackConfig.server,
          cors: {
            ...defaultFluxStackConfig.server.cors,
            origins: ['*'],
            credentials: true
          }
        }
      }

      // Mock production environment
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const result = validateConfig(insecureConfig)
      
      expect(result.warnings.some(w => w.includes('wildcard'))).toBe(true)

      // Restore environment
      process.env.NODE_ENV = originalEnv
    })

    it('should validate enum values', () => {
      const invalidConfig = {
        ...defaultFluxStackConfig,
        logging: {
          ...defaultFluxStackConfig.logging,
          level: 'invalid' as unknown as 'debug' | 'info' | 'warn' | 'error'
        }
      }

      const result = validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('one of'))).toBe(true)
    })

    it('should validate array constraints', () => {
      const invalidConfig = {
        ...defaultFluxStackConfig,
        server: {
          ...defaultFluxStackConfig.server,
          cors: {
            ...defaultFluxStackConfig.server.cors,
            origins: [] // Empty array
          }
        }
      }

      const result = validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('at least'))).toBe(true)
    })
  })

  describe('validateConfigStrict', () => {
    it('should not throw for valid configuration', () => {
      expect(() => {
        validateConfigStrict(defaultFluxStackConfig)
      }).not.toThrow()
    })

    it('should throw for invalid configuration', () => {
      const invalidConfig = {
        ...defaultFluxStackConfig,
        app: { name: '' } // Invalid empty name
      } as FluxStackConfig

      expect(() => {
        validateConfigStrict(invalidConfig)
      }).toThrow()
    })
  })

  describe('createEnvironmentValidator', () => {
    it('should create production validator with additional checks', () => {
      const prodValidator = createEnvironmentValidator('production')
      
      const devConfig = {
        ...defaultFluxStackConfig,
        logging: { ...defaultFluxStackConfig.logging, level: 'debug' as const }
      }

      const result = prodValidator(devConfig)
      
      expect(result.warnings.some(w => w.includes('Debug logging'))).toBe(true)
    })

    it('should create development validator with build warnings', () => {
      const devValidator = createEnvironmentValidator('development')
      
      const prodConfig = {
        ...defaultFluxStackConfig,
        build: {
          ...defaultFluxStackConfig.build,
          optimization: {
            ...defaultFluxStackConfig.build.optimization,
            minify: true
          }
        }
      }

      const result = devValidator(prodConfig)
      
      expect(result.warnings.some(w => w.includes('Minification enabled'))).toBe(true)
    })
  })

  describe('validatePartialConfig', () => {
    it('should validate partial configuration against base', () => {
      const partialConfig = {
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
        }
      }

      const result = validatePartialConfig(partialConfig, defaultFluxStackConfig)
      
      expect(result.valid).toBe(true)
    })

    it('should detect conflicts in partial configuration', () => {
      const partialConfig = {
        server: {
          port: 70000, // Invalid port
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

      const result = validatePartialConfig(partialConfig, defaultFluxStackConfig)
      
      expect(result.valid).toBe(false)
    })
  })

  describe('getConfigSuggestions', () => {
    it('should provide suggestions for improvement', () => {
      const basicConfig = {
        ...defaultFluxStackConfig,
        monitoring: { ...defaultFluxStackConfig.monitoring, enabled: false }
      }

      const suggestions = getConfigSuggestions(basicConfig)
      
      expect(suggestions.some(s => s.includes('monitoring'))).toBe(true)
    })

    it('should suggest database configuration', () => {
      const configWithoutDb = {
        ...defaultFluxStackConfig,
        database: undefined
      }

      const suggestions = getConfigSuggestions(configWithoutDb)
      
      expect(suggestions.some(s => s.includes('database'))).toBe(true)
    })

    it('should suggest plugin enablement', () => {
      const configWithoutPlugins = {
        ...defaultFluxStackConfig,
        plugins: { ...defaultFluxStackConfig.plugins, enabled: [] }
      }

      const suggestions = getConfigSuggestions(configWithoutPlugins)
      
      expect(suggestions.some(s => s.includes('plugins'))).toBe(true)
    })
  })

  describe('Business Logic Validation', () => {
    it('should validate plugin conflicts', () => {
      const conflictConfig = {
        ...defaultFluxStackConfig,
        plugins: {
          enabled: ['logger', 'cors'],
          disabled: ['logger'], // Conflict: logger is both enabled and disabled
          config: {}
        }
      }

      const result = validateConfig(conflictConfig)
      
      expect(result.warnings.some(w => w.includes('both enabled and disabled'))).toBe(true)
    })

    it('should validate authentication security', () => {
      const weakAuthConfig = {
        ...defaultFluxStackConfig,
        auth: {
          secret: 'short', // Too short
          expiresIn: '24h'
        }
      }

      const result = validateConfig(weakAuthConfig)
      
      expect(result.warnings.some(w => w.includes('too short'))).toBe(true)
    })

    it('should validate build optimization settings', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const unoptimizedConfig = {
        ...defaultFluxStackConfig,
        build: {
          ...defaultFluxStackConfig.build,
          optimization: {
            ...defaultFluxStackConfig.build.optimization,
            minify: false,
            treeshake: false
          }
        }
      }

      const result = validateConfig(unoptimizedConfig)
      
      expect(result.warnings.some(w => w.includes('minification') || w.includes('tree-shaking'))).toBe(true)

      // Restore environment
      process.env.NODE_ENV = originalEnv
    })
  })
})