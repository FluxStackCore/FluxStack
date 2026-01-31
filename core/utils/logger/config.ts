/**
 * FluxStack Logger Configuration
 * Re-export from declarative config
 */

import { loggerConfig } from '@/config'

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  dateFormat: string
  logToFile: boolean
  maxSize: string
  maxFiles: string
  objectDepth: number
  enableColors: boolean
  enableStackTrace: boolean
}

/**
 * Get logger configuration from declarative config
 */
export function getLoggerConfig(): LoggerConfig {
  return {
    level: loggerConfig.level,
    dateFormat: loggerConfig.dateFormat,
    logToFile: loggerConfig.logToFile,
    maxSize: loggerConfig.maxSize,
    maxFiles: loggerConfig.maxFiles,
    objectDepth: loggerConfig.objectDepth,
    enableColors: loggerConfig.enableColors,
    enableStackTrace: loggerConfig.enableStackTrace
  }
}

export const LOGGER_CONFIG = getLoggerConfig()
