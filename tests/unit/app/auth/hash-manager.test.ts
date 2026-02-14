import './setup'
import { describe, it, expect, beforeEach } from 'vitest'
import { HashManager } from '@app/server/auth/HashManager'

describe('HashManager', () => {
  describe('bcrypt (default)', () => {
    let hash: HashManager

    beforeEach(() => {
      hash = new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 }) // Low rounds for speed
    })

    it('should hash a password', async () => {
      const hashed = await hash.make('password123')
      expect(hashed).toBeDefined()
      expect(hashed).not.toBe('password123')
      expect(hashed.startsWith('$2')).toBe(true) // bcrypt prefix
    })

    it('should verify a correct password', async () => {
      const hashed = await hash.make('password123')
      const valid = await hash.check('password123', hashed)
      expect(valid).toBe(true)
    })

    it('should reject an incorrect password', async () => {
      const hashed = await hash.make('password123')
      const valid = await hash.check('wrong-password', hashed)
      expect(valid).toBe(false)
    })

    it('should generate different hashes for the same password', async () => {
      const hash1 = await hash.make('password123')
      const hash2 = await hash.make('password123')
      expect(hash1).not.toBe(hash2) // Different salts
    })

    it('should not need rehash for matching algorithm and rounds', async () => {
      const hashed = await hash.make('password123')
      expect(hash.needsRehash(hashed)).toBe(false)
    })

    it('should need rehash when rounds differ', async () => {
      const lowRounds = new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 })
      const highRounds = new HashManager({ algorithm: 'bcrypt', bcryptRounds: 12 })

      const hashed = await lowRounds.make('password123')
      expect(highRounds.needsRehash(hashed)).toBe(true)
    })

    it('should need rehash when switching from bcrypt to argon2', async () => {
      const argonHash = new HashManager({ algorithm: 'argon2id' })
      const hashed = await hash.make('password123') // bcrypt hash
      expect(argonHash.needsRehash(hashed)).toBe(true) // argon2 manager says: rehash
    })
  })

  describe('argon2id', () => {
    let hash: HashManager

    beforeEach(() => {
      hash = new HashManager({
        algorithm: 'argon2id',
        argon2MemoryCost: 1024, // Low for speed in tests
        argon2TimeCost: 1,
      })
    })

    it('should hash a password with argon2id', async () => {
      const hashed = await hash.make('password123')
      expect(hashed).toBeDefined()
      expect(hashed.startsWith('$argon2id$')).toBe(true)
    })

    it('should verify a correct password', async () => {
      const hashed = await hash.make('password123')
      const valid = await hash.check('password123', hashed)
      expect(valid).toBe(true)
    })

    it('should reject an incorrect password', async () => {
      const hashed = await hash.make('password123')
      const valid = await hash.check('wrong', hashed)
      expect(valid).toBe(false)
    })

    it('should not need rehash for argon2id hash', async () => {
      const hashed = await hash.make('password123')
      expect(hash.needsRehash(hashed)).toBe(false)
    })
  })

  describe('cross-algorithm verification', () => {
    it('should verify bcrypt hash with check regardless of current algorithm', async () => {
      const bcrypt = new HashManager({ algorithm: 'bcrypt', bcryptRounds: 4 })
      const argon = new HashManager({ algorithm: 'argon2id', argon2MemoryCost: 1024, argon2TimeCost: 1 })

      const hashed = await bcrypt.make('password123')
      // Bun.password.verify auto-detects algorithm
      const valid = await argon.check('password123', hashed)
      expect(valid).toBe(true)
    })
  })
})
