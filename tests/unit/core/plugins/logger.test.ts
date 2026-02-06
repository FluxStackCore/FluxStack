import { describe, it, expect, vi, beforeEach } from 'vitest'

// TODO: Fix test - loggerPlugin was removed/relocated from @/core/server/plugins/logger
describe.skip('Logger Plugin', () => {
  let mockContext: FluxStackContext
  let mockApp: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockContext = {
      config: {
        port: 3000,
        vitePort: 5173,
        clientPath: 'app/client',
        apiPrefix: '/api',
        cors: {
          origins: ['http://localhost:5173'],
          methods: ['GET', 'POST'],
          headers: ['Content-Type']
        },
        build: {
          outDir: 'dist',
          target: 'es2020'
        }
      },
      isDevelopment: true,
      isProduction: false,
      envConfig: {}
    } as FluxStackContext

    mockApp = {
      onRequest: vi.fn(),
      onResponse: vi.fn(),
      onError: vi.fn(),
      use: vi.fn()
    }
  })

  describe('Plugin Setup', () => {
    it('should have correct plugin name', () => {
      expect(loggerPlugin.name).toBe('logger')
    })

    it('should have setup function', () => {
      expect(typeof loggerPlugin.setup).toBe('function')
    })

    it('should setup logger middleware', () => {
      loggerPlugin.setup(mockContext, mockApp)
      
      // Should register onRequest, onResponse, and onError handlers
      expect(mockApp.onRequest).toHaveBeenCalledWith(expect.any(Function))
      expect(mockApp.onResponse).toHaveBeenCalledWith(expect.any(Function))
      expect(mockApp.onError).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('Request Logging', () => {
    it('should log request details', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      loggerPlugin.setup(mockContext, mockApp)
      
      // Get the onRequest handler
      const onRequestHandler = mockApp.onRequest.mock.calls[0][0]
      
      const mockRequest = new Request('http://localhost:3000/api/users', {
        method: 'GET',
        headers: {
          'user-agent': 'test-agent',
          'accept': 'application/json'
        }
      })
      
      const mockContext = {
        request: mockRequest,
        set: {}
      }
      
      onRequestHandler(mockContext)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📥'),
        expect.stringContaining('GET'),
        expect.stringContaining('/api/users')
      )
      
      consoleSpy.mockRestore()
    })

    it('should log POST requests with different styling', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      loggerPlugin.setup(mockContext, mockApp)
      
      const onRequestHandler = mockApp.onRequest.mock.calls[0][0]
      
      const mockRequest = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        }
      })
      
      const mockContext = {
        request: mockRequest,
        set: {}
      }
      
      onRequestHandler(mockContext)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📥'),
        expect.stringContaining('POST'),
        expect.stringContaining('/api/users')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Response Logging', () => {
    it('should log successful responses', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      loggerPlugin.setup(mockContext, mockApp)
      
      const onResponseHandler = mockApp.onResponse.mock.calls[0][0]
      
      const mockRequest = new Request('http://localhost:3000/api/users', {
        method: 'GET'
      })
      
      const mockResponse = new Response('{"users": []}', {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json'
        }
      })
      
      const mockContext = {
        request: mockRequest,
        response: mockResponse,
        set: { status: 200 }
      }
      
      onResponseHandler(mockContext)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📤'),
        expect.stringContaining('GET'),
        expect.stringContaining('/api/users'),
        expect.stringContaining('200')
      )
      
      consoleSpy.mockRestore()
    })

    it('should log error responses differently', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      loggerPlugin.setup(mockContext, mockApp)
      
      const onResponseHandler = mockApp.onResponse.mock.calls[0][0]
      
      const mockRequest = new Request('http://localhost:3000/api/users/999', {
        method: 'GET'
      })
      
      const mockResponse = new Response('{"error": "Not found"}', {
        status: 404,
        statusText: 'Not Found'
      })
      
      const mockContext = {
        request: mockRequest,
        response: mockResponse,
        set: { status: 404 }
      }
      
      onResponseHandler(mockContext)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📤'),
        expect.stringContaining('GET'),
        expect.stringContaining('/api/users/999'),
        expect.stringContaining('404')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Error Logging', () => {
    it('should log errors with stack trace', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      loggerPlugin.setup(mockContext, mockApp)
      
      const onErrorHandler = mockApp.onError.mock.calls[0][0]
      
      const mockError = new Error('Test error')
      const mockRequest = new Request('http://localhost:3000/api/test')
      
      const mockContext = {
        error: mockError,
        request: mockRequest,
        set: {}
      }
      
      onErrorHandler(mockContext)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error:'),
        expect.stringContaining('Test error')
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle errors without stack trace', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      loggerPlugin.setup(mockContext, mockApp)
      
      const onErrorHandler = mockApp.onError.mock.calls[0][0]
      
      const mockError = { message: 'Simple error' }
      const mockRequest = new Request('http://localhost:3000/api/test')
      
      const mockContext = {
        error: mockError,
        request: mockRequest,
        set: {}
      }
      
      onErrorHandler(mockContext)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error:'),
        expect.stringContaining('Simple error')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Development vs Production', () => {
    it('should work in production mode', () => {
      const productionContext = {
        ...mockContext,
        isDevelopment: false,
        isProduction: true
      }
      
      expect(() => {
        loggerPlugin.setup(productionContext, mockApp)
      }).not.toThrow()
      
      expect(mockApp.onRequest).toHaveBeenCalled()
      expect(mockApp.onResponse).toHaveBeenCalled()
      expect(mockApp.onError).toHaveBeenCalled()
    })
  })
})