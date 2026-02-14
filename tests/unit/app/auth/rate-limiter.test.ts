import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter } from '@app/server/auth/RateLimiter'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'

describe('RateLimiter', () => {
  let limiter: RateLimiter
  let cache: MemoryCacheDriver

  beforeEach(() => {
    cache = new MemoryCacheDriver()
    limiter = new RateLimiter(cache)
  })

  describe('hit', () => {
    it('should register a hit and return count', async () => {
      const count = await limiter.hit('test-key', 60)
      expect(count).toBe(1)
    })

    it('should increment on subsequent hits', async () => {
      await limiter.hit('test-key', 60)
      const count = await limiter.hit('test-key', 60)
      expect(count).toBe(2)
    })
  })

  describe('tooManyAttempts', () => {
    it('should return false under the limit', async () => {
      await limiter.hit('key', 60)
      await limiter.hit('key', 60)
      expect(await limiter.tooManyAttempts('key', 5)).toBe(false)
    })

    it('should return true when limit is reached', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.hit('key', 60)
      }
      expect(await limiter.tooManyAttempts('key', 5)).toBe(true)
    })

    it('should return false for unknown keys', async () => {
      expect(await limiter.tooManyAttempts('unknown', 5)).toBe(false)
    })
  })

  describe('attempts', () => {
    it('should return 0 for unknown keys', async () => {
      expect(await limiter.attempts('unknown')).toBe(0)
    })

    it('should return current attempt count', async () => {
      await limiter.hit('key', 60)
      await limiter.hit('key', 60)
      await limiter.hit('key', 60)
      expect(await limiter.attempts('key')).toBe(3)
    })
  })

  describe('remainingAttempts', () => {
    it('should return max when no attempts', async () => {
      expect(await limiter.remainingAttempts('key', 5)).toBe(5)
    })

    it('should decrease with each hit', async () => {
      await limiter.hit('key', 60)
      await limiter.hit('key', 60)
      expect(await limiter.remainingAttempts('key', 5)).toBe(3)
    })

    it('should return 0 when exhausted', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.hit('key', 60)
      }
      expect(await limiter.remainingAttempts('key', 5)).toBe(0)
    })
  })

  describe('clear', () => {
    it('should reset attempts for a key', async () => {
      await limiter.hit('key', 60)
      await limiter.hit('key', 60)
      await limiter.clear('key')
      expect(await limiter.attempts('key')).toBe(0)
      expect(await limiter.tooManyAttempts('key', 5)).toBe(false)
    })
  })

  describe('availableIn', () => {
    it('should return 0 for unknown keys', async () => {
      expect(await limiter.availableIn('unknown')).toBe(0)
    })

    it('should return remaining seconds', async () => {
      await limiter.hit('key', 60)
      const seconds = await limiter.availableIn('key')
      expect(seconds).toBeGreaterThan(0)
      expect(seconds).toBeLessThanOrEqual(60)
    })
  })

  describe('expiry', () => {
    it('should reset after decay period', async () => {
      await limiter.hit('key', 0.1) // 100ms decay
      expect(await limiter.attempts('key')).toBe(1)

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(await limiter.attempts('key')).toBe(0)
    })
  })
})
