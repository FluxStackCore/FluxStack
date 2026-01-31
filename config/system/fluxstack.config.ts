/**
 * FluxStack Main Configuration
 * Composes all modular system configs into a single unified configuration
 *
 * ✨ 100% modular and type-safe using defineConfig
 * ✨ No composer needed - direct config composition
 * ✨ All configs use defineConfig for automatic validation and inference
 */

import { appConfig } from './app.config'
import { serverConfig } from './server.config'
import { clientConfig } from './client.config'
import { buildConfig } from './build.config'
import { loggerConfig } from './logger.config'
import { pluginsConfig } from './plugins.config'
import { monitoringConfig } from './monitoring.config'
import { appRuntimeConfig } from './runtime.config'
import { systemConfig } from './system.config'

/**
 * FluxStack complete configuration
 * Direct composition of all modular configs
 */
export const fluxStackConfig = {
  // Core system configs
  app: appConfig,
  server: serverConfig.server,
  client: clientConfig.vite,
  build: buildConfig.build,

  // CORS (from server)
  cors: serverConfig.cors,

  // Client Build (from client)
  clientBuild: clientConfig.build,

  // Build optimization
  optimization: buildConfig.optimization,

  // Logging, plugins, monitoring
  logging: loggerConfig,
  plugins: pluginsConfig,
  monitoring: monitoringConfig,

  // Runtime & system
  runtime: appRuntimeConfig.values,
  system: systemConfig
} as const

/**
 * Type for the complete FluxStack configuration
 */
export type FluxStackConfig = typeof fluxStackConfig

/**
 * Named exports
 */
export default fluxStackConfig
export { fluxStackConfig as config }
