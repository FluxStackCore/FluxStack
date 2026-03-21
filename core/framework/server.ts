import { Elysia, type AnyElysia } from "elysia"
import type { FluxStackConfig, FluxStackContext } from "@core/types"
import type { FluxStack, PluginContext, PluginUtils, PluginConfigSchema, PluginHook } from "@core/plugins/types"
import { PluginRegistry } from "@core/plugins/registry"
import { PluginManager } from "@core/plugins/manager"
import { fluxStackConfig } from "@config"
import { getEnvironmentInfo } from "@core/config"
import { logger, type Logger } from "@core/utils/logger"
import { displayStartupBanner, type StartupInfo } from "@core/utils/logger/startup-banner"
import { componentRegistry } from "@core/server/live"
import { FluxStackError } from "@core/utils/errors"
import { createTimer, formatBytes, isProduction, isDevelopment } from "@core/utils/helpers"
import { createHash } from "crypto"
import { createPluginUtils } from "@core/plugins/config"
import type { Plugin } from "@core/plugins"

export class FluxStackFramework {
  private app: Elysia
  private context: FluxStackContext
  private pluginRegistry: PluginRegistry
  private pluginManager: PluginManager
  private pluginContext: PluginContext
  private isStarted: boolean = false
  private requestTimings: Map<string, number> = new Map()
  private _originalStderrWrite?: typeof process.stderr.write

  /** Access typed config from context (config is stored as unknown to avoid circular deps) */
  private get cfg(): import('@config').FluxStackConfig {
    return this.context.config as import('@config').FluxStackConfig
  }

  /**
   * Helper to safely parse request.url which might be relative or absolute
   */
  private parseRequestURL(request: Request): URL {
    try {
      // Try parsing as absolute URL first
      return new URL(request.url)
    } catch {
      // If relative, use host from headers or default to localhost
      const host = request.headers.get('host') || 'localhost'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      return new URL(request.url, `${protocol}://${host}`)
    }
  }

  /**
   * Extract client IP from request headers (supports proxies)
   */
  private getClientIP(request: Request): string {
    // Check common proxy headers in order of priority
    const xForwardedFor = request.headers.get('x-forwarded-for')
    if (xForwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first (original client)
      return xForwardedFor.split(',')[0].trim()
    }

    const xRealIP = request.headers.get('x-real-ip')
    if (xRealIP) {
      return xRealIP.trim()
    }

    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    if (cfConnectingIP) {
      return cfConnectingIP.trim()
    }

    // Fallback: try to get from Bun's server socket (if available)
    // This is set by Bun when running in server mode
    const requestWithSocket = request as Request & { ip?: string; remoteAddress?: string }
    const socketIP = requestWithSocket.ip || requestWithSocket.remoteAddress
    if (socketIP) {
      return socketIP
    }

    return '127.0.0.1'
  }

  constructor(config?: Partial<FluxStackConfig>) {
    // Load the full configuration
    const fullConfig = config ? { ...fluxStackConfig, ...config } : fluxStackConfig
    const envInfo = getEnvironmentInfo()

    this.context = {
      config: fullConfig,
      isDevelopment: envInfo.isDevelopment,
      isProduction: envInfo.isProduction,
      isTest: envInfo.isTest,
      environment: envInfo.name
    }

    this.app = new Elysia()
    this.pluginRegistry = new PluginRegistry()

    // Execute onConfigLoad hooks will be called during plugin initialization
    // We defer this until plugins are loaded in initializeAutomaticPlugins()



    // Create plugin utilities
    const pluginUtils: PluginUtils = {
      createTimer,
      formatBytes,
      isProduction,
      isDevelopment,
      getEnvironment: () => envInfo.name,
      createHash: (data: string) => {
        return createHash('sha256').update(data).digest('hex')
      },
      deepMerge: (target: Record<string, unknown>, source: Record<string, unknown>) => {
        const result = { ...target }
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = pluginUtils.deepMerge(result[key] as Record<string, unknown> || {}, source[key] as Record<string, unknown>)
          } else {
            result[key] = source[key]
          }
        }
        return result
      },
      validateSchema: (data: Record<string, unknown>, schema: PluginConfigSchema) => {
        return createPluginUtils(logger).validateSchema(data, schema)
      }
    }

    // Create plugin-compatible logger
    const pluginLogger: Logger = {
      debug: (message: unknown, ...args: unknown[]) => logger.debug(message, ...args),
      info: (message: unknown, ...args: unknown[]) => logger.info(message, ...args),
      warn: (message: unknown, ...args: unknown[]) => logger.warn(message, ...args),
      error: (message: unknown, ...args: unknown[]) => logger.error(message, ...args),
      child: (_context: Record<string, unknown>) => pluginLogger,
      time: (label: string) => logger.time(label),
      timeEnd: (label: string) => logger.timeEnd(label),
      request: (method: string, path: string, status?: number, duration?: number, ip?: string) =>
        logger.request(method, path, status, duration, ip),
      plugin: (pluginName: string, message: string, meta?: unknown) => logger.plugin(pluginName, message, meta),
      framework: (message: string, meta?: unknown) => logger.framework(message, meta)
    }

    this.pluginContext = {
      config: fullConfig,
      logger: pluginLogger,
      app: this.app,
      utils: pluginUtils
    }

    // Initialize plugin manager
    this.pluginManager = new PluginManager({
      config: fullConfig,
      logger: pluginLogger,
      app: this.app
    })

    this.setupCors()
    this.setupHeadHandler()
    this.setupElysiaHeadBugFilter()
    this.setupHooks()
    this.setupErrorHandling()

    logger.debug('FluxStack framework initialized', {
      environment: envInfo.name,
      port: fullConfig.server.port
    })
  }

  private async initializeAutomaticPlugins() {
    try {
      await this.pluginManager.initialize()

      // Sync discovered plugins from PluginManager to main registry
      const discoveredPlugins = this.pluginManager.getRegistry().getAll()
      for (const plugin of discoveredPlugins) {
        if (!this.pluginRegistry.has(plugin.name)) {
          this.pluginRegistry.registerSync(plugin)
        }
      }

      // Refresh load order (falls back to insertion-order on failure)
      this.pluginRegistry.refreshLoadOrder()

      // Execute onConfigLoad hooks for all plugins
      const configLoadContext = {
        config: this.context.config as import('@config').FluxStackConfig,
        envVars: process.env as Record<string, string | undefined>,
        configPath: undefined
      }

      const loadOrder = this.pluginRegistry.getLoadOrder()
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)
        if (plugin && plugin.onConfigLoad) {
          try {
            await plugin.onConfigLoad(configLoadContext)
          } catch (error) {
            logger.error(`Plugin '${pluginName}' onConfigLoad hook failed`, {
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      }

      const stats = this.pluginManager.getRegistry().getStats()
      logger.debug('Automatic plugins loaded successfully', {
        pluginCount: stats.totalPlugins,
        enabledPlugins: stats.enabledPlugins,
        disabledPlugins: stats.disabledPlugins
      })
    } catch (error) {
      logger.error('Failed to initialize automatic plugins', { error })
    }
  }

  private setupCors() {
    const cors = this.cfg.cors

    this.app
      .onRequest(({ set }) => {
        set.headers["Access-Control-Allow-Origin"] = (cors.origins ?? []).join(", ") || "*"
        set.headers["Access-Control-Allow-Methods"] = (cors.methods ?? []).join(", ") || "*"
        set.headers["Access-Control-Allow-Headers"] = (cors.headers ?? []).join(", ") || "*"
        if (cors.credentials) {
          set.headers["Access-Control-Allow-Credentials"] = "true"
        }
      })
      .options("*", ({ set }) => {
        set.status = 200
        return ""
      })
  }

  private setupHeadHandler() {
    // Global HEAD handler to prevent Elysia's automatic HEAD conversion bug
    this.app.head("*", ({ request, set }) => {
      const url = this.parseRequestURL(request)

      // Handle API routes
      if (url.pathname.startsWith(this.cfg.server.apiPrefix)) {
        set.status = 200
        set.headers['Content-Type'] = 'application/json'
        set.headers['Content-Length'] = '0'
        return ""
      }

      // Handle static files (assume they're HTML if no extension)
      const isStatic = url.pathname === '/' || !url.pathname.includes('.')
      if (isStatic) {
        set.status = 200
        set.headers['Content-Type'] = 'text/html'
        set.headers['Cache-Control'] = 'no-cache'
        return ""
      }

      // Handle other file types
      set.status = 200
      set.headers['Content-Type'] = 'application/octet-stream'
      set.headers['Content-Length'] = '0'
      return ""
    })
  }

  private setupElysiaHeadBugFilter() {
    // Only filter in development mode to avoid affecting production logs
    if (process.env.NODE_ENV !== 'development') {
      return
    }

    // Store original stderr.write to restore if needed
    const originalStderrWrite = process.stderr.write

    // Override stderr.write to filter Elysia HEAD bug errors
    process.stderr.write = function (
      chunk: string | Uint8Array,
      encoding?: BufferEncoding | ((error?: Error) => void),
      callback?: (error?: Error) => void
    ): boolean {
      const str = chunk.toString()

      // Filter out known Elysia HEAD bug error patterns
      if (str.includes("TypeError: undefined is not an object (evaluating '_res.headers.set')") ||
        str.includes("HEAD - / failed") ||
        (str.includes("HEAD - ") && str.includes(" failed"))) {
        // Silently ignore these specific errors
        if (typeof encoding === 'function') {
          encoding() // encoding is actually the callback
        } else if (callback) {
          callback()
        }
        return true
      }

      // Pass through all other stderr output
      if (typeof encoding === 'function') {
        return (originalStderrWrite as Function).call(process.stderr, chunk, encoding)
      } else {
        return (originalStderrWrite as Function).call(process.stderr, chunk, encoding, callback)
      }
    }

      // Store reference to restore original behavior if needed
      this._originalStderrWrite = originalStderrWrite
  }

  private setupHooks() {
    // Setup onRequest hook and onBeforeRoute hook
    this.app.onRequest(async ({ request, set }) => {
      const startTime = Date.now()
      const url = this.parseRequestURL(request)

      // Store start time for duration calculation (using request URL as key)
      const requestKey = `${request.method}-${url.pathname}-${startTime}`
      this.requestTimings.set(requestKey, startTime)

      // Store key in set.headers for retrieval in onAfterHandle
      set.headers['x-request-timing-key'] = requestKey

      const requestContext = {
        request,
        path: url.pathname,
        method: request.method,
        headers: (() => {
          const headers: Record<string, string> = {}
          request.headers.forEach((value: string, key: string) => {
            headers[key] = value
          })
          return headers
        })(),
        query: Object.fromEntries(url.searchParams.entries()),
        params: {},
        body: undefined, // Will be populated if request has body
        startTime,
        handled: false,
        response: undefined
      }

      // Try to parse body for validation
      try {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          const contentType = request.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            requestContext.body = await request.clone().json().catch(() => undefined)
          }
        }
      } catch (error) {
        // Ignore body parsing errors for now
      }

      // Execute onRequest hooks for all plugins first (logging, auth, etc.)
      await this.executePluginHooks('onRequest', requestContext)

      // Execute onRequestValidation hooks (for custom validation)
      const validationContext = {
        ...requestContext,
        errors: [] as Array<{ field: string; message: string; code: string }>,
        isValid: true
      }
      await this.executePluginHooks('onRequestValidation', validationContext)

      // If validation failed, return error response
      if (!validationContext.isValid && validationContext.errors.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          errors: validationContext.errors
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Execute onBeforeRoute hooks - allow plugins to handle requests before routing
      const handledResponse = await this.executePluginBeforeRouteHooks(requestContext)

      // If a plugin handled the request, return the response
      if (handledResponse) {
        return handledResponse
      }
    })

    // Setup onAfterHandle hook (covers onBeforeResponse, onResponseTransform, onResponse)
    this.app.onAfterHandle(async ({ request, response, set, path }) => {
      const url = this.parseRequestURL(request)

      // Retrieve start time using the timing key
      const requestKey = set.headers['x-request-timing-key']
      const startTime = requestKey ? this.requestTimings.get(String(requestKey)) : undefined
      const duration = startTime ? Date.now() - startTime : 0

      // Clean up timing entry
      if (requestKey) {
        this.requestTimings.delete(String(requestKey))
      }

      let currentResponse = response

      // Create response context
      const responseContext = {
        request,
        path: url.pathname,
        method: request.method,
        headers: (() => {
          const headers: Record<string, string> = {}
          request.headers.forEach((value: string, key: string) => {
            headers[key] = value
          })
          return headers
        })(),
        query: Object.fromEntries(url.searchParams.entries()),
        params: {},
        response: currentResponse,
        statusCode: Number((currentResponse instanceof Response ? currentResponse.status : undefined) || set.status || 200),
        duration,
        startTime
      }

      // Execute onAfterRoute hooks (route was matched, params available)
      const routeContext = {
        ...responseContext,
        route: path || url.pathname,
        handler: undefined
      }
      await this.executePluginHooks('onAfterRoute', routeContext)

      // Execute onBeforeResponse hooks (can modify headers, response)
      await this.executePluginHooks('onBeforeResponse', responseContext)
      currentResponse = responseContext.response

      // Execute onResponseTransform hooks (can transform response body)
      const transformContext = {
        ...responseContext,
        response: currentResponse,
        transformed: false,
        originalResponse: currentResponse
      }
      await this.executePluginHooks('onResponseTransform', transformContext)

      // Use transformed response if any plugin transformed it
      if (transformContext.transformed && transformContext.response) {
        currentResponse = transformContext.response
        responseContext.response = currentResponse
      }

      // Log the request automatically (if not disabled in config)
      if (this.cfg.server.enableRequestLogging !== false) {
        // Ensure status is always a number (HTTP status code)
        const status = typeof responseContext.statusCode === 'number'
          ? responseContext.statusCode
          : Number(set.status) || 200

        const clientIP = this.getClientIP(request)
        logger.request(request.method, url.pathname, status, duration, clientIP)
      }

      // Execute onResponse hooks for all plugins (final logging, metrics)
      await this.executePluginHooks('onResponse', responseContext)

      // Return the potentially transformed response
      return currentResponse
    })
  }

  private setupErrorHandling() {
    this.app.onError(async ({ error, request, code, set }) => {
      const url = this.parseRequestURL(request)

      // Let plugins handle errors first (e.g. Vite SPA fallback)
      const errorContext = {
        request,
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error : new Error(String(error)),
        handled: false,
        startTime: Date.now()
      }

      const handledResponse = await this.executePluginErrorHooks(errorContext)
      if (handledResponse) {
        return handledResponse
      }

      // For Elysia's own errors (validation, not found, parse), let them pass through
      // Elysia sets proper status codes and messages natively
      if (code === 'VALIDATION' || code === 'PARSE' || code === 'NOT_FOUND') {
        return
      }

      // For FluxStackErrors, use their status code and message
      if (error instanceof FluxStackError) {
        set.status = error.statusCode
        return {
          error: error.code,
          message: error.userMessage || error.message,
          ...(this.context.isDevelopment && { stack: error.stack })
        }
      }

      // Log unexpected errors (actual 500s)
      logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`, {
        path: url.pathname,
        method: request.method
      })

      set.status = 500
      return {
        error: 'INTERNAL_SERVER_ERROR',
        message: this.context.isDevelopment
          ? (error instanceof Error ? error.message : String(error))
          : 'An unexpected error occurred'
      }
    })
  }

  private async executePluginHooks(hookName: PluginHook, context: unknown): Promise<void> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const pluginName of loadOrder) {
      const plugin = this.pluginRegistry.get(pluginName)
      if (!plugin) continue

      const hookFn = plugin[hookName]
      if (typeof hookFn === 'function') {
        try {
          await (hookFn as Function)(context)
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          logger.error(`Plugin '${pluginName}' ${hookName} hook failed`, {
            error: err.message
          })

          // Execute onPluginError hooks on all plugins (except the one that failed)
          await this.executePluginErrorHook(pluginName, plugin.version, err)
        }
      }
    }
  }

  private async executePluginErrorHook(pluginName: string, pluginVersion: string | undefined, error: Error): Promise<void> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const otherPluginName of loadOrder) {
      if (otherPluginName === pluginName) continue // Don't notify the plugin that failed

      const otherPlugin = this.pluginRegistry.get(otherPluginName)
      if (!otherPlugin) continue

      const hookFn = otherPlugin.onPluginError
      if (hookFn && typeof hookFn === 'function') {
        try {
          await hookFn({
            pluginName,
            pluginVersion,
            timestamp: Date.now(),
            error
          })
        } catch (hookError) {
          logger.error(`Plugin '${otherPluginName}' onPluginError hook failed`, {
            error: hookError instanceof Error ? hookError.message : String(hookError)
          })
        }
      }
    }
  }

  private async executePluginBeforeRouteHooks(requestContext: { handled?: boolean; response?: Response; [key: string]: unknown }): Promise<Response | null> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const pluginName of loadOrder) {
      const plugin = this.pluginRegistry.get(pluginName)
      if (!plugin) continue

      const onBeforeRouteFn = plugin.onBeforeRoute
      if (onBeforeRouteFn && typeof onBeforeRouteFn === 'function') {
        try {
          await onBeforeRouteFn(requestContext as unknown as import('@core/plugins/types').RequestContext)

          // If this plugin handled the request, return the response
          if (requestContext.handled && requestContext.response) {
            return requestContext.response
          }
        } catch (error) {
          logger.error(`Plugin '${pluginName}' onBeforeRoute hook failed`, {
            error: (error as Error).message
          })
        }
      }
    }

    return null
  }

  private async executePluginErrorHooks(errorContext: { handled?: boolean; error: Error; request: Request; [key: string]: unknown }): Promise<Response | null> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const pluginName of loadOrder) {
      const plugin = this.pluginRegistry.get(pluginName)
      if (!plugin) continue

      const onErrorFn = plugin.onError
      if (onErrorFn && typeof onErrorFn === 'function') {
        try {
          await onErrorFn(errorContext as unknown as import('@core/plugins/types').ErrorContext)

          // If this plugin handled the error, check if it provides a response
          if (errorContext.handled) {
            // For Vite plugin, we'll handle the proxy here
            if (pluginName === 'vite' && errorContext.error.constructor.name === 'NotFoundError') {
              return await this.handleViteProxy(errorContext)
            }

            // For other plugins, return a basic success response
            return new Response('OK', { status: 200 })
          }
        } catch (error) {
          logger.error(`Plugin '${pluginName}' onError hook failed`, {
            error: (error as Error).message
          })
        }
      }
    }

    return null
  }

  private async handleViteProxy(errorContext: { request: Request; method?: string; headers?: Record<string, string> }): Promise<Response> {
    const vitePort = this.cfg.client?.port || 5173
    const url = this.parseRequestURL(errorContext.request)

    try {
      const viteUrl = `http://localhost:${vitePort}${url.pathname}${url.search}`

      // Forward request to Vite
      const response = await fetch(viteUrl, {
        method: errorContext.method,
        headers: errorContext.headers
      })

      // Return a proper Response object with all headers and status
      const body = await response.arrayBuffer()

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })

    } catch (viteError) {
      // If Vite fails, return error response
      return new Response(`Vite server not ready on port ${vitePort}. Error: ${viteError}`, {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  }

  use(plugin: Plugin) {
    try {
      this.pluginRegistry.registerSync(plugin as FluxStack.Plugin)

      logger.debug(`Plugin '${plugin.name}' registered`, {
        version: (plugin as FluxStack.Plugin).version,
        dependencies: (plugin as FluxStack.Plugin).dependencies
      })
      return this
    } catch (error) {
      logger.error(`Failed to register plugin '${plugin.name}'`, { error: (error as Error).message })
      throw error
    }
  }

  routes(routeModule: AnyElysia) {
    this.app.use(routeModule)
    return this
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Framework is already started')
      return
    }

    try {
      // Initialize automatic plugins before anything else
      // This was previously fire-and-forget in the constructor, causing a race condition
      // where listen() could be called before plugin discovery finished (issue #75)
      await this.initializeAutomaticPlugins()

      // Validate plugin dependencies before starting
      const plugins = this.pluginRegistry.getPluginsMap()
      for (const [pluginName, plugin] of plugins) {
        if (plugin.dependencies) {
          for (const depName of plugin.dependencies) {
            if (!plugins.has(depName)) {
              throw new Error(`Plugin '${pluginName}' depends on '${depName}' which is not registered`)
            }
          }
        }
      }

      // Get load order
      const loadOrder = this.pluginRegistry.getLoadOrder()

      // Call setup hooks for all plugins
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        // Call setup hook if it exists and hasn't been called
        if (plugin.setup) {
          await plugin.setup(this.pluginContext)
        }
      }

      // Call onBeforeServerStart hooks
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onBeforeServerStart) {
          await plugin.onBeforeServerStart(this.pluginContext)
        }
      }

      // Mount plugin routes if they have a plugin property
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        const pluginWithRoutes = plugin as FluxStack.Plugin & { plugin?: Elysia }
        if (pluginWithRoutes.plugin) {
          this.app.use(pluginWithRoutes.plugin)
          logger.debug(`Plugin '${pluginName}' routes mounted`)
        }
      }

      // Call onServerStart hooks
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onServerStart) {
          await plugin.onServerStart(this.pluginContext)
        }
      }

      // Call onAfterServerStart hooks
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onAfterServerStart) {
          await plugin.onAfterServerStart(this.pluginContext)
        }
      }

      this.isStarted = true
      logger.debug('All plugins loaded successfully', {
        pluginCount: loadOrder.length
      })

    } catch (error) {
      logger.error('Failed to start framework', { error: (error as Error).message })
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return
    }

    try {
      // Call onBeforeServerStop hooks in reverse order
      const loadOrder = this.pluginRegistry.getLoadOrder().reverse()

      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onBeforeServerStop) {
          await plugin.onBeforeServerStop(this.pluginContext)
        }
      }

      // Call onServerStop hooks in reverse order
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onServerStop) {
          await plugin.onServerStop(this.pluginContext)
          logger.framework(`Plugin '${pluginName}' server stop hook completed`)
        }
      }

      this.isStarted = false
      logger.framework('Framework stopped successfully')

    } catch (error) {
      logger.error('Error during framework shutdown', { error: (error as Error).message })
      throw error
    }
  }

  getApp() {
    return this.app
  }

  getContext() {
    return this.context
  }

  getPluginRegistry() {
    return this.pluginRegistry
  }

  async listen(callback?: () => void) {
    // Start the framework (load plugins)
    await this.start()

    const port = this.cfg.server.port
    const apiPrefix = this.cfg.server.apiPrefix

    this.app.listen(port, () => {
      const showBanner = this.cfg.server.showBanner !== false // default: true
      const vitePluginActive = this.pluginRegistry.has('vite')

      // Prepare startup info for banner or callback
      const startupInfo: StartupInfo = {
        port,
        host: this.cfg.server.host || 'localhost',
        apiPrefix,
        environment: this.context.environment,
        pluginCount: this.pluginRegistry.getAll().length,
        vitePort: this.cfg.client?.port,
        viteEmbedded: vitePluginActive, // Vite is embedded when plugin is active
        swaggerPath: '/swagger', // TODO: Get from swagger plugin config
        liveComponents: componentRegistry.getRegisteredComponentNames()
      }

      // Display banner if enabled
      if (showBanner) {
        displayStartupBanner(startupInfo)
      }

      // Call user callback with startup info
      callback?.()
    })

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.framework('Received SIGTERM, shutting down gracefully')
      await this.stop()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      logger.framework('Received SIGINT, shutting down gracefully')
      await this.stop()
      process.exit(0)
    })
  }
}