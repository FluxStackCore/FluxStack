/**
 * Plugins Configuration
 * Declarative plugin management configuration
 */

import { defineConfig, config } from '@/core/utils/config-schema'
import { env } from '@/core/utils/env'
import { FLUXSTACK_VERSION } from '@/core/utils/version'

export const pluginsConfig = defineConfig({
  // Plugin management
  enabled: config.array(
    'FLUXSTACK_PLUGINS_ENABLED',
    ['logger', 'swagger', 'vite', 'cors', 'static-files']
  ),

  disabled: config.array('FLUXSTACK_PLUGINS_DISABLED', []),

  // Auto-discovery
  autoDiscover: config.boolean('PLUGINS_AUTO_DISCOVER', true),

  pluginsDir: config.string('PLUGINS_DIR', 'plugins'),

  // Plugin-specific configurations
  // Logger plugin (handled by logger.config.ts)
  loggerEnabled: config.boolean('LOGGER_PLUGIN_ENABLED', true),

  // Swagger plugin
  swaggerEnabled: config.boolean('SWAGGER_ENABLED', true),
  swaggerTitle: config.string('SWAGGER_TITLE', 'FluxStack API'),
  swaggerVersion: config.string('SWAGGER_VERSION', FLUXSTACK_VERSION),
  swaggerDescription: config.string(
    'SWAGGER_DESCRIPTION',
    'API documentation for FluxStack application'
  ),
  swaggerPath: config.string('SWAGGER_PATH', '/swagger'),

  // Swagger advanced options
  swaggerExcludePaths: config.array('SWAGGER_EXCLUDE_PATHS', []),

  // Swagger servers (comma-separated list of URLs)
  // Format: "url1|description1,url2|description2"
  // Example: "https://api.prod.com|Production,https://api.staging.com|Staging"
  swaggerServers: config.string('SWAGGER_SERVERS', ''),

  // Swagger UI options
  swaggerPersistAuthorization: config.boolean('SWAGGER_PERSIST_AUTH', true),
  swaggerDisplayRequestDuration: config.boolean('SWAGGER_DISPLAY_DURATION', true),
  swaggerEnableFilter: config.boolean('SWAGGER_ENABLE_FILTER', true),
  swaggerShowExtensions: config.boolean('SWAGGER_SHOW_EXTENSIONS', true),
  swaggerTryItOutEnabled: config.boolean('SWAGGER_TRY_IT_OUT', true),

  // Swagger authentication (Basic Auth)
  swaggerAuthEnabled: config.boolean('SWAGGER_AUTH_ENABLED', false),
  swaggerAuthUsername: config.string('SWAGGER_AUTH_USERNAME', 'admin'),
  swaggerAuthPassword: config.string('SWAGGER_AUTH_PASSWORD', ''),

  // Static files plugin
  staticFilesEnabled: config.boolean('STATIC_FILES_ENABLED', true),
  staticPublicDir: config.string('STATIC_PUBLIC_DIR', 'public'),
  staticUploadsDir: config.string('STATIC_UPLOADS_DIR', 'uploads'),
  staticCacheMaxAge: config.number('STATIC_CACHE_MAX_AGE', 31536000), // 1 year
  staticEnableUploads: config.boolean('STATIC_ENABLE_UPLOADS', true),
  staticEnablePublic: config.boolean('STATIC_ENABLE_PUBLIC', true),

  // CORS plugin (configuration via server.config.ts)
  // Vite plugin
  viteEnabled: config.boolean('VITE_PLUGIN_ENABLED', true),
  viteExcludePaths: config.array('VITE_EXCLUDE_PATHS', [
    '/api',
    '/swagger'
  ])
})

// Export type
export type PluginsConfig = typeof pluginsConfig

// Export default
export default pluginsConfig
