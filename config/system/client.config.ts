/**
 * Client & Vite Configuration
 * Declarative client, proxy and Vite dev server configuration
 */

import { defineConfig, defineNestedConfig, config } from '@/core/utils/config-schema'
import { env, helpers } from '@/core/utils/env'

/**
 * Vite Dev Server Configuration
 */
const viteSchema = {
  port: config.number('VITE_PORT', 5173, true),

  host: config.string('VITE_HOST', 'localhost'),

  strictPort: config.boolean('VITE_STRICT_PORT', true),

  open: config.boolean('VITE_OPEN', false),

  enableLogging: config.boolean('ENABLE_VITE_PROXY_LOGS', false),

  logLevel: config.enum('VITE_LOG_LEVEL', ['error' , 'warn' , 'info', 'silent'], undefined)
} as const

/**
 * Client Build Configuration
 */
const buildSchema = {
  outDir: config.string('CLIENT_OUTDIR', 'dist/client'),

  sourceMaps: config.boolean('CLIENT_SOURCEMAPS', helpers.isDevelopment()),

  minify: config.boolean('CLIENT_MINIFY', helpers.isProduction()),

  target: config.string('CLIENT_TARGET', 'esnext'),

  assetsDir: config.string('CLIENT_ASSETS_DIR', 'assets'),

  cssCodeSplit: config.boolean('CLIENT_CSS_CODE_SPLIT', true),

  chunkSizeWarningLimit: config.number('CLIENT_CHUNK_SIZE_WARNING', 500), // KB

  emptyOutDir: config.boolean('CLIENT_EMPTY_OUTDIR', true)
} as const

/**
 * Proxy configuration schema
 */
const proxySchema = {
  target: config.string('CLIENT_PROXY_TARGET', 'http://localhost:3000'),
  changeOrigin: config.boolean('CLIENT_PROXY_CHANGE_ORIGIN', true),
  secure: config.boolean('CLIENT_PROXY_SECURE', false),
  ws: config.boolean('CLIENT_PROXY_WS', true),
  rewrite: {
    type: 'object' as const,
    default: {
      '^/api': '/api'
    }
  }
} as const

/**
 * Client Configuration (nested)
 */
export const clientConfig = defineNestedConfig({
  vite: viteSchema,
  proxy: proxySchema,
  build: buildSchema,
})

// Export types
export type ViteConfig = typeof clientConfig.vite
export type ClientProxyConfig = typeof clientConfig.proxy
export type ClientBuildConfig = typeof clientConfig.build
export type ClientConfig = typeof clientConfig

// Export default
export default clientConfig
