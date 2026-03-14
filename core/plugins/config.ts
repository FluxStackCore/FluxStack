/**
 * Plugin Configuration Management
 * Handles plugin-specific configuration validation and management
 */

import type { FluxStack, PluginConfigSchema, PluginValidationResult } from "./types"
import type { FluxStackConfig } from "@config"
import type { Logger } from "@core/utils/logger/index"

type Plugin = FluxStack.Plugin

export interface PluginConfigManager {
  validatePluginConfig(plugin: Plugin, config: unknown): PluginValidationResult
  mergePluginConfig(plugin: Plugin, userConfig: unknown): unknown
  getPluginConfig(pluginName: string, config: FluxStackConfig): unknown
  setPluginConfig(pluginName: string, pluginConfig: unknown, config: FluxStackConfig): void
}

export class DefaultPluginConfigManager implements PluginConfigManager {
  constructor(_logger?: Logger) {
    // Logger stored but not used in current implementation
  }

  /**
   * Validate plugin configuration against its schema
   */
  validatePluginConfig(plugin: Plugin, config: unknown): PluginValidationResult {
    const result: PluginValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    }

    if (!plugin.configSchema) {
      // No schema means any config is valid
      return result
    }

    try {
      this.validateAgainstSchema(config, plugin.configSchema, plugin.name, result)
    } catch (error) {
      result.valid = false
      result.errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * Merge user configuration with plugin defaults
   */
  mergePluginConfig(plugin: Plugin, userConfig: unknown): unknown {
    const defaultConfig = (plugin.defaultConfig || {}) as Record<string, unknown>

    if (!userConfig) {
      return defaultConfig
    }

    return this.deepMerge(defaultConfig, userConfig as Record<string, unknown>)
  }

  /**
   * Get plugin configuration from main config
   * @deprecated Plugin configs are now directly accessed from config.plugins
   */
  getPluginConfig(pluginName: string, config: FluxStackConfig): unknown {
    // Plugin configs are now accessed directly from config.plugins
    // Example: config.plugins.swaggerEnabled
    return {}
  }

  /**
   * Set plugin configuration in main config
   * @deprecated Plugin configs are now set via environment variables and config files
   */
  setPluginConfig(pluginName: string, pluginConfig: unknown, config: FluxStackConfig): void {
    // Plugin configs are now set via environment variables and config files
    // This function is deprecated and does nothing
  }

  /**
   * Validate configuration against JSON schema
   */
  private validateAgainstSchema(
    data: unknown,
    schema: PluginConfigSchema,
    pluginName: string,
    result: PluginValidationResult
  ): void {
    if (schema.type === 'object' && typeof data !== 'object') {
      result.valid = false
      result.errors.push(`Plugin '${pluginName}' configuration must be an object`)
      return
    }

    const dataObj = data as Record<string, unknown>

    // Check required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in dataObj)) {
          result.valid = false
          result.errors.push(`Plugin '${pluginName}' configuration missing required property: ${requiredProp}`)
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in dataObj) {
          this.validateProperty(dataObj[propName], propSchema as Record<string, unknown>, `${pluginName}.${propName}`, result)
        }
      }
    }

    // Check for additional properties
    if (schema.additionalProperties === false) {
      const allowedProps = Object.keys(schema.properties || {})
      const actualProps = Object.keys(dataObj)

      for (const prop of actualProps) {
        if (!allowedProps.includes(prop)) {
          result.warnings.push(`Plugin '${pluginName}' configuration has unexpected property: ${prop}`)
        }
      }
    }
  }

  /**
   * Validate individual property
   */
  private validateProperty(value: unknown, schema: Record<string, unknown>, path: string, result: PluginValidationResult): void {
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== schema.type) {
        result.valid = false
        result.errors.push(`Property '${path}' must be of type ${schema.type}, got ${actualType}`)
        return
      }
    }

    // Type-specific validations
    switch (schema.type) {
      case 'string':
        this.validateStringProperty(value as string, schema, path, result)
        break
      case 'number':
        this.validateNumberProperty(value as number, schema, path, result)
        break
      case 'array':
        this.validateArrayProperty(value as unknown[], schema, path, result)
        break
      case 'object':
        if (schema.properties) {
          this.validateObjectProperty(value, schema, path, result)
        }
        break
    }

    // Enum validation
    if (schema.enum && !(schema.enum as unknown[]).includes(value)) {
      result.valid = false
      result.errors.push(`Property '${path}' must be one of: ${(schema.enum as unknown[]).join(', ')}`)
    }
  }

  /**
   * Validate string property
   */
  private validateStringProperty(value: string, schema: Record<string, unknown>, path: string, result: PluginValidationResult): void {
    if (schema.minLength && value.length < (schema.minLength as number)) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at least ${schema.minLength} characters long`)
    }

    if (schema.maxLength && value.length > (schema.maxLength as number)) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at most ${schema.maxLength} characters long`)
    }

    if (schema.pattern) {
      const regex = new RegExp(schema.pattern as string)
      if (!regex.test(value)) {
        result.valid = false
        result.errors.push(`Property '${path}' does not match required pattern: ${schema.pattern}`)
      }
    }
  }

  /**
   * Validate number property
   */
  private validateNumberProperty(value: number, schema: Record<string, unknown>, path: string, result: PluginValidationResult): void {
    if (schema.minimum !== undefined && value < (schema.minimum as number)) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at least ${schema.minimum}`)
    }

    if (schema.maximum !== undefined && value > (schema.maximum as number)) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at most ${schema.maximum}`)
    }

    if (schema.multipleOf && value % (schema.multipleOf as number) !== 0) {
      result.valid = false
      result.errors.push(`Property '${path}' must be a multiple of ${schema.multipleOf}`)
    }
  }

  /**
   * Validate array property
   */
  private validateArrayProperty(value: unknown[], schema: Record<string, unknown>, path: string, result: PluginValidationResult): void {
    if (schema.minItems && value.length < (schema.minItems as number)) {
      result.valid = false
      result.errors.push(`Property '${path}' must have at least ${schema.minItems} items`)
    }

    if (schema.maxItems && value.length > (schema.maxItems as number)) {
      result.valid = false
      result.errors.push(`Property '${path}' must have at most ${schema.maxItems} items`)
    }

    if (schema.items) {
      value.forEach((item, index) => {
        this.validateProperty(item, schema.items as Record<string, unknown>, `${path}[${index}]`, result)
      })
    }
  }

  /**
   * Validate object property
   */
  private validateObjectProperty(value: unknown, schema: Record<string, unknown>, path: string, result: PluginValidationResult): void {
    const valueObj = value as Record<string, unknown>
    if (schema.required) {
      for (const requiredProp of (schema.required as string[])) {
        if (!(requiredProp in valueObj)) {
          result.valid = false
          result.errors.push(`Property '${path}' missing required property: ${requiredProp}`)
        }
      }
    }

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties as Record<string, unknown>)) {
        if (propName in valueObj) {
          this.validateProperty(valueObj[propName], propSchema as Record<string, unknown>, `${path}.${propName}`, result)
        }
      }
    }
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    if (source === null || source === undefined) {
      return target
    }

    if (target === null || target === undefined) {
      return source
    }

    if (typeof target !== 'object' || typeof source !== 'object') {
      return source
    }

    if (Array.isArray(source)) {
      return [...source] as unknown as Record<string, unknown>
    }

    const result = { ...target }

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
          result[key] = this.deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>)
        } else {
          result[key] = source[key]
        }
      }
    }

    return result
  }
}

/** Shared instance — stateless, safe to reuse across all plugin utils */
const sharedConfigManager = new DefaultPluginConfigManager()

/**
 * Create plugin configuration utilities
 */
export function createPluginUtils(logger?: Logger): PluginUtils {
  return {
    createTimer: (label: string) => {
      const start = Date.now()
      return {
        end: () => {
          const duration = Date.now() - start
          logger?.debug(`Timer '${label}' completed`, { duration })
          return duration
        }
      }
    },

    formatBytes: (bytes: number): string => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    isProduction: (): boolean => {
      return process.env.NODE_ENV === 'production'
    },

    isDevelopment: (): boolean => {
      return process.env.NODE_ENV === 'development'
    },

    getEnvironment: (): string => {
      return process.env.NODE_ENV || 'development'
    },

    createHash: (data: string): string => {
      // Simple hash function - in production, use crypto
      let hash = 0
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return hash.toString(36)
    },

    deepMerge: (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
      return sharedConfigManager.deepMerge(target, source)
    },

    validateSchema: (data: Record<string, unknown>, schema: PluginConfigSchema): { valid: boolean; errors: string[] } => {
      const result = sharedConfigManager.validatePluginConfig({ name: 'temp', configSchema: schema }, data)
      return {
        valid: result.valid,
        errors: result.errors
      }
    }
  }
}

// Export types for plugin utilities
import type { PluginUtils } from "./types"