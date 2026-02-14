import '../../unit/app/auth/setup'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { AuthManager } from '@app/server/auth/AuthManager'
import { InMemoryUserProvider } from '@app/server/auth/providers/InMemoryProvider'
import { SessionManager } from '@app/server/auth/sessions/SessionManager'
import { RateLimiter } from '@app/server/auth/RateLimiter'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'
import { HashManager, setHashManager } from '@app/server/auth/HashManager'
import { setAuthManagerForMiddleware } from '@app/server/auth/middleware'

// Shared test instances
let cache: MemoryCacheDriver
let provider: InMemoryUserProvider
let sessions: SessionManager
let rateLimiter: RateLimiter
let authManager: AuthManager

// Mock the auth module: keep real middleware (auth, guest, buildRequestContext),
// override only the singleton getters that route handlers call directly.
vi.mock('@server/auth', async (importOriginal) => {
  const original = await importOriginal() as Record<string, any>
  return {
    ...original,
    getAuthManager: () => authManager,
    getRateLimiter: () => rateLimiter,
    getSessionManager: () => sessions,
    initAuth: () => ({ authManager, rateLimiter, sessionManager: sessions }),
  }
})

// Mock the config module used by auth.routes.ts
vi.mock('@config/system/auth.config', () => ({
  authConfig: {
    defaults: { guard: 'session', provider: 'memory' },
    passwords: { hashAlgorithm: 'bcrypt', bcryptRounds: 4 },
    rateLimit: { maxAttempts: 5, decaySeconds: 60 },
    token: { ttl: 86400 },
  },
}))

// Import after mocks are registered
const { Elysia } = await import('elysia')
const { authRoutes } = await import('@app/server/routes/auth.routes')

function setupTestAuth() {
  cache = new MemoryCacheDriver()
  provider = new InMemoryUserProvider()
  sessions = new SessionManager(cache, {
    lifetime: 3600,
    cookieName: 'fluxstack_session',
  })
  rateLimiter = new RateLimiter(cache)

  authManager = new AuthManager(
    {
      defaults: { guard: 'session', provider: 'memory' },
      guards: {
        session: { driver: 'session', provider: 'memory' },
      },
      providers: {
        memory: { driver: 'memory' },
      },
    },
    sessions,
  )
  authManager.registerProvider('memory', provider)
  setAuthManagerForMiddleware(authManager)
}

async function req(
  app: InstanceType<typeof Elysia>,
  method: string,
  path: string,
  body?: object,
  headers?: Record<string, string>,
) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body) opts.body = JSON.stringify(body)
  return app.handle(new Request(`http://localhost${path}`, opts))
}

describe('Auth Routes - Integration', () => {
  let app: InstanceType<typeof Elysia>

  beforeEach(() => {
    setHashManager(new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 }))
    setupTestAuth()
    app = new Elysia().use(authRoutes)
  })

  // ───── Register ─────
  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await req(app, 'POST', '/auth/register', {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
      })

      expect(res.status).toBe(201)
      const data = await res.json() as any
      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.name).toBe('John Doe')
      expect(data.user.email).toBe('john@example.com')
      // Password must not leak
      expect(data.user).not.toHaveProperty('password')
      expect(data.user).not.toHaveProperty('passwordHash')
    })

    it('should reject duplicate email', async () => {
      await req(app, 'POST', '/auth/register', {
        name: 'John', email: 'john@example.com', password: 'secret123',
      })
      const res = await req(app, 'POST', '/auth/register', {
        name: 'Jane', email: 'john@example.com', password: 'other123',
      })

      expect(res.status).toBe(422)
      const data = await res.json() as any
      expect(data.success).toBe(false)
    })

    it('should reject missing fields', async () => {
      const res = await req(app, 'POST', '/auth/register', { name: 'John' })
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('should reject short password', async () => {
      const res = await req(app, 'POST', '/auth/register', {
        name: 'John', email: 'john@example.com', password: '12',
      })
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  // ───── Login ─────
  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await provider.createUser({
        name: 'John Doe', email: 'john@example.com', password: 'secret123',
      })
    })

    it('should login with valid credentials', async () => {
      const res = await req(app, 'POST', '/auth/login', {
        email: 'john@example.com', password: 'secret123',
      })

      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('john@example.com')
    })

    it('should reject invalid password', async () => {
      const res = await req(app, 'POST', '/auth/login', {
        email: 'john@example.com', password: 'wrong-password',
      })

      expect(res.status).toBe(401)
      const data = await res.json() as any
      expect(data.success).toBe(false)
      expect(data.error).toBe('InvalidCredentials')
    })

    it('should reject unknown email', async () => {
      const res = await req(app, 'POST', '/auth/login', {
        email: 'unknown@example.com', password: 'secret123',
      })

      expect(res.status).toBe(401)
    })

    it('should rate limit after too many failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await req(app, 'POST', '/auth/login', {
          email: 'john@example.com', password: 'wrong',
        })
      }

      const res = await req(app, 'POST', '/auth/login', {
        email: 'john@example.com', password: 'secret123',
      })

      expect(res.status).toBe(429)
      const data = await res.json() as any
      expect(data.error).toBe('TooManyAttempts')
    })
  })

  // ───── Me (unauthenticated) ─────
  describe('GET /auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await req(app, 'GET', '/auth/me')
      expect(res.status).toBe(401)
      const data = await res.json() as any
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthenticated')
    })
  })

  // ───── Logout (unauthenticated) ─────
  describe('POST /auth/logout', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await req(app, 'POST', '/auth/logout')
      expect(res.status).toBe(401)
    })
  })

  // ───── Full flow ─────
  describe('Full auth flow', () => {
    it('should register, then login, verify auth state', async () => {
      // 1. Register
      const registerRes = await req(app, 'POST', '/auth/register', {
        name: 'Alice', email: 'alice@example.com', password: 'password123',
      })
      expect(registerRes.status).toBe(201)
      const registerData = await registerRes.json() as any
      expect(registerData.success).toBe(true)
      expect(registerData.user.name).toBe('Alice')

      // 2. Login
      const loginRes = await req(app, 'POST', '/auth/login', {
        email: 'alice@example.com', password: 'password123',
      })
      expect(loginRes.status).toBe(200)
      const loginData = await loginRes.json() as any
      expect(loginData.success).toBe(true)
      expect(loginData.user.email).toBe('alice@example.com')

      // 3. Without cookie/token, me should still fail
      const meRes = await req(app, 'GET', '/auth/me')
      expect(meRes.status).toBe(401)
    })
  })
})
