import { Elysia } from "elysia"
import type { FluxStackConfig, FluxStackContext, Plugin } from "../types"
import type { PluginContext, PluginUtils } from "../plugins/types"
import { PluginManager } from "../plugins/manager"
import { fluxStackConfig } from "@/config"
import { getEnvironmentInfo } from "../config"
import { logger, type Logger } from "../utils/logger/index"
import { createTimer, formatBytes, isProduction, isDevelopment } from "../utils/helpers"

export class FluxStackFramework {
  private app: Elysia
  private context: FluxStackContext
  private pluginContext: PluginContext
  private plugins: Plugin[] = []
  private pluginManager: PluginManager
  private initialized = false

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

    // Create plugin utilities
    const pluginUtils: PluginUtils = {
      createTimer,
      formatBytes,
      isProduction,
      isDevelopment,
      getEnvironment: () => envInfo.name,
      createHash: (data: string) => {
        const crypto = require('crypto')
        return crypto.createHash('sha256').update(data).digest('hex')
      },
      deepMerge: (target: any, source: any) => {
        const result = { ...target }
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = pluginUtils.deepMerge(result[key] || {}, source[key])
          } else {
            result[key] = source[key]
          }
        }
        return result
      },
      validateSchema: (_data: any, _schema: any) => {
        // Simple validation - in a real implementation you'd use a proper schema validator
        try {
          // Basic validation logic
          return { valid: true, errors: [] }
        } catch (error) {
          return { valid: false, errors: [error instanceof Error ? error.message : 'Validation failed'] }
        }
      }
    }

    // Create plugin context
    this.pluginContext = {
      config: fullConfig,
      logger: logger as any,
      app: this.app,
      utils: pluginUtils
    }

    // Initialize plugin manager
    this.pluginManager = new PluginManager({
      config: fullConfig,
      logger: logger as any,
      app: this.app
    })

    this.setupCors()
  }

  private setupCors() {
    const cors = this.context.config.cors

    this.app
      .onRequest(({ set }) => {
        set.headers["Access-Control-Allow-Origin"] = cors.origins.join(", ") || "*"
        set.headers["Access-Control-Allow-Methods"] = cors.methods.join(", ") || "*"
        set.headers["Access-Control-Allow-Headers"] = cors.headers.join(", ") || "*"
        if (cors.credentials) {
          set.headers["Access-Control-Allow-Credentials"] = "true"
        }
      })
      .options("*", ({ set }) => {
        set.status = 200
        return ""
      })
  }

  use(plugin: Plugin) {
    this.plugins.push(plugin)
    if (plugin.setup) {
      plugin.setup(this.pluginContext)
    }
    return this
  }

  routes(routeModule: any) {
    this.app.use(routeModule)
    return this
  }

  getApp() {
    return this.app
  }

  getContext() {
    return this.context
  }

  async listen(callback?: () => void) {
    // Initialize plugins synchronously before starting server
    if (!this.initialized) {
      logger.debug('[FluxStack] Initializing automatic plugin discovery...')

      try {
        await this.pluginManager.initialize()
        const stats = this.pluginManager.getRegistry().getStats()

        logger.info('[FluxStack] Automatic plugins loaded successfully', {
          pluginCount: stats.totalPlugins,
          enabledPlugins: stats.enabledPlugins,
          disabledPlugins: stats.disabledPlugins
        })

        this.initialized = true
      } catch (error) {
        logger.error('[FluxStack] Failed to initialize automatic plugins', { error })
        throw error
      }
    }

    const port = this.context.config.server.port
    const apiPrefix = this.context.config.server.apiPrefix

    this.app.listen(port, () => {
      logger.info('[FluxStack] Server started on port ' + port, {
        apiPrefix,
        environment: this.context.environment,
        manualPlugins: this.plugins.length,
        automaticPlugins: this.pluginManager.getRegistry().getStats().totalPlugins
      })
      console.log(`🚀 API ready at http://localhost:${port}${apiPrefix}`)
      console.log(`📋 Health check: http://localhost:${port}${apiPrefix}/health`)
      console.log()
      callback?.()
    })

    return this
  }
}