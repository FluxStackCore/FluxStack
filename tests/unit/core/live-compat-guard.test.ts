import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for the Live Components compat layer null guard (#85).
 *
 * When the LiveComponents plugin has not been initialized yet,
 * accessing any deprecated singleton should throw a descriptive error
 * instead of crashing with an opaque null dereference.
 */

// We need to control the value of liveServer exported from websocket-plugin.
// The compat layer in core/server/live/index.ts imports liveServer at module
// level, so we mock the websocket-plugin module to control its value.

const EXPECTED_ERROR = 'LiveComponents plugin not initialized'

describe('Live Components compat layer null guard (#85)', () => {
  describe('when liveServer is null (plugin not initialized)', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('componentRegistry proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { componentRegistry } = await import('../../../core/server/live/index')

      expect(() => componentRegistry.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('connectionManager proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { connectionManager } = await import('../../../core/server/live/index')

      expect(() => connectionManager.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('liveRoomManager proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { liveRoomManager } = await import('../../../core/server/live/index')

      expect(() => liveRoomManager.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('roomEvents proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { roomEvents } = await import('../../../core/server/live/index')

      expect(() => roomEvents.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('fileUploadManager proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { fileUploadManager } = await import('../../../core/server/live/index')

      expect(() => fileUploadManager.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('performanceMonitor proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { performanceMonitor } = await import('../../../core/server/live/index')

      expect(() => performanceMonitor.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('stateSignature proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { stateSignature } = await import('../../../core/server/live/index')

      expect(() => stateSignature.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('roomState proxy throws descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { roomState } = await import('../../../core/server/live/index')

      expect(() => roomState.someMethod).toThrowError(EXPECTED_ERROR)
    })

    it('liveAuthManager getters throw descriptive error', async () => {
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: [],
      }))
      const { liveAuthManager } = await import('../../../core/server/live/index')

      expect(() => liveAuthManager.authenticate).toThrowError(EXPECTED_ERROR)
      expect(() => liveAuthManager.hasProviders).toThrowError(EXPECTED_ERROR)
      expect(() => liveAuthManager.authorizeRoom).toThrowError(EXPECTED_ERROR)
      expect(() => liveAuthManager.authorizeAction).toThrowError(EXPECTED_ERROR)
      expect(() => liveAuthManager.authorizeComponent).toThrowError(EXPECTED_ERROR)
    })

    it('liveAuthManager.register() buffers provider when liveServer is null', async () => {
      const pending: any[] = []
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: null,
        pendingAuthProviders: pending,
      }))
      const { liveAuthManager } = await import('../../../core/server/live/index')

      const fakeProvider = { authenticate: vi.fn() }
      liveAuthManager.register(fakeProvider)

      expect(pending).toHaveLength(1)
      expect(pending[0]).toBe(fakeProvider)
    })
  })

  describe('when liveServer is initialized', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('componentRegistry proxy delegates to liveServer.registry', async () => {
      const mockRegistry = { register: vi.fn(), get: vi.fn(() => 'found') }
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: { registry: mockRegistry },
        pendingAuthProviders: [],
      }))
      const { componentRegistry } = await import('../../../core/server/live/index')

      expect(componentRegistry.get()).toBe('found')
    })

    it('liveAuthManager.register() delegates to liveServer.useAuth', async () => {
      const useAuth = vi.fn()
      vi.doMock('../../../core/server/live/websocket-plugin', () => ({
        liveServer: { useAuth },
        pendingAuthProviders: [],
      }))
      const { liveAuthManager } = await import('../../../core/server/live/index')

      const fakeProvider = { authenticate: vi.fn() }
      liveAuthManager.register(fakeProvider)

      expect(useAuth).toHaveBeenCalledWith(fakeProvider)
    })
  })
})
