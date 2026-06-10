import './setup'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionGuard } from '@app/server/auth/guards/SessionGuard'
import { TokenGuard } from '@app/server/auth/guards/TokenGuard'
import { InMemoryUserProvider } from '@app/server/auth/providers/InMemoryProvider'
import { SessionManager } from '@app/server/auth/sessions/SessionManager'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'
import { HashManager, setHashManager } from '@app/server/auth/HashManager'
import type { RequestContext } from '@app/server/auth/contracts'

// Helper to create mock request context
function createMockRequestContext(overrides: Partial<RequestContext> = {}): RequestContext {
  const cookies: Record<string, string> = {}

  return {
    headers: {},
    cookie: new Proxy({} as any, {
      get(_, name: string) {
        return {
          value: cookies[name] ?? '',
          set(opts: any) {
            if (opts.maxAge === 0) {
              delete cookies[name]
            } else {
              cookies[name] = opts.value ?? ''
            }
          },
        }
      }
    }),
    setCookie: (name: string, value: string, _options?: any) => {
      cookies[name] = value
    },
    removeCookie: (name: string) => {
      delete cookies[name]
    },
    ip: '127.0.0.1',
    ...overrides,
  }
}

describe('SessionGuard', () => {
  let guard: SessionGuard
  let provider: InMemoryUserProvider
  let sessions: SessionManager
  let cache: MemoryCacheDriver

  beforeEach(() => {
    setHashManager(new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 }))
    cache = new MemoryCacheDriver()
    provider = new InMemoryUserProvider()
    sessions = new SessionManager(cache, { lifetime: 3600, cookieName: 'test_session' })
    guard = new SessionGuard('session', provider, sessions)
  })

  describe('attempt', () => {
    it('should authenticate with valid credentials', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      const user = await guard.attempt({ email: 'john@test.com', password: 'secret123' })
      expect(user).not.toBeNull()
      expect(user?.getAuthId()).toBe(1)
    })

    it('should return null for invalid password', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      const user = await guard.attempt({ email: 'john@test.com', password: 'wrong' })
      expect(user).toBeNull()
    })

    it('should return null for unknown email', async () => {
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      const user = await guard.attempt({ email: 'unknown@test.com', password: 'secret' })
      expect(user).toBeNull()
    })

    it('should create a session after successful attempt', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      await guard.attempt({ email: 'john@test.com', password: 'secret123' })
      expect(await guard.check()).toBe(true)
    })
  })

  describe('user', () => {
    it('should return null when not authenticated', async () => {
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      expect(await guard.user()).toBeNull()
    })

    it('should return user after login', async () => {
      const created = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      await guard.login(created)
      const user = await guard.user()
      expect(user).not.toBeNull()
      expect(user?.getAuthId()).toBe(1)
    })
  })

  describe('check/guest', () => {
    it('should return check=false and guest=true when not authenticated', async () => {
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      expect(await guard.check()).toBe(false)
      expect(await guard.guest()).toBe(true)
    })

    it('should return check=true and guest=false after login', async () => {
      const created = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      await guard.login(created)
      expect(await guard.check()).toBe(true)
      expect(await guard.guest()).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear the session', async () => {
      const created = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      await guard.login(created)
      expect(await guard.check()).toBe(true)

      await guard.logout()
      expect(await guard.check()).toBe(false)
      expect(await guard.user()).toBeNull()
    })
  })

  describe('validate', () => {
    it('should return true for valid credentials without logging in', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      const valid = await guard.validate({ email: 'john@test.com', password: 'secret123' })
      expect(valid).toBe(true)
      // Should NOT be logged in
      expect(await guard.check()).toBe(false)
    })
  })
})

describe('TokenGuard', () => {
  let guard: TokenGuard
  let provider: InMemoryUserProvider
  let cache: MemoryCacheDriver

  beforeEach(() => {
    setHashManager(new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 }))
    cache = new MemoryCacheDriver()
    provider = new InMemoryUserProvider()
    guard = new TokenGuard('token', provider, cache, 3600)
  })

  describe('attempt', () => {
    it('should authenticate and generate token', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      const user = await guard.attempt({ email: 'john@test.com', password: 'secret123' })
      expect(user).not.toBeNull()

      const token = guard.getLastGeneratedToken()
      expect(token).not.toBeNull()
      expect(typeof token).toBe('string')
    })

    // Security: the plain-text token must not linger in the guard instance after
    // being consumed (specs/01-backend FP-1). getLastGeneratedToken() is one-shot.
    it('getLastGeneratedToken is one-shot — second read returns null', async () => {
      await provider.createUser({ name: 'Jane', email: 'jane@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      await guard.attempt({ email: 'jane@test.com', password: 'secret123' })

      const first = guard.getLastGeneratedToken()
      const second = guard.getLastGeneratedToken()
      expect(first).not.toBeNull()
      expect(second).toBeNull() // token was cleared after the first read
    })

    it('setRequest clears any token from a previous request', async () => {
      await provider.createUser({ name: 'Jane', email: 'jane@test.com', password: 'secret123' })
      guard.setRequest(createMockRequestContext())
      await guard.attempt({ email: 'jane@test.com', password: 'secret123' })

      // A new request arrives before the previous token was read.
      guard.setRequest(createMockRequestContext())
      expect(guard.getLastGeneratedToken()).toBeNull()
    })

    it('should return null for invalid credentials', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      const user = await guard.attempt({ email: 'john@test.com', password: 'wrong' })
      expect(user).toBeNull()
    })
  })

  describe('user (via bearer token)', () => {
    it('should resolve user from Authorization header', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const loginCtx = createMockRequestContext()
      guard.setRequest(loginCtx)
      await guard.attempt({ email: 'john@test.com', password: 'secret123' })

      const token = guard.getLastGeneratedToken()!

      // New request with the token
      const newGuard = new TokenGuard('token', provider, cache, 3600)
      const requestCtx = createMockRequestContext({
        headers: { authorization: `Bearer ${token}` },
      })
      newGuard.setRequest(requestCtx)

      const user = await newGuard.user()
      expect(user).not.toBeNull()
      expect(user?.getAuthId()).toBe(1)
    })

    it('should return null for invalid token', async () => {
      const ctx = createMockRequestContext({
        headers: { authorization: 'Bearer invalid-token' },
      })
      guard.setRequest(ctx)

      const user = await guard.user()
      expect(user).toBeNull()
    })

    it('should return null without Authorization header', async () => {
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)

      const user = await guard.user()
      expect(user).toBeNull()
    })
  })

  describe('logout', () => {
    it('should revoke the current token', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const ctx = createMockRequestContext()
      guard.setRequest(ctx)
      await guard.attempt({ email: 'john@test.com', password: 'secret123' })
      const token = guard.getLastGeneratedToken()!

      // Logout with the token
      const logoutCtx = createMockRequestContext({
        headers: { authorization: `Bearer ${token}` },
      })
      guard.setRequest(logoutCtx)
      await guard.logout()

      // Token should be invalid now
      const checkGuard = new TokenGuard('token', provider, cache, 3600)
      const checkCtx = createMockRequestContext({
        headers: { authorization: `Bearer ${token}` },
      })
      checkGuard.setRequest(checkCtx)

      const user = await checkGuard.user()
      expect(user).toBeNull()
    })
  })

  describe('revokeAllTokens', () => {
    it('should invalidate all tokens for a user', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })

      // Generate multiple tokens
      const tokens: string[] = []
      for (let i = 0; i < 3; i++) {
        const g = new TokenGuard('token', provider, cache, 3600)
        const ctx = createMockRequestContext()
        g.setRequest(ctx)
        await g.attempt({ email: 'john@test.com', password: 'secret123' })
        tokens.push(g.getLastGeneratedToken()!)
      }

      // Revoke all
      await guard.revokeAllTokens(1)

      // All tokens should be invalid
      for (const token of tokens) {
        const g = new TokenGuard('token', provider, cache, 3600)
        const ctx = createMockRequestContext({ headers: { authorization: `Bearer ${token}` } })
        g.setRequest(ctx)
        expect(await g.user()).toBeNull()
      }
    })
  })
})
