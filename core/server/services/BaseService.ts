/**
 * Base Service Class
 * Core FluxStack service infrastructure
 * 
 * Provides common functionality for all services including:
 * - Logging with service context
 * - Configuration access
 * - Service container integration
 */

import type { Logger } from '@core/utils/logger/index'

export interface ServiceContext {
  config: Record<string, unknown>
  logger: Logger
  services?: ServiceContainer
}

export interface ServiceContainer {
  get<T>(name: string): T
  register<T>(name: string, service: T): void
}

export abstract class BaseService {
  protected config: Record<string, unknown>
  protected logger: Logger
  protected services?: ServiceContainer

  constructor(context: ServiceContext) {
    this.config = context.config
    this.logger = context.logger.child?.({ service: this.constructor.name }) ?? context.logger
    this.services = context.services
  }

  /**
   * Get service from container
   */
  protected getService<T>(name: string): T {
    if (!this.services) {
      throw new Error('Service container not available')
    }
    return this.services.get<T>(name)
  }

  /**
   * Log service operation
   */
  protected logOperation(operation: string, data?: unknown) {
    this.logger.info(`${operation}`, data)
  }

  /**
   * Log service error
   */
  protected logError(operation: string, error: Error, data?: unknown) {
    this.logger.error(`${operation} failed`, { error: error.message, data })
  }

  /**
   * Initialize service (override in subclasses)
   */
  async initialize(): Promise<void> {
    this.logger.info('Service initialized')
  }

  /**
   * Execute operation with logging
   */
  protected async executeWithLogging<T>(
    operation: string, 
    fn: () => Promise<T> | T,
    metadata?: unknown
  ): Promise<T> {
    this.logOperation(`Starting ${operation}`, metadata)
    try {
      const result = await fn()
      this.logOperation(`Completed ${operation}`, metadata)
      return result
    } catch (error) {
      this.logError(operation, error as Error, metadata)
      throw error
    }
  }

  /**
   * Validate required fields
   */
  protected validateRequired(data: Record<string, unknown>, fields: string[]): void {
    for (const field of fields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
  }
}