/**
 * FluxStack Core
 * Main exports for the FluxStack framework
 */

// Framework core (primary exports)
export { FluxStackFramework } from './framework/server'
export { FluxStackClient } from './framework/client'

// Server components (includes config types via re-export)
export * from './server'

// Client components
export * from './client'

// Testing utilities
export * from './testing'

// Build system
export * from './build'

// CLI and generators
export * from './cli/generators'

// Plugin system (via @fluxstack/plugin-kit — single source of truth)
export {
  PluginRegistry,
  PluginDiscovery,
  PluginManager,
} from '@fluxstack/plugin-kit'

// Utilities (avoid wildcard export to prevent type duplication)
export {
  LOGGER_CONFIG,
  LOG,
  WARN,
  ERROR,
  DEBUG,
  START,
  SUCCESS,
  IMPORTANT,
  SECTION,
  request as logRequest,
  plugin as logPlugin,
  framework as logFramework,
  time as logTime,
  timeEnd as logTimeEnd,
  clearCache as clearLoggerCache,
  logger,
  log
} from './utils/logger'
export type { Logger } from './utils/logger'
// Note: BuildError types already exported via ./server

// Version
export { FLUXSTACK_VERSION } from './utils/version'
