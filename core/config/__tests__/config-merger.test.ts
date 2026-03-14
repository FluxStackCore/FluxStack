/**
 * Tests for ConfigMerger and EnvironmentConfigApplier
 * Tests configuration merging with precedence and environment-specific configs
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { 
  ConfigMerger, 
  EnvironmentConfigApplier 
} from '../env'
import type { FluxStackConfig } from '../schema'

describe('ConfigMerger', () => {
  let merger: ConfigMerger

  beforeEach(() => {
    merger = new ConfigMerger()
  })

  describe('merge', () => {
    test('merges simple configurations', () => {
      const config1 = {
        config: {
          app: { name: 'TestApp', version: '1.0.0' },
          server: { port: 3000 }
        } as Partial<FluxStackConfig>,
        source: 'default'
      }

      const config2 = {
        config: {
          app: { version: '2.0.0' },
          server: { host: 'localhost' }
        } as Partial<FluxStackConfig>,
        source: 'file'
      }

      const result = merger.merge(config1, config2)

      expect(result.app?.name).toBe('TestApp') // from config1
      expect(result.app?.version).toBe('2.0.0') // overridden by config2
      expect(result.server?.port).toBe(3000) // from config1
      expect(result.server?.host).toBe('localhost') // from config2
    })

    test('respects precedence order', () => {
      const defaultConfig = {
        config: {
          server: { port: 3000, host: 'localhost' }
        } as Partial<FluxStackConfig>,
        source: 'default'
      }

      const fileConfig = {
        config: {
          server: { port: 4000 }
        } as Partial<FluxStackConfig>,
        source: 'file'
      }

      const envConfig = {
        config: {
          server: { port: 5000 }
        } as Partial<FluxStackConfig>,
        source: 'environment'
      }

      const overrideConfig = {
        config: {
          server: { port: 6000 }
        } as Partial<FluxStackConfig>,
        source: 'override'
      }

      const result = merger.merge(defaultConfig, fileConfig, envConfig, overrideConfig)

      // Override should win (highest precedence)
      expect(result.server?.port).toBe(6000)
      expect(result.server?.host).toBe('localhost') // from default (not overridden)
    })

    test('handles nested object merging', () => {
      const config1 = {
        config: {
          server: {
            cors: {
              origins: ['http://localhost:3000'],
              methods: ['GET', 'POST'],
              credentials: true
            }
          }
        } as Partial<FluxStackConfig>,
        source: 'default'
      }

      const config2 = {
        config: {
          server: {
            cors: {
              origins: ['http://localhost:5173'],
              headers: ['Content-Type']
            }
          }
        } as Partial<FluxStackConfig>,
        source: 'environment'
      }

      const result = merger.merge(config1, config2)

      expect(result.server?.cors?.origins).toEqual(['http://localhost:5173']) // overridden
      expect(result.server?.cors?.methods).toEqual(['GET', 'POST']) // preserved
      expect(result.server?.cors?.headers).toEqual(['Content-Type']) // added
      expect(result.server?.cors?.credentials).toBe(true) // preserved
    })

    test('handles array replacement (not merging)', () => {
      const config1 = {
        config: {
          plugins: {
            enabled: ['plugin1', 'plugin2', 'plugin3']
          }
        } as Partial<FluxStackConfig>,
        source: 'default'
      }

      const config2 = {
        config: {
          plugins: {
            enabled: ['plugin4', 'plugin5']
          }
        } as Partial<FluxStackConfig>,
        source: 'environment'
      }

      const result = merger.merge(config1, config2)

      // Arrays should be replaced, not merged
      expect(result.plugins?.enabled).toEqual(['plugin4', 'plugin5'])
    })

    test('handles null and undefined values', () => {
      const config1 = {
        config: {
          server: {
            host: 'localhost',
            port: 3000,
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
        } as Partial<FluxStackConfig>,
        source: 'default'
      }

      const config2 = {
        config: {
          server: {
            port: null,
            apiPrefix: undefined
          }
        } as Partial<FluxStackConfig>,
        source: 'environment'
      }

      const result = merger.merge(config1, config2)

      expect(result.server?.host).toBe('localhost') // preserved
      expect(result.server?.port).toBe(null) // overridden with null
      expect(result.server?.apiPrefix).toBe(undefined) // undefined overrides in current implementation
    })

    test('merges complex nested structures', () => {
      const config1 = {
        config: {
          monitoring: {
            enabled: true,
            metrics: {
              enabled: true,
              collectInterval: 5000,
              httpMetrics: true,
              systemMetrics: false
            },
            profiling: {
              enabled: false,
              sampleRate: 0.1
            }
          }
        } as Partial<FluxStackConfig>,
        source: 'default'
      }

      const config2 = {
        config: {
          monitoring: {
            metrics: {
              collectInterval: 10000,
              systemMetrics: true,
              customMetrics: true
            },
            profiling: {
              enabled: true,
              memoryProfiling: true
            }
          }
        } as Partial<FluxStackConfig>,
        source: 'environment'
      }

      const result = merger.merge(config1, config2)

      expect(result.monitoring?.enabled).toBe(true) // from config1
      expect(result.monitoring?.metrics?.enabled).toBe(true) // from config1
      expect(result.monitoring?.metrics?.collectInterval).toBe(10000) // from config2
      expect(result.monitoring?.metrics?.httpMetrics).toBe(true) // from config1
      expect(result.monitoring?.metrics?.systemMetrics).toBe(true) // from config2
      expect((result.monitoring?.metrics as Record<string, unknown>)?.customMetrics).toBe(true) // from config2
      expect(result.monitoring?.profiling?.enabled).toBe(true) // from config2
      expect(result.monitoring?.profiling?.sampleRate).toBe(0.1) // from config1
      expect((result.monitoring?.profiling as Record<string, unknown>)?.memoryProfiling).toBe(true) // from config2
    })

    test('handles empty configurations', () => {
      const emptyConfig = {
        config: {} as Partial<FluxStackConfig>,
        source: 'default'
      }

      const config2 = {
        config: {
          app: { name: 'TestApp' }
        } as Partial<FluxStackConfig>,
        source: 'file'
      }

      const result = merger.merge(emptyConfig, config2)

      expect(result.app?.name).toBe('TestApp')
    })

    test('precedence works with same source priority', () => {
      const config1 = {
        config: {
          server: { port: 3000 }
        } as Partial<FluxStackConfig>,
        source: 'file'
      }

      const config2 = {
        config: {
          server: { port: 4000 }
        } as Partial<FluxStackConfig>,
        source: 'file'
      }

      const result = merger.merge(config1, config2)

      // Later config should win when precedence is equal
      expect(result.server?.port).toBe(4000)
    })
  })
})

describe('EnvironmentConfigApplier', () => {
  let applier: EnvironmentConfigApplier

  beforeEach(() => {
    applier = new EnvironmentConfigApplier()
  })

  describe('applyEnvironmentConfig', () => {
    test('applies environment-specific configuration', () => {
      const baseConfig: FluxStackConfig = {
        app: { name: 'TestApp', version: '1.0.0' },
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
        },
        client: {
          port: 5173,
          proxy: { target: 'http://localhost:3000' },
          build: {
            target: 'es2020',
            outDir: 'dist/client',
            sourceMaps: true,
            minify: false
          }
        },
        build: {
          target: 'bun',
          outDir: 'dist',
          clean: true,
          optimization: {
            minify: false,
            compress: false,
            treeshake: false,
            splitChunks: false,
            bundleAnalyzer: false
          },
          sourceMaps: true
        },
        logging: {
          level: 'info',
          format: 'pretty',
          transports: [
            { type: 'console', level: 'info', format: 'pretty' }
          ]
        },
        monitoring: {
          enabled: false,
          metrics: {
            enabled: false,
            collectInterval: 60000,
            httpMetrics: true,
            systemMetrics: true,
            customMetrics: false
          },
          profiling: {
            enabled: false,
            sampleRate: 0.1,
            memoryProfiling: false,
            cpuProfiling: false
          },
          exporters: []
        },
        plugins: {
          enabled: [],
          disabled: [],
          config: {}
        },
        environments: {
          production: {
            logging: {
              level: 'warn',
              format: 'json'
            },
            build: {
              optimization: {
                minify: true,
                compress: true,
                treeshake: true
              },
              sourceMaps: false
            },
            monitoring: {
              enabled: true,
              metrics: {
                enabled: true,
                collectInterval: 30000
              }
            }
          },
          development: {
            logging: {
              level: 'debug'
            },
            monitoring: {
              enabled: false
            }
          }
        }
      } as FluxStackConfig

      const result = applier.applyEnvironmentConfig(baseConfig, 'production')

      expect(result.logging?.level).toBe('warn') // overridden
      expect(result.logging?.format).toBe('json') // overridden
      expect(result.build?.optimization?.minify).toBe(true) // overridden
      expect(result.build?.optimization?.compress).toBe(true) // overridden
      expect(result.build?.optimization?.treeshake).toBe(true) // overridden
      expect(result.build?.sourceMaps).toBe(false) // overridden
      expect(result.monitoring?.enabled).toBe(true) // overridden
      expect(result.monitoring?.metrics?.enabled).toBe(true) // overridden
      expect(result.monitoring?.metrics?.collectInterval).toBe(30000) // overridden

      // Original values should be preserved where not overridden
      expect(result.app?.name).toBe('TestApp')
      expect(result.server?.port).toBe(3000)
    })

    test('applies development environment configuration', () => {
      const baseConfig: FluxStackConfig = {
        app: { name: 'TestApp', version: '1.0.0' },
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
        },
        client: {
          port: 5173,
          proxy: { target: 'http://localhost:3000' },
          build: {
            target: 'es2020',
            outDir: 'dist/client',
            sourceMaps: true,
            minify: false
          }
        },
        build: {
          target: 'bun',
          outDir: 'dist',
          clean: true,
          optimization: {
            minify: false,
            compress: false,
            treeshake: false,
            splitChunks: false,
            bundleAnalyzer: false
          },
          sourceMaps: true
        },
        logging: {
          level: 'info',
          format: 'pretty',
          transports: [
            { type: 'console', level: 'info', format: 'pretty' }
          ]
        },
        monitoring: {
          enabled: true,
          metrics: {
            enabled: false,
            collectInterval: 60000,
            httpMetrics: true,
            systemMetrics: true,
            customMetrics: false
          },
          profiling: {
            enabled: false,
            sampleRate: 0.1,
            memoryProfiling: false,
            cpuProfiling: false
          },
          exporters: []
        },
        plugins: {
          enabled: [],
          disabled: [],
          config: {}
        },
        environments: {
          development: {
            logging: {
              level: 'debug'
            },
            monitoring: {
              enabled: false
            }
          }
        }
      } as FluxStackConfig

      const result = applier.applyEnvironmentConfig(baseConfig, 'development')

      expect(result.logging?.level).toBe('debug') // overridden
      expect(result.monitoring?.enabled).toBe(false) // overridden
      expect(result.app?.name).toBe('TestApp') // preserved
    })

    test('returns original config when environment not found', () => {
      const baseConfig: FluxStackConfig = {
        app: { name: 'TestApp', version: '1.0.0' },
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
        },
        client: {
          port: 5173,
          proxy: { target: 'http://localhost:3000' },
          build: {
            target: 'es2020',
            outDir: 'dist/client',
            sourceMaps: true,
            minify: false
          }
        },
        build: {
          target: 'bun',
          outDir: 'dist',
          clean: true,
          optimization: {
            minify: false,
            compress: false,
            treeshake: false,
            splitChunks: false,
            bundleAnalyzer: false
          },
          sourceMaps: true
        },
        logging: {
          level: 'info',
          format: 'pretty',
          transports: [
            { type: 'console', level: 'info', format: 'pretty' }
          ]
        },
        monitoring: {
          enabled: false,
          metrics: {
            enabled: false,
            collectInterval: 60000,
            httpMetrics: true,
            systemMetrics: true,
            customMetrics: false
          },
          profiling: {
            enabled: false,
            sampleRate: 0.1,
            memoryProfiling: false,
            cpuProfiling: false
          },
          exporters: []
        },
        plugins: {
          enabled: [],
          disabled: [],
          config: {}
        }
      } as FluxStackConfig

      const result = applier.applyEnvironmentConfig(baseConfig, 'nonexistent')

      expect(result).toBe(baseConfig) // Should return the same object
    })
  })

  describe('getAvailableEnvironments', () => {
    test('returns available environments', () => {
      const config = {
        environments: {
          development: {},
          production: {},
          staging: {},
          test: {}
        }
      } as FluxStackConfig

      const environments = applier.getAvailableEnvironments(config)

      expect(environments).toEqual(['development', 'production', 'staging', 'test'])
    })

    test('returns empty array when no environments defined', () => {
      const config = {} as FluxStackConfig

      const environments = applier.getAvailableEnvironments(config)

      expect(environments).toEqual([])
    })
  })

  describe('validateEnvironmentConfig', () => {
    test('validates production environment requirements', () => {
      const config = {
        server: { port: 3000 },
        logging: { level: 'info' as const },
        monitoring: { enabled: false },
        environments: {
          production: {
            logging: { level: 'debug' as const }, // Invalid for production
            monitoring: { enabled: false } // Invalid for production
          }
        }
      } as FluxStackConfig

      const result = applier.validateEnvironmentConfig(config, 'production')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Production environment should not use debug logging')
      expect(result.errors).toContain('Production environment should enable monitoring')
    })

    test('validates port conflicts', () => {
      const config = {
        server: { port: 3000 },
        environments: {
          staging: {
            server: { port: 3000 } // Same as base - conflict
          }
        }
      } as FluxStackConfig

      const result = applier.validateEnvironmentConfig(config, 'staging')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Environment staging uses same port as base configuration')
    })

    test('allows port conflicts in development', () => {
      const config = {
        server: { port: 3000 },
        environments: {
          development: {
            server: { port: 3000 } // Same as base - allowed in development
          }
        }
      } as FluxStackConfig

      const result = applier.validateEnvironmentConfig(config, 'development')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('passes validation for valid production config', () => {
      const config = {
        server: { port: 3000 },
        logging: { level: 'info' as const },
        monitoring: { enabled: false },
        environments: {
          production: {
            server: { port: 8080 }, // Different port
            logging: { level: 'warn' as const }, // Valid for production
            monitoring: { enabled: true } // Valid for production
          }
        }
      } as FluxStackConfig

      const result = applier.validateEnvironmentConfig(config, 'production')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('returns valid for non-existent environment', () => {
      const config = {} as FluxStackConfig

      const result = applier.validateEnvironmentConfig(config, 'nonexistent')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})