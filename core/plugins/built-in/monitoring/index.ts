/**
 * Monitoring Plugin for FluxStack
 * Provides performance monitoring, metrics collection, and system monitoring
 */

import type { FluxStack, PluginContext, RequestContext, ResponseContext, ErrorContext } from "@core/plugins/types"
import { MetricsCollector } from "@core/utils/monitoring"
import { appConfig, monitoringConfig } from '@config'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

// Enhanced metrics interfaces
interface Metric {
  name: string
  value: number
  timestamp: number
  labels?: Record<string, string>
}

interface Counter extends Metric {
  type: 'counter'
  inc(value?: number): void
}

interface Gauge extends Metric {
  type: 'gauge'
  set(value: number): void
  inc(value?: number): void
  dec(value?: number): void
}

interface Histogram extends Metric {
  type: 'histogram'
  buckets: number[]
  values: number[]
  observe(value: number): void
}

interface MetricsRegistry {
  counters: Map<string, Counter>
  gauges: Map<string, Gauge>
  histograms: Map<string, Histogram>
}

// SystemMetrics and HttpMetrics are now imported from MetricsCollector

export interface MetricsExporter {
  type: 'prometheus' | 'json' | 'console' | 'file'
  endpoint?: string
  interval?: number
  enabled: boolean
  format?: 'text' | 'json'
  filePath?: string
}

export interface AlertThreshold {
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  value: number
  severity: 'info' | 'warning' | 'error' | 'critical'
  message?: string
}

type Plugin = FluxStack.Plugin

/** Extended plugin context with monitoring-specific properties */
interface MonitoringPluginContext extends PluginContext {
  metricsRegistry?: MetricsRegistry
  metricsCollector?: MetricsCollector
  monitoringConfig?: MonitoringOptions
  monitoringIntervals?: NodeJS.Timeout[]
  config: PluginContext['config'] & {
    monitoring?: Record<string, unknown>
    plugins?: { config?: { monitoring?: Partial<MonitoringOptions> } }
  }
}

/** Extended request context with monitoring start time */
interface MonitoringRequestContext extends RequestContext {
  monitoringStartTime?: number
  metricsRegistry?: MetricsRegistry
  metricsCollector?: MetricsCollector
  logger?: { warn: (message: string, meta?: unknown) => void }
}

/** Extended response context with monitoring start time */
interface MonitoringResponseContext extends ResponseContext {
  monitoringStartTime?: number
  metricsRegistry?: MetricsRegistry
  metricsCollector?: MetricsCollector
  logger?: { warn: (message: string, meta?: unknown) => void }
  monitoringConfig?: MonitoringOptions
  context?: { monitoringConfig?: MonitoringOptions }
}

/** Extended error context with monitoring properties */
interface MonitoringErrorContext extends ErrorContext {
  metricsRegistry?: MetricsRegistry
  metricsCollector?: MetricsCollector
}

// Default configuration values (uses monitoringConfig from /config)
const DEFAULTS = {
  enabled: monitoringConfig.monitoring.enabled,
  httpMetrics: monitoringConfig.metrics.httpMetrics,
  systemMetrics: monitoringConfig.metrics.systemMetrics,
  customMetrics: monitoringConfig.metrics.customMetrics,
  collectInterval: monitoringConfig.metrics.collectInterval,
  retentionPeriod: monitoringConfig.metrics.retentionPeriod,
  exporters: [
    {
      type: "console" as "console" | "prometheus" | "json" | "file",
      interval: 30000,
      enabled: monitoringConfig.metrics.exportToConsole
    },
    {
      type: "prometheus" as "console" | "prometheus" | "json" | "file",
      endpoint: "/metrics",
      enabled: true,
      format: "text" as const
    }
  ] as MetricsExporter[],
  thresholds: {
    responseTime: 1000, // ms
    errorRate: 0.05, // 5%
    memoryUsage: 0.8, // 80%
    cpuUsage: 0.8 // 80%
  },
  alerts: [] as AlertThreshold[]
}

type MonitoringOptions = { [K in keyof typeof DEFAULTS]: typeof DEFAULTS[K] extends number ? number : typeof DEFAULTS[K] extends boolean ? boolean : typeof DEFAULTS[K] }

function mergeMonitoringOptions(base: MonitoringOptions, overrides: Partial<MonitoringOptions>): MonitoringOptions {
  const result = { ...base } as Record<string, unknown>
  const baseRecord = base as Record<string, unknown>

  for (const key of Object.keys(overrides) as (keyof MonitoringOptions)[]) {
    const value = (overrides as Record<string, unknown>)[key]
    if (value === undefined) continue

    if (Array.isArray(value)) {
      result[key] = value
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = { ...(baseRecord[key] as object), ...(value as object) }
    } else {
      result[key] = value
    }
  }

  return result as unknown as MonitoringOptions
}

function resolveMonitoringOptions(source: MonitoringResponseContext | MonitoringPluginContext): MonitoringOptions {
  if ('monitoringConfig' in source && source.monitoringConfig) return source.monitoringConfig
  if ('context' in source && (source as MonitoringResponseContext).context?.monitoringConfig) return (source as MonitoringResponseContext).context!.monitoringConfig!
  return DEFAULTS
}

function normalizeRuntimeMonitoringConfig(runtime: Record<string, unknown> | undefined): Partial<MonitoringOptions> {
  if (!runtime) return {}
  const overrides: Partial<MonitoringOptions> = {}

  if (typeof runtime.enabled === 'boolean') overrides.enabled = runtime.enabled
  if (runtime.metrics && typeof runtime.metrics === 'object') {
    const metrics = runtime.metrics as Record<string, unknown>
    if (typeof metrics.httpMetrics === 'boolean') overrides.httpMetrics = metrics.httpMetrics
    if (typeof metrics.systemMetrics === 'boolean') overrides.systemMetrics = metrics.systemMetrics
    if (typeof metrics.customMetrics === 'boolean') overrides.customMetrics = metrics.customMetrics
    if (typeof metrics.collectInterval === 'number') overrides.collectInterval = metrics.collectInterval
    if (typeof metrics.retentionPeriod === 'number') overrides.retentionPeriod = metrics.retentionPeriod
  }
  if (Array.isArray(runtime.exporters)) {
    overrides.exporters = runtime.exporters as MetricsExporter[]
  }
  if (runtime.thresholds && typeof runtime.thresholds === 'object') {
    overrides.thresholds = { ...DEFAULTS.thresholds, ...(runtime.thresholds as Record<string, number>) }
  }
  if (Array.isArray(runtime.alerts)) {
    overrides.alerts = runtime.alerts as AlertThreshold[]
  }

  return overrides
}

const monitoringPluginConfigSchema = {
  type: 'object' as const,
  properties: {
    enabled: { type: 'boolean' },
    httpMetrics: { type: 'boolean' },
    systemMetrics: { type: 'boolean' },
    customMetrics: { type: 'boolean' },
    collectInterval: { type: 'number' },
    retentionPeriod: { type: 'number' },
    exporters: { type: 'array' }
  }
}

export const monitoringPlugin: Plugin = {
  name: "monitoring",
  version: "1.0.0",
  description: "Performance monitoring plugin with metrics collection and system monitoring",
  author: "FluxStack Team",
  priority: 900, // Should run early to capture all metrics
  category: "monitoring",
  tags: ["monitoring", "metrics", "performance", "observability"],
  dependencies: [],
  configSchema: monitoringPluginConfigSchema,
  defaultConfig: DEFAULTS,

  setup: async (context: PluginContext) => {
    const monCtx = context as MonitoringPluginContext
    const runtimeOverrides = normalizeRuntimeMonitoringConfig(monCtx.config?.monitoring as Record<string, unknown> | undefined)
    const pluginOverrides = monCtx.config?.plugins?.config?.monitoring as Partial<MonitoringOptions> | undefined
    const resolvedConfig = mergeMonitoringOptions(
      mergeMonitoringOptions(DEFAULTS, runtimeOverrides),
      pluginOverrides || {}
    )

    if (!resolvedConfig.enabled) {
      context.logger.info('Monitoring plugin disabled by configuration')
      return
    }

    context.logger.info('Initializing monitoring plugin', {
      httpMetrics: resolvedConfig.httpMetrics,
      systemMetrics: resolvedConfig.systemMetrics,
      customMetrics: resolvedConfig.customMetrics,
      exporters: resolvedConfig.exporters.length,
      alerts: resolvedConfig.alerts.length
    })

    const metricsRegistry: MetricsRegistry = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map()
    }

    const metricsCollector = new MetricsCollector()

    monCtx.metricsRegistry = metricsRegistry
    monCtx.metricsCollector = metricsCollector
    monCtx.monitoringConfig = resolvedConfig

    if (resolvedConfig.httpMetrics) {
      initializeHttpMetrics(metricsRegistry, metricsCollector)
    }

    if (resolvedConfig.systemMetrics) {
      startSystemMetricsCollection(context, metricsCollector, resolvedConfig)
    }

    setupMetricsEndpoint(context, metricsRegistry, metricsCollector, resolvedConfig)
    startMetricsExporters(context, metricsRegistry, metricsCollector, resolvedConfig)
    setupMetricsCleanup(context, metricsRegistry, resolvedConfig)

    if (resolvedConfig.alerts.length > 0) {
      setupAlertMonitoring(context, metricsRegistry, resolvedConfig.alerts)
    }

    context.logger.info('Monitoring plugin initialized successfully')
  },

  onServerStart: async (context: PluginContext) => {
    const options = resolveMonitoringOptions(context)
    if (options.enabled) {
      context.logger.info('Monitoring plugin: Server monitoring started', {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform
      })

      // Record server start metric
      const metricsRegistry = (context as MonitoringPluginContext).metricsRegistry
      if (metricsRegistry) {
        recordCounter(metricsRegistry, 'server_starts_total', 1, {
          version: (appConfig.version as string) ?? '1.0.0'
        })
      }
    }
  },

  onServerStop: async (context: PluginContext) => {
    const options = resolveMonitoringOptions(context)
    if (options.enabled) {
      context.logger.info('Monitoring plugin: Server monitoring stopped')

      // Record server stop metric
      const monCtx = context as MonitoringPluginContext
      const metricsRegistry = monCtx.metricsRegistry
      if (metricsRegistry) {
        recordCounter(metricsRegistry, 'server_stops_total', 1)
      }

      // Cleanup intervals
      const intervals = monCtx.monitoringIntervals
      if (intervals) {
        intervals.forEach(interval => clearInterval(interval))
      }
    }
  },

  onRequest: async (requestContext: RequestContext) => {
    const startTime = Date.now()
    const monReqCtx = requestContext as MonitoringRequestContext

    // Store start time for duration calculation
    monReqCtx.monitoringStartTime = startTime

    // Get metrics registry and collector from context
    const metricsRegistry = getMetricsRegistry(monReqCtx)
    const metricsCollector = getMetricsCollector(monReqCtx)
    if (!metricsRegistry || !metricsCollector) return

    // Record request metrics
    recordCounter(metricsRegistry, 'http_requests_total', 1, {
      method: requestContext.method,
      path: requestContext.path
    })

    // Record request size if available
    const contentLength = requestContext.headers['content-length']
    if (contentLength) {
      const size = parseInt(contentLength)
      recordHistogram(metricsRegistry, 'http_request_size_bytes', size, {
        method: requestContext.method
      })
    }

    // Record in collector as well
    const counter = metricsCollector.getAllMetrics().get('http_requests_total')
    if (counter && 'inc' in counter && typeof counter.inc === 'function') {
      counter.inc(1, { method: requestContext.method, path: requestContext.path })
    }
  },

  onResponse: async (responseContext: ResponseContext) => {
    const monResCtx = responseContext as MonitoringResponseContext
    const metricsRegistry = getMetricsRegistry(monResCtx)
    const metricsCollector = getMetricsCollector(monResCtx)
    if (!metricsRegistry || !metricsCollector) return

    const startTime = monResCtx.monitoringStartTime || responseContext.startTime
    const duration = Date.now() - startTime

    // Record response metrics
    recordHistogram(metricsRegistry, 'http_request_duration_ms', duration, {
      method: responseContext.method,
      path: responseContext.path,
      status_code: responseContext.statusCode.toString()
    })

    // Record response size
    if (responseContext.size) {
      recordHistogram(metricsRegistry, 'http_response_size_bytes', responseContext.size, {
        method: responseContext.method,
        status_code: responseContext.statusCode.toString()
      })
    }

    // Record status code
    recordCounter(metricsRegistry, 'http_responses_total', 1, {
      method: responseContext.method,
      status_code: responseContext.statusCode.toString()
    })

    // Record in collector
    metricsCollector.recordHttpRequest(
      responseContext.method,
      responseContext.path,
      responseContext.statusCode,
      duration,
      parseInt(responseContext.headers['content-length'] || '0') || undefined,
      responseContext.size
    )

    const options = resolveMonitoringOptions(monResCtx)
    if (options.thresholds.responseTime && duration > options.thresholds.responseTime) {
      const logger = monResCtx.logger || console
      logger.warn(`Slow request detected: ${responseContext.method} ${responseContext.path} took ${duration}ms`, {
        method: responseContext.method,
        path: responseContext.path,
        duration,
        threshold: options.thresholds.responseTime
      })
    }
  },

  onError: async (errorContext: ErrorContext) => {
    const monErrCtx = errorContext as MonitoringErrorContext
    const metricsRegistry = getMetricsRegistry(monErrCtx)
    const metricsCollector = getMetricsCollector(monErrCtx)
    if (!metricsRegistry || !metricsCollector) return

    // Record error metrics
    recordCounter(metricsRegistry, 'http_errors_total', 1, {
      method: errorContext.method,
      path: errorContext.path,
      error_type: errorContext.error.name
    })

    // Record error duration
    recordHistogram(metricsRegistry, 'http_error_duration_ms', errorContext.duration, {
      method: errorContext.method,
      error_type: errorContext.error.name
    })

    // Record in collector (treat as 500 error)
    metricsCollector.recordHttpRequest(
      errorContext.method,
      errorContext.path,
      500,
      errorContext.duration
    )

    // Increment error counter in collector
    const errorCounter = metricsCollector.getAllMetrics().get('http_errors_total')
    if (errorCounter && 'inc' in errorCounter && typeof errorCounter.inc === 'function') {
      errorCounter.inc(1, {
        method: errorContext.method,
        path: errorContext.path,
        error_type: errorContext.error.name
      })
    }
  }
}

// Helper functions

function getMetricsRegistry(context: { metricsRegistry?: MetricsRegistry }): MetricsRegistry | null {
  return context.metricsRegistry || null
}

function getMetricsCollector(context: { metricsCollector?: MetricsCollector }): MetricsCollector | null {
  return context.metricsCollector || null
}

function initializeHttpMetrics(registry: MetricsRegistry, collector: MetricsCollector) {
  // Initialize HTTP-related counters and histograms
  recordCounter(registry, 'http_requests_total', 0)
  recordCounter(registry, 'http_responses_total', 0)
  recordCounter(registry, 'http_errors_total', 0)
  recordHistogram(registry, 'http_request_duration_ms', 0)
  recordHistogram(registry, 'http_request_size_bytes', 0)
  recordHistogram(registry, 'http_response_size_bytes', 0)

  // Initialize metrics in collector
  collector.createCounter('http_requests_total', 'Total number of HTTP requests')
  collector.createCounter('http_responses_total', 'Total number of HTTP responses')
  collector.createCounter('http_errors_total', 'Total number of HTTP errors')
  collector.createHistogram('http_request_duration_seconds', 'HTTP request duration in seconds', [0.1, 0.5, 1, 2.5, 5, 10])
  collector.createHistogram('http_request_size_bytes', 'HTTP request size in bytes', [100, 1000, 10000, 100000, 1000000])
  collector.createHistogram('http_response_size_bytes', 'HTTP response size in bytes', [100, 1000, 10000, 100000, 1000000])
}

function startSystemMetricsCollection(context: PluginContext, collector: MetricsCollector, options: MonitoringOptions) {
  const intervals: NodeJS.Timeout[] = []
  const cpuCount = os.cpus().length // Cache — CPU count does not change at runtime

  // Initialize system metrics in collector
  collector.createGauge('process_memory_rss_bytes', 'Process resident set size in bytes')
  collector.createGauge('process_memory_heap_used_bytes', 'Process heap used in bytes')
  collector.createGauge('process_memory_heap_total_bytes', 'Process heap total in bytes')
  collector.createGauge('process_memory_external_bytes', 'Process external memory in bytes')
  collector.createGauge('process_cpu_user_seconds_total', 'Process CPU user time in seconds')
  collector.createGauge('process_cpu_system_seconds_total', 'Process CPU system time in seconds')
  collector.createGauge('process_uptime_seconds', 'Process uptime in seconds')
  collector.createGauge('process_pid', 'Process ID')
  collector.createGauge('nodejs_version_info', 'Node.js version info')
  
  if (process.platform !== 'win32') {
    collector.createGauge('system_load_average_1m', 'System load average over 1 minute')
    collector.createGauge('system_load_average_5m', 'System load average over 5 minutes')
    collector.createGauge('system_load_average_15m', 'System load average over 15 minutes')
  }

  const collectSystemMetrics = () => {
    const metricsRegistry = (context as MonitoringPluginContext).metricsRegistry
    if (!metricsRegistry) return

    try {
      // Memory metrics
      const memUsage = process.memoryUsage()
      recordGauge(metricsRegistry, 'process_memory_rss_bytes', memUsage.rss)
      recordGauge(metricsRegistry, 'process_memory_heap_used_bytes', memUsage.heapUsed)
      recordGauge(metricsRegistry, 'process_memory_heap_total_bytes', memUsage.heapTotal)
      recordGauge(metricsRegistry, 'process_memory_external_bytes', memUsage.external)

      // CPU metrics
      const cpuUsage = process.cpuUsage()
      recordGauge(metricsRegistry, 'process_cpu_user_seconds_total', cpuUsage.user / 1000000)
      recordGauge(metricsRegistry, 'process_cpu_system_seconds_total', cpuUsage.system / 1000000)

      // Process metrics
      recordGauge(metricsRegistry, 'process_uptime_seconds', process.uptime())
      recordGauge(metricsRegistry, 'process_pid', process.pid)
      recordGauge(metricsRegistry, 'nodejs_version_info', 1, { version: process.version })

      // System metrics
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      recordGauge(metricsRegistry, 'system_memory_total_bytes', totalMem)
      recordGauge(metricsRegistry, 'system_memory_free_bytes', freeMem)
      recordGauge(metricsRegistry, 'system_memory_used_bytes', totalMem - freeMem)

      // CPU count (cached)
      recordGauge(metricsRegistry, 'system_cpu_count', cpuCount)

      // Load average (Unix-like systems only)
      if (process.platform !== 'win32') {
        const loadAvg = os.loadavg()
        recordGauge(metricsRegistry, 'system_load_average_1m', loadAvg[0])
        recordGauge(metricsRegistry, 'system_load_average_5m', loadAvg[1])
        recordGauge(metricsRegistry, 'system_load_average_15m', loadAvg[2])
      }

      // Event loop lag measurement
      const start = process.hrtime.bigint()
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6 // Convert to milliseconds
        recordGauge(metricsRegistry, 'nodejs_eventloop_lag_seconds', lag / 1000)
      })

    } catch (error) {
      context.logger.error('Error collecting system metrics', { error })
    }
  }

  // Collect metrics immediately and then at intervals
  collectSystemMetrics()
  const interval = setInterval(collectSystemMetrics, options.collectInterval as number)
  intervals.push(interval)

  // Store intervals for cleanup
  ;(context as MonitoringPluginContext).monitoringIntervals = intervals
}

function setupMetricsEndpoint(context: PluginContext, _registry: MetricsRegistry, collector: MetricsCollector, options: MonitoringOptions) {
  const prometheusExporter = options.exporters.find((e) => e.type === 'prometheus' && e.enabled)
  if (!prometheusExporter) return

  const endpoint = prometheusExporter.endpoint || '/metrics'
  
  // Add metrics endpoint to the app
  const app = context.app as Record<string, unknown>
  if (app && typeof app.get === 'function') {
    (app.get as Function)(endpoint, () => {
      const prometheusData = collector.exportPrometheus()
      return new Response(prometheusData, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
        }
      })
    })
    
    context.logger.info(`Metrics endpoint available at ${endpoint}`)
  }
}

function startMetricsExporters(context: PluginContext, registry: MetricsRegistry, collector: MetricsCollector, options: MonitoringOptions) {
  const intervals: NodeJS.Timeout[] = (context as MonitoringPluginContext).monitoringIntervals || []

  for (const exporterConfig of options.exporters) {
    if (!exporterConfig.enabled) continue

    const exportMetrics = () => {
      try {
        switch (exporterConfig.type) {
          case 'console':
            exportToConsole(registry, collector, context.logger)
            break
          case 'prometheus':
            if (!exporterConfig.endpoint) {
              // Only export to logs if no endpoint is configured
              exportToPrometheus(registry, collector, exporterConfig, context.logger)
            }
            break
          case 'json':
            exportToJson(registry, collector, exporterConfig, context.logger)
            break
          case 'file':
            exportToFile(registry, collector, exporterConfig, context.logger)
            break
          default:
            context.logger.warn(`Unknown exporter type: ${exporterConfig.type}`)
        }
      } catch (error) {
        context.logger.error(`Error in ${exporterConfig.type} exporter`, { error })
      }
    }

    if (exporterConfig.interval) {
      const interval = setInterval(exportMetrics, exporterConfig.interval)
      intervals.push(interval)
    }
  }

  ;(context as MonitoringPluginContext).monitoringIntervals = intervals
}

function setupAlertMonitoring(context: PluginContext, registry: MetricsRegistry, alerts: AlertThreshold[]) {
  const intervals: NodeJS.Timeout[] = (context as MonitoringPluginContext).monitoringIntervals || []

  const checkAlerts = () => {
    for (const alert of alerts) {
      try {
        const metricValue = getMetricValue(registry, alert.metric)
        if (metricValue !== null && evaluateThreshold(metricValue, alert.operator, alert.value)) {
          const message = alert.message || `Alert: ${alert.metric} ${alert.operator} ${alert.value} (current: ${metricValue})`
          
          switch (alert.severity) {
            case 'critical':
            case 'error':
              context.logger.error(message, { 
                metric: alert.metric, 
                value: metricValue, 
                threshold: alert.value,
                severity: alert.severity
              })
              break
            case 'warning':
              context.logger.warn(message, { 
                metric: alert.metric, 
                value: metricValue, 
                threshold: alert.value,
                severity: alert.severity
              })
              break
            case 'info':
            default:
              context.logger.info(message, { 
                metric: alert.metric, 
                value: metricValue, 
                threshold: alert.value,
                severity: alert.severity
              })
              break
          }
        }
      } catch (error) {
        context.logger.error(`Error checking alert for ${alert.metric}`, { error })
      }
    }
  }

  // Check alerts every 30 seconds
  const interval = setInterval(checkAlerts, 30000)
  intervals.push(interval)

  ;(context as MonitoringPluginContext).monitoringIntervals = intervals
}

function setupMetricsCleanup(context: PluginContext, registry: MetricsRegistry, options: MonitoringOptions) {
  const intervals: NodeJS.Timeout[] = (context as MonitoringPluginContext).monitoringIntervals || []

  const cleanup = () => {
    const now = Date.now()
    const cutoff = now - ((options.retentionPeriod as number) ?? 3600000)

    // Clean up old metrics
    for (const [key, metric] of registry.counters.entries()) {
      if (metric.timestamp < cutoff) {
        registry.counters.delete(key)
      }
    }

    for (const [key, metric] of registry.gauges.entries()) {
      if (metric.timestamp < cutoff) {
        registry.gauges.delete(key)
      }
    }

    for (const [key, metric] of registry.histograms.entries()) {
      if (metric.timestamp < cutoff) {
        registry.histograms.delete(key)
      }
    }
  }

  // Clean up every minute
  const interval = setInterval(cleanup, 60000)
  intervals.push(interval)

  ;(context as MonitoringPluginContext).monitoringIntervals = intervals
}

// Metrics recording functions
function recordCounter(registry: MetricsRegistry, name: string, value: number, labels?: Record<string, string>) {
  const key = createMetricKey(name, labels)
  const existing = registry.counters.get(key)
  
  registry.counters.set(key, {
    type: 'counter',
    name,
    value: existing ? existing.value + value : value,
    timestamp: Date.now(),
    labels,
    inc: (incValue = 1) => {
      const metric = registry.counters.get(key)
      if (metric) {
        metric.value += incValue
        metric.timestamp = Date.now()
      }
    }
  })
}

function recordGauge(registry: MetricsRegistry, name: string, value: number, labels?: Record<string, string>) {
  const key = createMetricKey(name, labels)
  
  registry.gauges.set(key, {
    type: 'gauge',
    name,
    value,
    timestamp: Date.now(),
    labels,
    set: (newValue: number) => {
      const metric = registry.gauges.get(key)
      if (metric) {
        metric.value = newValue
        metric.timestamp = Date.now()
      }
    },
    inc: (incValue = 1) => {
      const metric = registry.gauges.get(key)
      if (metric) {
        metric.value += incValue
        metric.timestamp = Date.now()
      }
    },
    dec: (decValue = 1) => {
      const metric = registry.gauges.get(key)
      if (metric) {
        metric.value -= decValue
        metric.timestamp = Date.now()
      }
    }
  })
}

const MAX_HISTOGRAM_VALUES = 1000

function recordHistogram(registry: MetricsRegistry, name: string, value: number, labels?: Record<string, string>) {
  const key = createMetricKey(name, labels)

  const existing = registry.histograms.get(key)
  if (existing) {
    if (existing.values.length >= MAX_HISTOGRAM_VALUES) {
      // Keep the most recent half to preserve statistical relevance
      existing.values = existing.values.slice(MAX_HISTOGRAM_VALUES >> 1)
    }
    existing.values.push(value)
    existing.timestamp = Date.now()
  } else {
    registry.histograms.set(key, {
      type: 'histogram',
      name,
      value,
      timestamp: Date.now(),
      labels,
      buckets: [0.1, 0.5, 1, 2.5, 5, 10],
      values: [value],
      observe: (observeValue: number) => {
        const metric = registry.histograms.get(key)
        if (metric) {
          metric.values.push(observeValue)
          metric.timestamp = Date.now()
        }
      }
    })
  }
}

function createMetricKey(name: string, labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) {
    return name
  }
  
  const labelString = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}="${value}"`)
    .join(',')
  
  return `${name}{${labelString}}`
}

function getMetricValue(registry: MetricsRegistry, metricName: string): number | null {
  // Check counters
  const counter = registry.counters.get(metricName)
  if (counter) return counter.value

  // Check gauges
  const gauge = registry.gauges.get(metricName)
  if (gauge) return gauge.value

  // Check histograms (return average)
  const histogram = registry.histograms.get(metricName)
  if (histogram && histogram.values.length > 0) {
    return histogram.values.reduce((sum, val) => sum + val, 0) / histogram.values.length
  }

  return null
}

function evaluateThreshold(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold
    case '<': return value < threshold
    case '>=': return value >= threshold
    case '<=': return value <= threshold
    case '==': return value === threshold
    case '!=': return value !== threshold
    default: return false
  }
}

// Enhanced Exporters
function exportToConsole(registry: MetricsRegistry, collector: MetricsCollector, logger: { info: (message: string, meta?: unknown) => void }) {
  const metrics = {
    counters: Array.from(registry.counters.values()),
    gauges: Array.from(registry.gauges.values()),
    histograms: Array.from(registry.histograms.values())
  }

  const systemMetrics = collector.getSystemMetrics()
  const httpMetrics = collector.getHttpMetrics()

  logger.info('Metrics snapshot', {
    timestamp: new Date().toISOString(),
    counters: metrics.counters.length,
    gauges: metrics.gauges.length,
    histograms: metrics.histograms.length,
    system: systemMetrics,
    http: httpMetrics,
    metrics
  })
}

function exportToPrometheus(_registry: MetricsRegistry, collector: MetricsCollector, config: MetricsExporter, logger: { debug: (message: string, meta?: unknown) => void; error: (message: string, meta?: unknown) => void }) {
  const prometheusData = collector.exportPrometheus()
  
  if (config.endpoint && config.endpoint !== '/metrics') {
    // POST to Prometheus pushgateway
    fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
      },
      body: prometheusData
    }).catch(error => {
      logger.error('Failed to push metrics to Prometheus', { error, endpoint: config.endpoint })
    })
  } else {
    logger.debug('Prometheus metrics generated', { lines: prometheusData.split('\n').length })
  }
}

function exportToJson(registry: MetricsRegistry, collector: MetricsCollector, config: MetricsExporter, logger: { info: (message: string, meta?: unknown) => void; error: (message: string, meta?: unknown) => void }) {
  const data = {
    timestamp: new Date().toISOString(),
    system: collector.getSystemMetrics(),
    http: collector.getHttpMetrics(),
    counters: Object.fromEntries(registry.counters.entries()),
    gauges: Object.fromEntries(registry.gauges.entries()),
    histograms: Object.fromEntries(registry.histograms.entries())
  }
  
  if (config.endpoint) {
    // POST to JSON endpoint
    fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).catch(error => {
      logger.error('Failed to export metrics to JSON endpoint', { error, endpoint: config.endpoint })
    })
  } else {
    logger.info('JSON metrics export', data)
  }
}

function exportToFile(registry: MetricsRegistry, collector: MetricsCollector, config: MetricsExporter, logger: { debug: (message: string, meta?: unknown) => void; warn: (message: string, meta?: unknown) => void; error: (message: string, meta?: unknown) => void }) {
  if (!config.filePath) {
    logger.warn('File exporter configured but no filePath specified')
    return
  }

  const data = {
    timestamp: new Date().toISOString(),
    system: collector.getSystemMetrics(),
    http: collector.getHttpMetrics(),
    counters: Object.fromEntries(registry.counters.entries()),
    gauges: Object.fromEntries(registry.gauges.entries()),
    histograms: Object.fromEntries(registry.histograms.entries())
  }

  const content = config.format === 'json' 
    ? JSON.stringify(data, null, 2)
    : collector.exportPrometheus()

  try {
    // Ensure directory exists
    const dir = path.dirname(config.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Write metrics to file
    fs.writeFileSync(config.filePath, content, 'utf8')
    logger.debug('Metrics exported to file', { filePath: config.filePath, format: config.format })
  } catch (error) {
    logger.error('Failed to export metrics to file', { error, filePath: config.filePath })
  }
}

export function formatPrometheusLabels(labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) {
    return ''
  }
  
  const labelPairs = Object.entries(labels)
    .map(([key, value]) => `${key}="${value}"`)
    .join(',')
  
  return `{${labelPairs}}`
}

export default monitoringPlugin
