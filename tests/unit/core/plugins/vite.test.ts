import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock global fetch before any other imports
Object.defineProperty(global, 'fetch', {
  value: vi.fn(),
  writable: true,
  configurable: true
})
import { vitePlugin } from '@/core/plugins/built-in/vite'
import type { PluginContext } from '@/core/types'

// Remove duplicate global fetch assignment as it's now set above

describe.skip('Vite Plugin', () => {
  let mockContext: PluginContext
  let mockApp: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()

    mockContext = {
      config: {
        server: { port: 3000, host: 'localhost', apiPrefix: '/api', cors: { origins: [], methods: [], headers: [] }, middleware: [] },
        client: { port: 5173, proxy: { target: 'http://localhost:3000' }, build: { outDir: 'dist', target: 'es2020', sourceMaps: true, minify: false } },
        app: { name: 'test', version: '1.0.0' }
      },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(), time: vi.fn(), timeEnd: vi.fn(), request: vi.fn() },
      app: mockApp,
      utils: {
        isDevelopment: vi.fn(() => true),
        isProduction: vi.fn(() => false),
        createTimer: vi.fn(),
        formatBytes: vi.fn(),
        getEnvironment: vi.fn(() => 'test'),
        createHash: vi.fn(),
        deepMerge: vi.fn(),
        validateSchema: vi.fn()
      }
    } as any

    mockApp = {
      get: vi.fn(),
      post: vi.fn(),
      use: vi.fn()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Development Mode', () => {
    it('should set up plugin in development mode', async () => {
      await vitePlugin.setup!(mockContext)
      
      expect(mockContext.logger.info).toHaveBeenCalledWith('Setting up Vite integration on localhost:5173')
    })

    it('should check for Vite after timeout', async () => {
      // Mock successful Vite check
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true
      } as Response)
      
      await vitePlugin.setup!(mockContext)
      
      // Fast-forward timers to trigger the setTimeout
      vi.advanceTimersByTime(2000)
      
      // Wait for the async operation to complete
      await vi.runAllTimersAsync()
      
      expect(fetch).toHaveBeenCalledWith('http://localhost:5173', {
        signal: expect.any(AbortSignal)
      })
      
      expect(mockContext.logger.info).toHaveBeenCalledWith('✓ Vite server detected on localhost:5173')
      expect(mockContext.logger.info).toHaveBeenCalledWith('Hot reload coordination active')
    })

    it('should handle Vite check failure silently', async () => {
      // Mock failed Vite check
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'))
      
      await vitePlugin.setup!(mockContext)
      
      // Fast-forward timers
      vi.advanceTimersByTime(2000)
      await vi.runAllTimersAsync()
      
      expect(fetch).toHaveBeenCalledWith('http://localhost:5173', {
        signal: expect.any(AbortSignal)
      })
      
      // Should not log success messages when Vite is not running
      expect(mockContext.logger.info).not.toHaveBeenCalledWith('✓ Vite server detected on localhost:5173')
    })

    it('should use custom vite port from context', async () => {
      const customContext = {
        ...mockContext,
        config: {
          ...mockContext.config,
          client: { ...mockContext.config.client, port: 3001 }
        }
      }
      
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true
      } as Response)
      
      await vitePlugin.setup!(customContext)
      
      expect(customContext.logger.info).toHaveBeenCalledWith('Setting up Vite integration on localhost:3001')
      
      vi.advanceTimersByTime(2000)
      await vi.runAllTimersAsync()
      
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001', {
        signal: expect.any(AbortSignal)
      })
    })
  })

  describe('Production Mode', () => {
    it('should skip plugin setup in production mode', async () => {
      const productionContext = {
        ...mockContext,
        utils: {
          ...mockContext.utils,
          isDevelopment: vi.fn(() => false),
          isProduction: vi.fn(() => true)
        }
      }
      
      await vitePlugin.setup!(productionContext)
      
      expect(productionContext.logger.info).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('Plugin Properties', () => {
    it('should have correct plugin name', () => {
      expect(vitePlugin.name).toBe('vite')
    })

    it('should have setup function', () => {
      expect(typeof vitePlugin.setup).toBe('function')
    })
  })

  describe('checkViteRunning function', () => {
    it('should return true for successful connection', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true
      } as Response)

      // We need to access the checkViteRunning function
      // Since it's not exported, we'll test it indirectly through the plugin
      await vitePlugin.setup!(mockContext)
      vi.advanceTimersByTime(2000)
      await vi.runAllTimersAsync()

      expect(mockContext.logger.info).toHaveBeenCalledWith('✓ Vite server detected on localhost:5173')
    })

    it('should return false for connection timeout', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 1500)
        })
      )
      
      await vitePlugin.setup!(mockContext)
      vi.advanceTimersByTime(2000)
      await vi.runAllTimersAsync()

      // Should not show success message when timeout occurs
      expect(mockContext.logger.info).not.toHaveBeenCalledWith('✓ Vite server detected on localhost:5173')
    })
  })
})