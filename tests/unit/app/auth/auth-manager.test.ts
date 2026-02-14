import './setup'
import { describe, it, expect, beforeEach } from 'vitest'
import { AuthManager } from '@app/server/auth/AuthManager'
import { InMemoryUserProvider } from '@app/server/auth/providers/InMemoryProvider'
import { SessionManager } from '@app/server/auth/sessions/SessionManager'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'
import { HashManager, setHashManager } from '@app/server/auth/HashManager'
import type { Guard, UserProvider, GuardConfig } from '@app/server/auth/contracts'

describe('AuthManager', () => {
  let manager: AuthManager
  let cache: MemoryCacheDriver
  let sessions: SessionManager
  let provider: InMemoryUserProvider

  beforeEach(() => {
    setHashManager(new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 }))
    cache = new MemoryCacheDriver()
    sessions = new SessionManager(cache)
    provider = new InMemoryUserProvider()

    manager = new AuthManager(
      {
        defaults: { guard: 'session', provider: 'memory' },
        guards: {
          session: { driver: 'session', provider: 'memory' },
          token: { driver: 'token', provider: 'memory' },
        },
        providers: {
          memory: { driver: 'memory' },
        },
      },
      sessions
    )

    manager.registerProvider('memory', provider)
  })

  describe('guard', () => {
    it('should return the default guard', () => {
      const guard = manager.guard()
      expect(guard).toBeDefined()
      expect(guard.name).toBe('session')
    })

    it('should return a named guard', () => {
      const guard = manager.guard('token')
      expect(guard).toBeDefined()
      expect(guard.name).toBe('token')
    })

    it('should cache guard instances', () => {
      const g1 = manager.guard('session')
      const g2 = manager.guard('session')
      expect(g1).toBe(g2)
    })

    it('should throw for unknown guard', () => {
      expect(() => manager.guard('unknown')).toThrow("Auth guard 'unknown' not configured")
    })
  })

  describe('extend', () => {
    it('should allow registering custom guard drivers', () => {
      const mockGuard: Guard = {
        name: 'custom',
        user: async () => null,
        id: async () => null,
        check: async () => false,
        guest: async () => true,
        attempt: async () => null,
        login: async () => {},
        logout: async () => {},
        validate: async () => false,
        setRequest: () => {},
      }

      manager.extend('custom', () => mockGuard)

      // Add guard config that uses the custom driver
      ;(manager as any).config.guards.custom = { driver: 'custom', provider: 'memory' }

      const guard = manager.guard('custom')
      expect(guard).toBe(mockGuard)
    })
  })

  describe('freshGuard', () => {
    it('should create a new guard instance (not cached)', () => {
      const g1 = manager.guard('session')
      const g2 = manager.freshGuard('session')
      expect(g1).not.toBe(g2)
    })
  })

  describe('getDefaultGuardName', () => {
    it('should return the default guard name', () => {
      expect(manager.getDefaultGuardName()).toBe('session')
    })
  })
})
