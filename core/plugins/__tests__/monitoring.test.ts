/**
 * Tests for Monitoring Plugin
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { monitoringPlugin } from '../built-in/monitoring'
import type { PluginContext, RequestContext, ResponseContext, ErrorContext } from '../types'
import type { Logger } from '@core/utils/logger/index'
import type { FluxStackConfig } from '@config/schema'

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
  time: vi.fn(),
  timeEnd: vi.fn(),
  request: vi.fn()
}

// Mock utils
const mockUtils = {
  createTimer: vi.fn(() => ({ end: vi.fn(() => 100) })),
  formatBytes: vi.fn((bytes: number) => `${bytes} bytes`),
  isProduction: vi.fn(() => false),
  isDevelopment: vi.fn(() => true),
  getEnvironment: vi.fn(() => 'development'),
  createHash: vi.fn(() => 'hash123'),
  deepMerge: vi.fn((a, b) => ({ ...a, ...b })),
  validateSchema: vi.fn(() => ({ valid: true, errors: [] }))
}

// Mock config
const mockConfig: FluxStackConfig = {
  app: { name: 'test-app', version: '1.0.0' },
  server: {
    port: 3000,
    host: 'localhost',
    apiPrefix: '/api',
    cors: {
      origins: ['*'],
      methods: ['GET', 'POST'],
      headers: ['Content-Type']
    },
    middleware: []
  },
  client: {
    port: 5173,
    proxy: { target: 'http://localhost:3000' },
    build: {
      sourceMaps: true,
      minify: false,
      target: 'esnext',
      outDir: 'dist/client'
    }
  },
  build: {
    target: 'bun',
    outDir: 'dist',
    optimization: {
      minify: false,
      treeshake: false,
      compress: false,
      splitChunks: false,
      bundleAnalyzer: false
    },
    sourceMaps: true,
    clean: true
  },
  plugins: {
    enabled: [],
    disabled: [],
    config: {
      monitoring: {
        enabled: true,
        httpMetrics: true,
        systemMetrics: true,
        customMetrics: true,
        collectInterval: 1000, // Faster for testing
        retentionPeriod: 5000,
        exporters: [
          {
            type: 'console',
            interval: 2000,
            enabled: true
          }
        ],
        thresholds: {
          responseTime: 500,
          errorRate: 0.1,
          memoryUsage: 0.9,
          cpuUsage: 0.9
        }
      }
    }
  },
  logging: {
    level: 'info',
    format: 'pretty',
    transports: []
  },
  monitoring: {
    enabled: true,
    metrics: {
      enabled: true,
      collectInterval: 5000,
      httpMetrics: true,
      systemMetrics: true,
      customMetrics: true
    },
    profiling: {
      enabled: false,
      sampleRate: 0.1,
      memoryProfiling: false,
      cpuProfiling: false
    },
    exporters: []
  }
}

describe('Monitoring Plugin', () => {
  let context: PluginContext

  beforeEach(() => {
    context = {
      config: mockConfig,
      logger: mockLogger,
      app: { use: vi.fn(), get: vi.fn() },
      utils: mockUtils
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any intervals that might have been created
    const intervals = (context as any).monitoringIntervals as NodeJS.Timeout[]
    if (intervals) {
      intervals.forEach(interval => clearInterval(interval))
    }
  })

  describe('Plugin Structure', () => {
    it('should have correct metadata', () => {
      expect(monitoringPlugin.name).toBe('monitoring')
      expect(monitoringPlugin.version).toBe('1.0.0')
      expect(monitoringPlugin.priority).toBe(900)
      expect(monitoringPlugin.category).toBe('monitoring')
      expect(monitoringPlugin.tags).toContain('monitoring')
      expect(monitoringPlugin.tags).toContain('metrics')
      expect(monitoringPlugin.tags).toContain('performance')
      expect(monitoringPlugin.configSchema).toBeDefined()
      expect(monitoringPlugin.defaultConfig).toBeDefined()
    })

    it('should have all required lifecycle hooks', () => {
      expect(monitoringPlugin.setup).toBeDefined()
      expect(monitoringPlugin.onServerStart).toBeDefined()
      expect(monitoringPlugin.onServerStop).toBeDefined()
      expect(monitoringPlugin.onRequest).toBeDefined()
      expect(monitoringPlugin.onResponse).toBeDefined()
      expect(monitoringPlugin.onError).toBeDefined()
    })
  })

  describe('Plugin Setup', () => {
    it('should setup successfully when enabled', async () => {
      await monitoringPlugin.setup!(context)
      
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing monitoring plugin', expect.any(Object))
      expect(mockLogger.info).toHaveBeenCalledWith('Monitoring plugin initialized successfully')
      expect((context as any).metricsRegistry).toBeDefined()
    })

    it('should skip setup when disabled', async () => {
      const disabledConfig = {
        ...mockConfig,
        plugins: {
          ...mockConfig.plugins,
          config: {
            monitoring: {
              enabled: false
            }
          }
        }
      }

      const disabledContext = { ...context, config: disabledConfig }
      await monitoringPlugin.setup!(disabledContext)
      
      expect(mockLogger.info).toHaveBeenCalledWith('Monitoring plugin disabled by configuration')
      expect((disabledContext as any).metricsRegistry).toBeUndefined()
    })

    it('should initialize metrics registry', async () => {
      await monitoringPlugin.setup!(context)
      
      const registry = (context as any).metricsRegistry
      expect(registry).toBeDefined()
      expect(registry.counters).toBeInstanceOf(Map)
      expect(registry.gauges).toBeInstanceOf(Map)
      expect(registry.histograms).toBeInstanceOf(Map)
    })
  })

  describe('Server Lifecycle', () => {
    beforeEach(async () => {
      await monitoringPlugin.setup!(context)
    })

    it('should handle server start', async () => {
      await monitoringPlugin.onServerStart!(context)
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Monitoring plugin: Server monitoring started',
        expect.objectContaining({
          pid: expect.any(Number),
          nodeVersion: expect.any(String),
          platform: expect.any(String)
        })
      )

      // Check that server start metric was recorded
      const registry = (context as any).metricsRegistry
      expect(registry.counters.size).toBeGreaterThan(0)
    })

    it('should handle server stop', async () => {
      await monitoringPlugin.onServerStop!(context)
      
      expect(mockLogger.info).toHaveBeenCalledWith('Monitoring plugin: Server monitoring stopped')

      // Check that server stop metric was recorded
      const registry = (context as any).metricsRegistry
      expect(registry.counters.size).toBeGreaterThan(0)
    })
  })

  describe('HTTP Metrics', () => {
    beforeEach(async () => {
      await monitoringPlugin.setup!(context)
    })

    it('should record request metrics', async () => {
      const requestContext: RequestContext = {
        request: new Request('http://localhost:3000/test'),
        path: '/test',
        method: 'GET',
        headers: { 'content-length': '100' },
        query: {},
        params: {},
        startTime: Date.now()
      }

      // Add metrics registry to request context for testing
      ;(requestContext as any).metricsRegistry = (context as any).metricsRegistry

      await monitoringPlugin.onRequest!(requestContext)
      
      const registry = (context as any).metricsRegistry
      expect(registry.counters.size).toBeGreaterThan(0)
      expect(registry.histograms.size).toBeGreaterThan(0)
    })

    it('should record response metrics', async () => {
      const responseContext: ResponseContext = {
        request: new Request('http://localhost:3000/test'),
        path: '/test',
        method: 'GET',
        headers: {},
        query: {},
        params: {},
        startTime: Date.now() - 100,
        response: new Response('OK'),
        statusCode: 200,
        duration: 100,
        size: 50
      }

      // Add metrics registry to response context for testing
      ;(responseContext as any).metricsRegistry = (context as any).metricsRegistry

      await monitoringPlugin.onResponse!(responseContext)
      
      const registry = (context as any).metricsRegistry
      expect(registry.counters.size).toBeGreaterThan(0)
      expect(registry.histograms.size).toBeGreaterThan(0)
    })

    it('should record error metrics', async () => {
      const errorContext: ErrorContext = {
        request: new Request('http://localhost:3000/test'),
        path: '/test',
        method: 'GET',
        headers: {},
        query: {},
        params: {},
        startTime: Date.now() - 100,
        error: new Error('Test error'),
        duration: 100,
        handled: false
      }

      // Add metrics registry to error context for testing
      ;(errorContext as any).metricsRegistry = (context as any).metricsRegistry

      await monitoringPlugin.onError!(errorContext)
      
      const registry = (context as any).metricsRegistry
      expect(registry.counters.size).toBeGreaterThan(0)
      expect(registry.histograms.size).toBeGreaterThan(0)
    })
  })

  describe('System Metrics', () => {
    it('should collect system metrics', async () => {
      await monitoringPlugin.setup!(context)
      
      // Wait a bit for system metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      const registry = (context as any).metricsRegistry
      expect(registry.gauges.size).toBeGreaterThan(0)
      
      // Check for specific system metrics
      const gaugeKeys = Array.from(registry.gauges.keys()) as string[]
      expect(gaugeKeys.some(key => key.includes('process_memory'))).toBe(true)
      expect(gaugeKeys.some(key => key.includes('process_cpu'))).toBe(true)
      expect(gaugeKeys.some(key => key.includes('process_uptime'))).toBe(true)
    })
  })

  describe('Metrics Export', () => {
    it('should export metrics to console', async () => {
      await monitoringPlugin.setup!(context)
      
      // Wait for export interval
      await new Promise(resolve => setTimeout(resolve, 2100))
      
      // Should have logged metrics
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Metrics snapshot',
        expect.objectContaining({
          timestamp: expect.any(String),
          counters: expect.any(Number),
          gauges: expect.any(Number),
          histograms: expect.any(Number),
          metrics: expect.any(Object)
        })
      )
    })
  })

  describe('Configuration', () => {
    it('should use default configuration when none provided', async () => {
      const contextWithoutConfig = {
        ...context,
        config: {
          ...mockConfig,
          plugins: {
            ...mockConfig.plugins,
            config: {}
          }
        }
      }

      await monitoringPlugin.setup!(contextWithoutConfig)
      
      // Should still initialize with defaults
      expect((contextWithoutConfig as any).metricsRegistry).toBeDefined()
    })

    it('should merge custom configuration with defaults', async () => {
      const customConfig = {
        ...mockConfig,
        plugins: {
          ...mockConfig.plugins,
          config: {
            monitoring: {
              enabled: true,
              httpMetrics: false,
              systemMetrics: true
            }
          }
        }
      }

      const customContext = { ...context, config: customConfig }
      await monitoringPlugin.setup!(customContext)
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing monitoring plugin',
        expect.objectContaining({
          httpMetrics: false,
          systemMetrics: true
        })
      )
    })
  })
})