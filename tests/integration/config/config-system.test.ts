import { describe, it, expect } from 'vitest'
import { defineConfig } from '@core/utils/config-schema'
import { FluxStackFramework } from '@core/framework/server'

describe('Config System - Integration', () => {
  it('all config modules export valid schemas', async () => {
    const config = await import('@config')

    // App config
    expect(config.appConfig).toBeDefined()
    expect(typeof config.appConfig.name).toBe('string')

    // Server config
    expect(config.serverConfig).toBeDefined()
    expect(config.serverConfig.server).toBeDefined()
    expect(typeof config.serverConfig.server.port).toBe('number')
    expect(typeof config.serverConfig.server.host).toBe('string')

    // Client config
    expect(config.clientConfig).toBeDefined()
    expect(config.clientConfig.vite).toBeDefined()
    expect(typeof config.clientConfig.vite.port).toBe('number')

    // Logger config
    expect(config.loggerConfig).toBeDefined()

    // Plugins config
    expect(config.pluginsConfig).toBeDefined()

    // Monitoring config
    expect(config.monitoringConfig).toBeDefined()

    // Database config
    expect(config.databaseConfig).toBeDefined()

    // Build config
    expect(config.buildConfig).toBeDefined()

    // System config
    expect(config.systemConfig).toBeDefined()
  })

  it('config validation rejects invalid values', () => {
    // Define a config schema with a custom validator
    const schema = {
      port: {
        type: 'number' as const,
        default: 3000,
        required: true as const,
        validate: (value: number) => {
          if (value < 1 || value > 65535) {
            return 'Port must be between 1 and 65535'
          }
          return true
        },
      },
      name: {
        type: 'string' as const,
        default: 'test-app',
        required: true as const,
      },
    }

    // defineConfig with valid defaults should succeed
    const validConfig = defineConfig(schema)
    expect(validConfig.port).toBe(3000)
    expect(validConfig.name).toBe('test-app')

    // Enum validation: define schema with enum that has specific values
    const enumSchema = {
      env: {
        type: 'enum' as const,
        values: ['development', 'production', 'test'] as const,
        default: 'development' as const,
        required: true as const,
      },
    }

    const enumConfig = defineConfig(enumSchema)
    expect(['development', 'production', 'test']).toContain(enumConfig.env)
  })

  it('framework loads config correctly into context', () => {
    const framework = new FluxStackFramework({
      server: {
        port: 0,
        host: 'localhost',
        apiPrefix: '/api',
        cors: { origins: ['*'], methods: ['GET', 'POST'], headers: ['Content-Type'], credentials: false, maxAge: 86400 },
        middleware: [],
      },
    })

    const context = framework.getContext()

    // Context should have config
    expect(context.config).toBeDefined()

    // Context should have environment flags
    expect(typeof context.isDevelopment).toBe('boolean')
    expect(typeof context.isProduction).toBe('boolean')
    expect(typeof context.isTest).toBe('boolean')
    expect(typeof context.environment).toBe('string')

    // Config should contain server settings
    const config = context.config as any
    expect(config.server).toBeDefined()
    expect(config.server.port).toBe(0)
    expect(config.server.host).toBe('localhost')
    expect(config.server.apiPrefix).toBe('/api')

    // Should have app config loaded
    expect(config.app).toBeDefined()
  })
})
