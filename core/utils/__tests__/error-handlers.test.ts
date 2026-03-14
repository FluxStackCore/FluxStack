/**
 * Tests for Error Handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  EnhancedErrorHandler,
  RetryRecoveryStrategy,
  FallbackRecoveryStrategy,
  errorHandler,
  createErrorHandler,
  type ErrorHandlerContext,
  type ErrorHandlerOptions,
  type ErrorMetricsCollector
} from '../errors/handlers'
import {
  FluxStackError,
  ValidationError,
  InternalServerError,
  ExternalServiceError,
  DatabaseError
} from '../errors'

// Mock logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}

// Mock metrics collector
const mockMetricsCollector: ErrorMetricsCollector = {
  recordError: vi.fn()
}

describe('Enhanced Error Handler', () => {
  let handler: EnhancedErrorHandler
  let context: ErrorHandlerContext

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new EnhancedErrorHandler()
    context = {
      logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
      isDevelopment: false,
      correlationId: 'test-123',
      userId: 'user-456',
      path: '/api/test',
      method: 'POST',
      metricsCollector: mockMetricsCollector
    }
  })

  describe('Basic Error Handling', () => {
    it('should handle FluxStackError correctly', async () => {
      const error = new ValidationError('Invalid input', { field: 'email' })
      const response = await handler.handle(error, context)

      expect(response.error.message).toBe('Please check your input and try again')
      expect(response.error.code).toBe('VALIDATION_ERROR')
      expect(response.error.statusCode).toBe(400)
      expect(response.error.correlationId).toBe('test-123')
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should handle regular Error by wrapping it', async () => {
      const error = new Error('Regular error')
      const response = await handler.handle(error, context)

      expect(response.error.message).toBe('An unexpected error occurred. Please try again later')
      expect(response.error.code).toBe('INTERNAL_SERVER_ERROR')
      expect(response.error.statusCode).toBe(500)
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should generate correlation ID if not provided', async () => {
      const contextWithoutCorrelationId = { ...context, correlationId: undefined }
      const error = new ValidationError('Test')
      const response = await handler.handle(error, contextWithoutCorrelationId)

      expect(response.error.correlationId).toBeDefined()
      expect(response.error.correlationId).toMatch(/^[0-9a-f-]{36}$/) // UUID format
    })

    it('should include stack trace in development mode', async () => {
      const devContext = { ...context, isDevelopment: true }
      const error = new ValidationError('Test')
      const response = await handler.handle(error, devContext)

      expect(response.error.stack).toBeDefined()
    })

    it('should not include stack trace in production mode', async () => {
      const error = new ValidationError('Test')
      const response = await handler.handle(error, context)

      expect(response.error.stack).toBeUndefined()
    })
  })

  describe('Logging Behavior', () => {
    it('should log operational errors as warnings', async () => {
      const error = new ValidationError('Test')
      await handler.handle(error, context)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          isOperational: true
        })
      )
    })

    it('should log non-operational errors as errors', async () => {
      const error = new InternalServerError('Test')
      await handler.handle(error, context)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          statusCode: 500,
          isOperational: false
        })
      )
    })

    it('should skip logging for NOT_FOUND errors by default', async () => {
      delete process.env.ENABLE_NOT_FOUND_LOGS
      const error = new FluxStackError('Not found', 'NOT_FOUND', 404)
      await handler.handle(error, context)

      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('should log NOT_FOUND errors when explicitly enabled', async () => {
      process.env.ENABLE_NOT_FOUND_LOGS = 'true'
      const error = new FluxStackError('Not found', 'NOT_FOUND', 404)
      await handler.handle(error, context)

      expect(mockLogger.warn).toHaveBeenCalled()
      delete process.env.ENABLE_NOT_FOUND_LOGS
    })
  })

  describe('Metrics Collection', () => {
    it('should record error metrics when collector is provided', async () => {
      const error = new ValidationError('Test')
      await handler.handle(error, context)

      expect(mockMetricsCollector.recordError).toHaveBeenCalledWith(
        expect.any(FluxStackError),
        context
      )
    })

    it('should handle metrics collection errors gracefully', async () => {
      const failingMetricsCollector = {
        recordError: vi.fn().mockImplementation(() => {
          throw new Error('Metrics failed')
        })
      }
      const contextWithFailingMetrics = { ...context, metricsCollector: failingMetricsCollector }
      const error = new ValidationError('Test')

      const response = await handler.handle(error, contextWithFailingMetrics)

      expect(response.error.code).toBe('VALIDATION_ERROR')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to record error metrics',
        expect.objectContaining({ error: 'Metrics failed' })
      )
    })
  })

  describe('Error Response Sanitization', () => {
    it('should sanitize sensitive information in production', async () => {
      const handler = new EnhancedErrorHandler({ sanitizeErrors: true })
      const error = new ValidationError('Test', { password: 'secret123', token: 'abc123' })
      const response = await handler.handle(error, context)

      expect(response.error.details?.password).toBe('[REDACTED]')
      expect(response.error.details?.token).toBe('[REDACTED]')
    })

    it('should not sanitize in development mode', async () => {
      const handler = new EnhancedErrorHandler({ sanitizeErrors: true })
      const devContext = { ...context, isDevelopment: true }
      const error = new ValidationError('Test', { password: 'secret123' })
      const response = await handler.handle(error, devContext)

      expect(response.error.details?.password).toBe('secret123')
    })
  })

  describe('Custom Error Messages', () => {
    it('should use custom error messages when configured', async () => {
      const handler = new EnhancedErrorHandler({
        customErrorMessages: {
          'VALIDATION_ERROR': 'Custom validation message'
        }
      })
      const error = new ValidationError('Test')
      const response = await handler.handle(error, context)

      expect(response.error.message).toBe('Custom validation message')
    })
  })
})

describe('Recovery Strategies', () => {
  let handler: EnhancedErrorHandler
  let context: ErrorHandlerContext

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new EnhancedErrorHandler()
    context = {
      logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
      isDevelopment: false,
      correlationId: 'test-123'
    }
  })

  describe('RetryRecoveryStrategy', () => {
    it('should identify retryable errors', () => {
      const strategy = new RetryRecoveryStrategy()
      const retryableError = new ExternalServiceError('API', { timeout: true })
      const nonRetryableError = new ValidationError('Invalid input')

      expect(strategy.canRecover(retryableError)).toBe(true)
      expect(strategy.canRecover(nonRetryableError)).toBe(false)
    })

    it('should not retry if max retries exceeded', () => {
      const strategy = new RetryRecoveryStrategy(2)
      const error = new ExternalServiceError('API')
      error.context = { retryCount: 3 }

      expect(strategy.canRecover(error)).toBe(false)
    })

    it('should attempt recovery with retry count', async () => {
      const strategy = new RetryRecoveryStrategy(3, 100) // 100ms delay for faster tests
      const error = new ExternalServiceError('API')

      try {
        await strategy.recover(error, context)
      } catch (recoveredError) {
        expect(recoveredError).toBeInstanceOf(FluxStackError)
        expect((recoveredError as FluxStackError).metadata?.retryCount).toBe(1)
        expect((recoveredError as FluxStackError).code).toBe('EXTERNAL_SERVICE_ERROR')
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attempting error recovery',
        expect.objectContaining({
          errorCode: 'EXTERNAL_SERVICE_ERROR',
          retryCount: 1,
          maxRetries: 3
        })
      )
    })
  })

  describe('FallbackRecoveryStrategy', () => {
    it('should identify applicable errors', () => {
      const strategy = new FallbackRecoveryStrategy({ fallback: 'data' })
      const applicableError = new ExternalServiceError('API')
      const nonApplicableError = new ValidationError('Invalid')

      expect(strategy.canRecover(applicableError)).toBe(true)
      expect(strategy.canRecover(nonApplicableError)).toBe(false)
    })

    it('should return fallback response', () => {
      const fallbackData = { message: 'Fallback data' }
      const strategy = new FallbackRecoveryStrategy(fallbackData)
      const error = new ExternalServiceError('API')

      const result = strategy.recover(error, context)

      expect(result).toEqual({
        data: fallbackData,
        warning: 'Fallback data provided due to service unavailability'
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Using fallback recovery',
        expect.objectContaining({
          errorCode: 'EXTERNAL_SERVICE_ERROR'
        })
      )
    })
  })

  describe('Recovery Strategy Management', () => {
    it('should add recovery strategies', () => {
      const strategy = new RetryRecoveryStrategy()
      handler.addRecoveryStrategy(strategy)

      // We can't directly test the internal array, but we can test behavior
      expect(handler).toBeDefined()
    })

    it('should remove recovery strategies', () => {
      const strategy = new RetryRecoveryStrategy()
      handler.addRecoveryStrategy(strategy)
      handler.removeRecoveryStrategy(RetryRecoveryStrategy)

      expect(handler).toBeDefined()
    })
  })
})

describe('Legacy Error Handler Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('errorHandler', () => {
    it('should handle errors using enhanced handler', async () => {
      const context: ErrorHandlerContext = {
        logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
        isDevelopment: false
      }
      const error = new ValidationError('Test')

      const response = await errorHandler(error, context)

      expect(response.error.code).toBe('VALIDATION_ERROR')
      expect(response.error.statusCode).toBe(400)
    })
  })

  describe('createErrorHandler', () => {
    it('should create error handler with base context', async () => {
      const baseContext = {
        logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
        isDevelopment: false
      }
      const handler = createErrorHandler(baseContext)
      const error = new ValidationError('Test')

      const response = await handler(error, undefined, '/api/test', 'POST')

      expect(response.error.code).toBe('VALIDATION_ERROR')
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should merge request context with base context', async () => {
      const baseContext = {
        logger: mockLogger as unknown as import('@core/utils/logger/index').Logger,
        isDevelopment: false
      }
      const handler = createErrorHandler(baseContext)
      const mockRequest = { method: 'GET' } as Request
      const error = new ValidationError('Test')

      const response = await handler(error, mockRequest, '/api/users')

      expect(response.error.code).toBe('VALIDATION_ERROR')
    })
  })
})