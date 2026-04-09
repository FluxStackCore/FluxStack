import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for registerAuthProvider (#84).
 *
 * When the LiveComponents plugin has not been initialized yet,
 * registerAuthProvider should buffer the provider in pendingAuthProviders.
 * When liveServer is available, it should delegate directly to liveServer.useAuth().
 */

describe('registerAuthProvider (#84)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('buffers provider when liveServer is null', async () => {
    const pending: any[] = []
    vi.doMock('../../../core/server/live/websocket-plugin', () => ({
      liveServer: null,
      pendingAuthProviders: pending,
    }))
    const { registerAuthProvider } = await import('../../../core/server/live/index')

    const fakeProvider = { authenticate: vi.fn() }
    registerAuthProvider(fakeProvider)

    expect(pending).toHaveLength(1)
    expect(pending[0]).toBe(fakeProvider)
  })

  it('delegates to liveServer.useAuth when initialized', async () => {
    const useAuth = vi.fn()
    vi.doMock('../../../core/server/live/websocket-plugin', () => ({
      liveServer: { useAuth },
      pendingAuthProviders: [],
    }))
    const { registerAuthProvider } = await import('../../../core/server/live/index')

    const fakeProvider = { authenticate: vi.fn() }
    registerAuthProvider(fakeProvider)

    expect(useAuth).toHaveBeenCalledWith(fakeProvider)
  })
})
