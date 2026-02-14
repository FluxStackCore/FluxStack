import { describe, it, expect, beforeEach } from 'vitest'
import { SessionManager } from '@app/server/auth/sessions/SessionManager'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'

describe('SessionManager', () => {
  let sessions: SessionManager
  let cache: MemoryCacheDriver

  beforeEach(() => {
    cache = new MemoryCacheDriver()
    sessions = new SessionManager(cache, { lifetime: 3600 })
  })

  describe('create', () => {
    it('should create a session and return an ID', async () => {
      const id = await sessions.create()
      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBe(64) // 32 bytes hex
    })

    it('should create session with initial data', async () => {
      const id = await sessions.create({ userId: 1 })
      const data = await sessions.read(id)
      expect(data?.userId).toBe(1)
    })

    it('should generate unique IDs', async () => {
      const id1 = await sessions.create()
      const id2 = await sessions.create()
      expect(id1).not.toBe(id2)
    })
  })

  describe('read', () => {
    it('should return session data', async () => {
      const id = await sessions.create({ foo: 'bar' })
      const data = await sessions.read(id)
      expect(data?.foo).toBe('bar')
    })

    it('should return null for non-existent session', async () => {
      const data = await sessions.read('nonexistent')
      expect(data).toBeNull()
    })
  })

  describe('update', () => {
    it('should merge new data into existing session', async () => {
      const id = await sessions.create({ a: 1, b: 2 })
      await sessions.update(id, { b: 3, c: 4 })
      const data = await sessions.read(id)
      expect(data?.a).toBe(1)
      expect(data?.b).toBe(3)
      expect(data?.c).toBe(4)
    })

    it('should do nothing for non-existent session', async () => {
      await sessions.update('nonexistent', { foo: 'bar' })
      const data = await sessions.read('nonexistent')
      expect(data).toBeNull()
    })
  })

  describe('put', () => {
    it('should set a specific key in the session', async () => {
      const id = await sessions.create({ existing: true })
      await sessions.put(id, 'newKey', 'newValue')
      const data = await sessions.read(id)
      expect(data?.existing).toBe(true)
      expect(data?.newKey).toBe('newValue')
    })
  })

  describe('forget', () => {
    it('should remove a specific key from the session', async () => {
      const id = await sessions.create({ keep: true, remove: true })
      await sessions.forget(id, 'remove')
      const data = await sessions.read(id)
      expect(data?.keep).toBe(true)
      expect(data?.remove).toBeUndefined()
    })
  })

  describe('destroy', () => {
    it('should delete the session', async () => {
      const id = await sessions.create({ userId: 1 })
      await sessions.destroy(id)
      const data = await sessions.read(id)
      expect(data).toBeNull()
    })
  })

  describe('regenerate', () => {
    it('should create new ID with same data', async () => {
      const oldId = await sessions.create({ userId: 1, name: 'Test' })
      const newId = await sessions.regenerate(oldId)

      expect(newId).not.toBe(oldId)
      expect(await sessions.read(oldId)).toBeNull()

      const data = await sessions.read(newId)
      expect(data?.userId).toBe(1)
      expect(data?.name).toBe('Test')
    })

    it('should handle regenerating non-existent session', async () => {
      const newId = await sessions.regenerate('nonexistent')
      expect(newId).toBeDefined()
      // New session created without data
    })
  })
})
