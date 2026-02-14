import './setup'
import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryUserProvider, InMemoryUser } from '@app/server/auth/providers/InMemoryProvider'
import { HashManager, setHashManager } from '@app/server/auth/HashManager'

describe('InMemoryUserProvider', () => {
  let provider: InMemoryUserProvider

  beforeEach(() => {
    // Use fast hashing for tests
    setHashManager(new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 }))
    provider = new InMemoryUserProvider()
  })

  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const user = await provider.createUser({
        name: 'John',
        email: 'john@example.com',
        password: 'secret123',
      })

      expect(user.getAuthId()).toBe(1)
      expect(user.toJSON()).toMatchObject({
        name: 'John',
        email: 'john@example.com',
      })
      // Password should be hashed, not plain
      expect(user.getAuthPassword()).not.toBe('secret123')
      expect(user.getAuthPassword().startsWith('$2')).toBe(true)
    })

    it('should auto-increment IDs', async () => {
      const user1 = await provider.createUser({ name: 'A', email: 'a@test.com', password: 'pass' })
      const user2 = await provider.createUser({ name: 'B', email: 'b@test.com', password: 'pass' })
      expect(user1.getAuthId()).toBe(1)
      expect(user2.getAuthId()).toBe(2)
    })

    it('should reject duplicate emails', async () => {
      await provider.createUser({ name: 'A', email: 'same@test.com', password: 'pass' })
      await expect(
        provider.createUser({ name: 'B', email: 'same@test.com', password: 'pass' })
      ).rejects.toThrow('Email already in use')
    })

    it('should require name, email, and password', async () => {
      await expect(
        provider.createUser({ name: '', email: 'a@test.com', password: 'pass' })
      ).rejects.toThrow()
    })
  })

  describe('retrieveById', () => {
    it('should find user by ID', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'pass' })
      const user = await provider.retrieveById(1)
      expect(user).not.toBeNull()
      expect(user?.toJSON()).toMatchObject({ name: 'John' })
    })

    it('should return null for unknown ID', async () => {
      const user = await provider.retrieveById(999)
      expect(user).toBeNull()
    })
  })

  describe('retrieveByCredentials', () => {
    it('should find user by email (without password)', async () => {
      await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret' })
      const user = await provider.retrieveByCredentials({ email: 'john@test.com', password: 'secret' })
      expect(user).not.toBeNull()
      expect(user?.toJSON()).toMatchObject({ name: 'John' })
    })

    it('should return null for unknown email', async () => {
      const user = await provider.retrieveByCredentials({ email: 'unknown@test.com' })
      expect(user).toBeNull()
    })
  })

  describe('validateCredentials', () => {
    it('should validate correct password', async () => {
      const user = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const valid = await provider.validateCredentials(user, { password: 'secret123' })
      expect(valid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const user = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const valid = await provider.validateCredentials(user, { password: 'wrong' })
      expect(valid).toBe(false)
    })

    it('should reject when no password provided', async () => {
      const user = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'secret123' })
      const valid = await provider.validateCredentials(user, {})
      expect(valid).toBe(false)
    })
  })

  describe('remember token', () => {
    it('should update and retrieve by token', async () => {
      const user = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'pass' })
      await provider.updateRememberToken(user, 'my-token')

      const found = await provider.retrieveByToken(1, 'my-token')
      expect(found).not.toBeNull()
      expect(found?.getAuthId()).toBe(1)
    })

    it('should return null for wrong token', async () => {
      const user = await provider.createUser({ name: 'John', email: 'john@test.com', password: 'pass' })
      await provider.updateRememberToken(user, 'correct-token')

      const found = await provider.retrieveByToken(1, 'wrong-token')
      expect(found).toBeNull()
    })
  })

  describe('reset', () => {
    it('should clear all users', async () => {
      await provider.createUser({ name: 'A', email: 'a@test.com', password: 'pass' })
      provider.reset()
      expect(provider.getAll()).toHaveLength(0)
      expect(await provider.retrieveById(1)).toBeNull()
    })
  })
})

describe('InMemoryUser', () => {
  it('should implement Authenticatable interface', () => {
    const user = new InMemoryUser({
      id: 1,
      name: 'Test',
      email: 'test@test.com',
      passwordHash: '$2b$04$hash',
    })

    expect(user.getAuthId()).toBe(1)
    expect(user.getAuthIdField()).toBe('id')
    expect(user.getAuthPassword()).toBe('$2b$04$hash')
    expect(user.getRememberToken()).toBeNull()
  })

  it('should serialize to JSON without password', () => {
    const user = new InMemoryUser({
      id: 1,
      name: 'Test',
      email: 'test@test.com',
      passwordHash: '$2b$04$secret',
    })

    const json = user.toJSON()
    expect(json.id).toBe(1)
    expect(json.name).toBe('Test')
    expect(json.email).toBe('test@test.com')
    expect(json).not.toHaveProperty('passwordHash')
    expect(json).not.toHaveProperty('password')
  })
})
