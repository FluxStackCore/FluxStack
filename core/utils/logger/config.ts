/**
 * FluxStack Logger Configuration
 * Re-export from declarative config
 */

import { loggerConfig } from '@/config'

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'pretty' | 'json'
  dateFormat: string
  logToFile: boolean
  maxSize: string
  maxFiles: string
  objectDepth: number
  enableColors: boolean
  enableStackTrace: boolean
  transports: string[]
}

/**
 * Get logger configuration from declarative config
 */
export function getLoggerConfig(): LoggerConfig {
  return {
    level: loggerConfig.level,
    format: (loggerConfig as any).format ?? 'pretty',
    dateFormat: loggerConfig.dateFormat,
    logToFile: loggerConfig.logToFile,
    maxSize: loggerConfig.maxSize,
    maxFiles: loggerConfig.maxFiles,
    objectDepth: loggerConfig.objectDepth,
    enableColors: loggerConfig.enableColors,
    enableStackTrace: loggerConfig.enableStackTrace,
    transports: (loggerConfig as any).transports ?? ['console']
  }
}

export const LOGGER_CONFIG = getLoggerConfig()
