/**
 * Tests for Bug 4 (health check) and Bug 5 (security headers)
 */
import { describe, it, expect } from 'vitest'

// ===== Bug 4: Health check should return subsystem info =====
describe('Bug 4: Health check returns subsystem information', () => {
  it('should return structured health data with status field', async () => {
    // Import the routes module and use Elysia's test helpers
    const { Elysia } = await import('elysia')
    const { apiRoutes } = await import('@app/server/routes/index')

    const app = new Elysia().use(apiRoutes)

    const response = await app.handle(new Request('http://localhost/api/health'))
    expect(response.status).toBe(200)

    const body = await response.json()

    // Must have structured status field (not just a string message)
    expect(body.status).toBeDefined()
    expect(['ok', 'degraded', 'error']).toContain(body.status)
  })

  it('should return uptime as a number (seconds)', async () => {
    const { Elysia } = await import('elysia')
    const { apiRoutes } = await import('@app/server/routes/index')

    const app = new Elysia().use(apiRoutes)

    const response = await app.handle(new Request('http://localhost/api/health'))
    const body = await response.json()

    expect(typeof body.uptime).toBe('number')
    expect(body.uptime).toBeGreaterThanOrEqual(0)
  })

  it('should return memory usage info', async () => {
    const { Elysia } = await import('elysia')
    const { apiRoutes } = await import('@app/server/routes/index')

    const app = new Elysia().use(apiRoutes)

    const response = await app.handle(new Request('http://localhost/api/health'))
    const body = await response.json()

    expect(body.memory).toBeDefined()
    expect(typeof body.memory.used).toBe('number')
    expect(typeof body.memory.total).toBe('number')
    expect(body.memory.used).toBeGreaterThan(0)
    expect(body.memory.total).toBeGreaterThan(0)
  })

  it('should return version string', async () => {
    const { Elysia } = await import('elysia')
    const { apiRoutes } = await import('@app/server/routes/index')

    const app = new Elysia().use(apiRoutes)

    const response = await app.handle(new Request('http://localhost/api/health'))
    const body = await response.json()

    expect(body.version).toBeDefined()
    expect(typeof body.version).toBe('string')
    // Should be a semver-like version, not a status message
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('should return ISO timestamp', async () => {
    const { Elysia } = await import('elysia')
    const { apiRoutes } = await import('@app/server/routes/index')

    const app = new Elysia().use(apiRoutes)

    const response = await app.handle(new Request('http://localhost/api/health'))
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    // Should be a valid ISO date string
    const parsed = new Date(body.timestamp)
    expect(parsed.getTime()).not.toBeNaN()
  })
})

// ===== Bug 5: Security headers =====
describe('Bug 5: Security headers middleware', () => {
  it('should include X-Content-Type-Options: nosniff', async () => {
    const { FluxStackFramework } = await import('@core/framework/server')

    const framework = new FluxStackFramework({
      server: { port: 0, host: 'localhost', apiPrefix: '/api', enableRequestLogging: false } as any
    })
    const app = framework.getApp()
    // Add a simple test route
    app.get('/test-headers', () => ({ ok: true }))

    const response = await app.handle(new Request('http://localhost/test-headers'))
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('should include X-Frame-Options: DENY', async () => {
    const { FluxStackFramework } = await import('@core/framework/server')

    const framework = new FluxStackFramework({
      server: { port: 0, host: 'localhost', apiPrefix: '/api', enableRequestLogging: false } as any
    })
    const app = framework.getApp()
    app.get('/test-headers', () => ({ ok: true }))

    const response = await app.handle(new Request('http://localhost/test-headers'))
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('should include Referrer-Policy header', async () => {
    const { FluxStackFramework } = await import('@core/framework/server')

    const framework = new FluxStackFramework({
      server: { port: 0, host: 'localhost', apiPrefix: '/api', enableRequestLogging: false } as any
    })
    const app = framework.getApp()
    app.get('/test-headers', () => ({ ok: true }))

    const response = await app.handle(new Request('http://localhost/test-headers'))
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('should include X-XSS-Protection: 0', async () => {
    const { FluxStackFramework } = await import('@core/framework/server')

    const framework = new FluxStackFramework({
      server: { port: 0, host: 'localhost', apiPrefix: '/api', enableRequestLogging: false } as any
    })
    const app = framework.getApp()
    app.get('/test-headers', () => ({ ok: true }))

    const response = await app.handle(new Request('http://localhost/test-headers'))
    expect(response.headers.get('X-XSS-Protection')).toBe('0')
  })
})
