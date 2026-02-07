import { describe, it, expect, vi, beforeEach } from 'vitest'

// TODO: Rewrite tests - apiCall/APIException/resetCircuitBreaker were removed in Eden Treaty refactor
// import { getErrorMessage } from '@app/client/src/lib/eden-api'

describe.skip('Eden API Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCircuitBreaker()
  })

  describe('apiCall', () => {
    it('should return data on successful API response', async () => {
      const mockData = { users: [{ id: 1, name: 'Test' }] }
      const mockPromise = Promise.resolve({
        data: mockData,
        error: null,
        status: 200,
        response: new Response()
      })

      const result = await apiCall(mockPromise)
      expect(result).toEqual(mockData)
    })

    it('should throw ClientAPIError on error response', async () => {
      const mockError = {
        status: 400,
        value: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: { field: 'email' }
        }
      }
      const mockPromise = Promise.resolve({
        data: null,
        error: mockError,
        status: 400,
        response: new Response()
      })

      await expect(apiCall(mockPromise, { useCircuitBreaker: false })).rejects.toThrow(ClientAPIError)

      try {
        await apiCall(mockPromise, { useCircuitBreaker: false })
      } catch (error) {
        expect(error).toBeInstanceOf(ClientAPIError)
        expect((error as ClientAPIError).message).toBe('Validation failed')
        expect((error as ClientAPIError).statusCode).toBe(400)
        expect((error as ClientAPIError).code).toBe('VALIDATION_ERROR')
        // details should be { field: 'email' } based on implementation
        expect((error as ClientAPIError).details).toEqual({ field: 'email' })
      }
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      const mockPromise = Promise.reject(networkError)

      await expect(apiCall(mockPromise, { useCircuitBreaker: false })).rejects.toThrow(ClientAPIError)

      try {
        await apiCall(mockPromise, { useCircuitBreaker: false })
      } catch (error) {
        expect(error).toBeInstanceOf(ClientAPIError)
        expect((error as ClientAPIError).message).toBe('Network error')
        expect((error as ClientAPIError).statusCode).toBe(0)
        expect((error as ClientAPIError).code).toBe('NETWORK_ERROR')
      }
    })

    it('should handle unknown errors', async () => {
      const unknownError = 'Some string error'
      const mockPromise = Promise.reject(unknownError)

      await expect(apiCall(mockPromise, { useCircuitBreaker: false })).rejects.toThrow(ClientAPIError)

      try {
        await apiCall(mockPromise, { useCircuitBreaker: false })
      } catch (error) {
        expect(error).toBeInstanceOf(ClientAPIError)
        expect((error as ClientAPIError).message).toBe('Unknown error occurred')
        expect((error as ClientAPIError).statusCode).toBe(500)
        expect((error as ClientAPIError).code).toBe('UNKNOWN_ERROR')
      }
    })
  })

  describe('getErrorMessage', () => {
    it('should return specific messages for different status codes', () => {
      const badRequestError = new APIException({
        message: 'Custom message',
        status: 400
      })
      expect(getErrorMessage(badRequestError)).toBe('Invalid request. Please check your input.')

      const unauthorizedError = new APIException({
        message: 'Custom auth message',
        status: 401
      })
      expect(getErrorMessage(unauthorizedError)).toBe('Authentication required. Please log in.')

      const forbiddenError = new APIException({
        message: 'Forbidden',
        status: 403
      })
      expect(getErrorMessage(forbiddenError)).toBe('Access denied. You do not have permission.')

      const notFoundError = new APIException({
        message: 'Not found',
        status: 404
      })
      expect(getErrorMessage(notFoundError)).toBe('Resource not found.')

      const validationError = new APIException({
        message: 'Validation error',
        status: 422
      })
      expect(getErrorMessage(validationError)).toBe('Invalid data provided.')

      const serverError = new APIException({
        message: 'Server error',
        status: 500
      })
      expect(getErrorMessage(serverError)).toBe('Server error. Please try again later.')
    })

    it('should return generic message for unknown status codes', () => {
      const unknownError = new APIException({
        message: 'Custom error',
        status: 418 // I'm a teapot
      })
      expect(getErrorMessage(unknownError)).toBe('An unexpected error occurred.')
    })

    it('should handle regular Error objects', () => {
      const regularError = new Error('Regular error message')
      expect(getErrorMessage(regularError)).toBe('Regular error message')
    })

    it('should handle unknown error types', () => {
      expect(getErrorMessage('string error')).toBe('An unexpected error occurred')
      expect(getErrorMessage(null)).toBe('An unexpected error occurred')
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
      expect(getErrorMessage({ unknownProp: 'value' })).toBe('An unexpected error occurred')
    })

    it('should fallback to default messages when APIException has no message', () => {
      const errorWithoutMessage = new APIException({
        message: '',
        status: 401
      })
      expect(getErrorMessage(errorWithoutMessage)).toBe('Authentication required. Please log in.')
    })
  })

  describe('APIException', () => {
    it('should create APIException with all properties', () => {
      const errorData = {
        message: 'Test error',
        status: 400,
        code: 'TEST_ERROR',
        details: { field: 'test' }
      }

      const exception = new APIException(errorData)

      expect(exception.message).toBe('Test error')
      expect(exception.status).toBe(400)
      expect(exception.code).toBe('TEST_ERROR')
      expect(exception.details).toEqual({ field: 'test' })
      expect(exception.name).toBe('APIException')
      expect(exception).toBeInstanceOf(Error)
    })

    it('should create APIException with minimal properties', () => {
      const errorData = {
        message: 'Minimal error',
        status: 500
      }

      const exception = new APIException(errorData)

      expect(exception.message).toBe('Minimal error')
      expect(exception.status).toBe(500)
      expect(exception.code).toBeUndefined()
      expect(exception.details).toBeUndefined()
    })
  })
})