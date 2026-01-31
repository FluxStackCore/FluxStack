/**
 * Build Configuration
 * Server build and optimization settings
 */

import { defineConfig, defineNestedConfig, config } from '@/core/utils/config-schema'
import { helpers } from '@/core/utils/env'

/**
 * Build optimization schema
 */
const optimizationSchema = {
  minify: config.boolean('BUILD_MINIFY', helpers.isProduction()),
  treeshake: config.boolean('BUILD_TREESHAKE', true),
  compress: config.boolean('BUILD_COMPRESS', helpers.isProduction()),
  splitChunks: config.boolean('BUILD_SPLIT_CHUNKS', true),
  bundleAnalyzer: config.boolean('BUILD_BUNDLE_ANALYZER', false)
} as const

/**
 * Build configuration schema
 */
const buildSchema = {
  target: config.enum('BUILD_TARGET', ['bun', 'node', 'docker'] as const, 'bun', true),
  outDir: config.string('BUILD_OUT_DIR', 'dist', true),
  sourceMaps: config.boolean('BUILD_SOURCE_MAPS', helpers.isDevelopment()),
  clean: config.boolean('BUILD_CLEAN', true)
} as const

/**
 * Export build config (nested with optimization)
 */
export const buildConfig = defineNestedConfig({
  build: buildSchema,
  optimization: optimizationSchema
})

// Export types
export type BuildConfig = typeof buildConfig.build
export type OptimizationConfig = typeof buildConfig.optimization
export type BuildFullConfig = typeof buildConfig

// Export default
export default buildConfig
