import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'
import { CacheManager } from '@app/server/cache/CacheManager'

describe('MemoryCacheDriver', () => {
  let cache: MemoryCacheDriver

  beforeEach(() => {
    cache = new MemoryCacheDriver()
  })

  describe('get/set', () => {
    it('should store and retrieve a value', async () => {
      await cache.set('key', 'value')
      const result = await cache.get('key')
      expect(result).toBe('value')
    })

    it('should store and retrieve objects', async () => {
      const obj = { name: 'test', count: 42 }
      await cache.set('obj', obj)
      const result = await cache.get<typeof obj>('obj')
      expect(result).toEqual(obj)
    })

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should respect TTL and expire entries', async () => {
      await cache.set('expiring', 'value', 0.1) // 100ms TTL
      expect(await cache.get('expiring')).toBe('value')

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(await cache.get('expiring')).toBeNull()
    })

    it('should overwrite existing values', async () => {
      await cache.set('key', 'first')
      await cache.set('key', 'second')
      expect(await cache.get('key')).toBe('second')
    })
  })

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await cache.set('key', 'value')
      expect(await cache.has('key')).toBe(true)
    })

    it('should return false for non-existent keys', async () => {
      expect(await cache.has('nope')).toBe(false)
    })
  })

  describe('delete', () => {
    it('should remove a key', async () => {
      await cache.set('key', 'value')
      const deleted = await cache.delete('key')
      expect(deleted).toBe(true)
      expect(await cache.get('key')).toBeNull()
    })

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.delete('nope')
      expect(deleted).toBe(false)
    })
  })

  describe('flush', () => {
    it('should clear all entries', async () => {
      await cache.set('a', 1)
      await cache.set('b', 2)
      await cache.flush()
      expect(cache.size).toBe(0)
      expect(await cache.get('a')).toBeNull()
    })
  })

  describe('increment/decrement', () => {
    it('should increment a value', async () => {
      await cache.set('counter', 5)
      const result = await cache.increment('counter')
      expect(result).toBe(6)
    })

    it('should increment non-existent key from 0', async () => {
      const result = await cache.increment('newcounter')
      expect(result).toBe(1)
    })

    it('should increment by custom amount', async () => {
      await cache.set('counter', 10)
      const result = await cache.increment('counter', 5)
      expect(result).toBe(15)
    })

    it('should decrement a value', async () => {
      await cache.set('counter', 10)
      const result = await cache.decrement('counter')
      expect(result).toBe(9)
    })
  })

  describe('remember', () => {
    it('should execute callback and cache result on miss', async () => {
      let callCount = 0
      const result = await cache.remember('key', 60, async () => {
        callCount++
        return 'computed'
      })

      expect(result).toBe('computed')
      expect(callCount).toBe(1)
    })

    it('should return cached value on hit without executing callback', async () => {
      await cache.set('key', 'cached')
      let callCount = 0
      const result = await cache.remember('key', 60, async () => {
        callCount++
        return 'computed'
      })

      expect(result).toBe('cached')
      expect(callCount).toBe(0)
    })
  })

  describe('gc', () => {
    it('should remove expired entries', async () => {
      await cache.set('alive', 'value', 9999)
      await cache.set('dead', 'value', 0.05) // 50ms

      await new Promise(resolve => setTimeout(resolve, 100))
      await cache.gc()

      expect(await cache.get('alive')).toBe('value')
      expect(await cache.get('dead')).toBeNull()
    })
  })
})

describe('CacheManager', () => {
  it('should return memory driver by default', () => {
    const manager = new CacheManager()
    const driver = manager.driver()
    expect(driver).toBeDefined()
  })

  it('should cache driver instances (singleton)', () => {
    const manager = new CacheManager()
    const d1 = manager.driver()
    const d2 = manager.driver()
    expect(d1).toBe(d2)
  })

  it('should allow registering custom drivers', async () => {
    const manager = new CacheManager()
    const customDriver = new MemoryCacheDriver()
    manager.extend('custom', () => customDriver)

    const driver = manager.driver('custom')
    expect(driver).toBe(customDriver)
  })

  it('should throw for unknown driver', () => {
    const manager = new CacheManager()
    expect(() => manager.driver('unknown')).toThrow("Cache driver 'unknown' not registered")
  })
})
