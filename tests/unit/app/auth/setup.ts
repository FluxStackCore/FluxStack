/**
 * Test setup: Mock Bun APIs for Vitest (Node.js environment)
 *
 * Vitest roda em Node.js, então Bun.password e Bun.CryptoHasher
 * não estão disponíveis. Este mock implementa o necessário.
 */

import { createHash, randomBytes, pbkdf2Sync } from 'crypto'

// Store password→hash mapping for verify
const hashStore = new Map<string, string>()

const BunMock = {
  password: {
    async hash(password: string, options?: any): Promise<string> {
      const salt = randomBytes(16).toString('hex')
      const derived = pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex')

      let prefix: string
      if (options?.algorithm === 'argon2id') {
        prefix = `$argon2id$v=19$m=${options.memoryCost || 65536},t=${options.timeCost || 2},p=1`
      } else {
        const cost = options?.cost || 10
        prefix = `$2b$${String(cost).padStart(2, '0')}`
      }

      const hash = `${prefix}$${salt}$${derived}`
      hashStore.set(hash, password)
      return hash
    },

    async verify(password: string, hash: string): Promise<boolean> {
      // Check the stored mapping first
      if (hashStore.has(hash)) {
        return hashStore.get(hash) === password
      }

      // Fallback: extract salt and re-derive
      const parts = hash.split('$').filter(Boolean)
      // Format: prefix$cost$salt$derived or prefix$v=19$params$salt$derived
      let salt: string
      let derived: string

      if (hash.startsWith('$argon2id$')) {
        // $argon2id$v=19$m=...,t=...,p=...$salt$derived
        salt = parts[parts.length - 2]
        derived = parts[parts.length - 1]
      } else {
        // $2b$cost$salt$derived
        salt = parts[parts.length - 2]
        derived = parts[parts.length - 1]
      }

      const reHash = pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex')
      return reHash === derived
    },
  },

  CryptoHasher: class MockCryptoHasher {
    private hasher: ReturnType<typeof createHash>

    constructor(algorithm: string) {
      this.hasher = createHash(algorithm)
    }

    update(data: string): this {
      this.hasher.update(data)
      return this
    }

    digest(encoding: 'hex' | 'base64'): string {
      return this.hasher.digest(encoding)
    }
  },
}

// Set global Bun mock
;(globalThis as any).Bun = BunMock
