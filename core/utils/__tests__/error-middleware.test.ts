/**
 * Tests for Error Middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Elysia } from 'elysia'
import {
  errorMiddleware,
  correlationIdMiddleware,
  requestContextMiddleware,
  fullErrorHandlingMiddleware
} from '../errors/middleware'
import { ValidationError, InternalServerError } from '../errors'

// Mock logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}

// Mock metrics collector
const mockMetricsCollector = {
  recordError: vi.fn()
}

describe('Error Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('errorMiddleware', () => {
    it('should create middleware without errors', () => {
      const middleware = errorMiddleware({
        logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
        isDevelopment: false
      })
      
      expect(middleware).toBeDefined()
      expect(middleware.config.name).toBe('error-handler')
    })

    it('should create middleware with custom options', () => {
      const middleware = errorMiddleware({
        logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
        isDevelopment: true,
        metricsCollector: mockMetricsCollector,
        customErrorMessages: {
          'VALIDATION_ERROR': 'Custom message'
        }
      })
      
      expect(middleware).toBeDefined()
      expect(middleware.config.name).toBe('error-handler')
    })

    it('should create middleware with default options', () => {
      const middleware = errorMiddleware()
      
      expect(middleware).toBeDefined()
      expect(middleware.config.name).toBe('error-handler')
    })
  })

  describe('correlationIdMiddleware', () => {
    it('should create correlation ID middleware', () => {
      const middleware = correlationIdMiddleware()
      
      expect(middleware).toBeDefined()
      expect(middleware.config.name).toBe('correlation-id')
    })
  })

  describe('requestContextMiddleware', () => {
    it('should create request context middleware', () => {
      const middleware = requestContextMiddleware()
      
      expect(middleware).toBeDefined()
      expect(middleware.config.name).toBe('request-context')
    })
  })

  describe('fullErrorHandlingMiddleware', () => {
    it('should create full error handling middleware', () => {
      const middleware = fullErrorHandlingMiddleware({
        logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
        isDevelopment: false
      })
      
      expect(middleware).toBeDefined()
      expect(middleware.config.name).toBe('full-error-handling')
    })

    it('should create full error handling middleware with default options', () => {
      const middleware = fullErrorHandlingMiddleware()
      
      expect(middleware).toBeDefined()
      expect(middleware.config.name).toBe('full-error-handling')
    })
  })

  describe('Middleware Configuration', () => {
    it('should accept all configuration options', () => {
      const middleware = errorMiddleware({
        logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
        isDevelopment: true,
        enableRequestContext: true,
        metricsCollector: mockMetricsCollector,
        enableStackTrace: true,
        enableErrorMetrics: true,
        enableCorrelationId: true,
        sanitizeErrors: true,
        customErrorMessages: {
          'VALIDATION_ERROR': 'Custom message'
        }
      })
      
      expect(middleware).toBeDefined()
    })
  })
})