/**
 * Unit Tests for Monitoring Configuration
 * Tests for config/monitoring.config.ts (nested: monitoring, metrics, profiling)
 */

import { describe, it, expect } from 'vitest'
import { monitoringConfig } from '@config'

describe('Monitoring Configuration', () => {
  describe('Nested Structure', () => {
    it('should have monitoring object', () => {
      expect(monitoringConfig.monitoring).toBeDefined()
      expect(typeof monitoringConfig.monitoring).toBe('object')
    })

    it('should have metrics object', () => {
      expect(monitoringConfig.metrics).toBeDefined()
      expect(typeof monitoringConfig.metrics).toBe('object')
    })

    it('should have profiling object', () => {
      expect(monitoringConfig.profiling).toBeDefined()
      expect(typeof monitoringConfig.profiling).toBe('object')
    })
  })

  describe('Monitoring Settings', () => {
    it('should have enabled flag', () => {
      expect(typeof monitoringConfig.monitoring.enabled).toBe('boolean')
    })

    it('should have exporters array', () => {
      expect(Array.isArray(monitoringConfig.monitoring.exporters)).toBe(true)
    })

    it('should have health checks flag', () => {
      expect(typeof monitoringConfig.monitoring.enableHealthChecks).toBe('boolean')
    })

    it('should have valid health check interval', () => {
      expect(typeof monitoringConfig.monitoring.healthCheckInterval).toBe('number')
      expect(monitoringConfig.monitoring.healthCheckInterval).toBeGreaterThan(0)
    })

    it('should have alerts flag', () => {
      expect(typeof monitoringConfig.monitoring.enableAlerts).toBe('boolean')
    })
  })

  describe('Metrics Settings', () => {
    it('should have enabled flag', () => {
      expect(typeof monitoringConfig.metrics.enabled).toBe('boolean')
    })

    it('should have valid collect interval', () => {
      expect(typeof monitoringConfig.metrics.collectInterval).toBe('number')
      expect(monitoringConfig.metrics.collectInterval).toBeGreaterThanOrEqual(1000)
    })

    it('should have metric type flags', () => {
      expect(typeof monitoringConfig.metrics.httpMetrics).toBe('boolean')
      expect(typeof monitoringConfig.metrics.systemMetrics).toBe('boolean')
      expect(typeof monitoringConfig.metrics.customMetrics).toBe('boolean')
    })

    it('should have export flags', () => {
      expect(typeof monitoringConfig.metrics.exportToConsole).toBe('boolean')
      expect(typeof monitoringConfig.metrics.exportToFile).toBe('boolean')
      expect(typeof monitoringConfig.metrics.exportToHttp).toBe('boolean')
    })

    it('should have valid retention period', () => {
      expect(typeof monitoringConfig.metrics.retentionPeriod).toBe('number')
      expect(monitoringConfig.metrics.retentionPeriod).toBeGreaterThan(0)
    })

    it('should have valid max data points', () => {
      expect(typeof monitoringConfig.metrics.maxDataPoints).toBe('number')
      expect(monitoringConfig.metrics.maxDataPoints).toBeGreaterThan(0)
    })
  })

  describe('Profiling Settings', () => {
    it('should have enabled flag', () => {
      expect(typeof monitoringConfig.profiling.enabled).toBe('boolean')
    })

    it('should have valid sample rate', () => {
      expect(typeof monitoringConfig.profiling.sampleRate).toBe('number')
      expect(monitoringConfig.profiling.sampleRate).toBeGreaterThanOrEqual(0)
      expect(monitoringConfig.profiling.sampleRate).toBeLessThanOrEqual(1)
    })

    it('should have profiling type flags', () => {
      expect(typeof monitoringConfig.profiling.memoryProfiling).toBe('boolean')
      expect(typeof monitoringConfig.profiling.cpuProfiling).toBe('boolean')
      expect(typeof monitoringConfig.profiling.heapSnapshot).toBe('boolean')
    })

    it('should have valid output directory', () => {
      expect(typeof monitoringConfig.profiling.outputDir).toBe('string')
      expect(monitoringConfig.profiling.outputDir.length).toBeGreaterThan(0)
    })

    it('should have valid max profiles', () => {
      expect(typeof monitoringConfig.profiling.maxProfiles).toBe('number')
      expect(monitoringConfig.profiling.maxProfiles).toBeGreaterThan(0)
    })
  })

  describe('Type Safety', () => {
    it('should have correct nested types', () => {
      const monitoring: typeof monitoringConfig.monitoring = monitoringConfig.monitoring
      const metrics: typeof monitoringConfig.metrics = monitoringConfig.metrics
      const profiling: typeof monitoringConfig.profiling = monitoringConfig.profiling

      expect(monitoring).toBeDefined()
      expect(metrics).toBeDefined()
      expect(profiling).toBeDefined()
    })
  })
})
