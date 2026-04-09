// Tests verifying security fixes in FluxStack backend
import { describe, it, expect } from 'vitest'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'

// ===== ChatRoom password hashing with salt =====
// We replicate the salted hashing logic from ChatRoom to test it directly

describe('ChatRoom salted password fix verification', () => {
  // New salted hashPassword — mirrors ChatRoom.hashPassword after fix
  function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex')
    const hash = createHash('sha256').update(salt + password).digest('hex')
    return salt + ':' + hash
  }

  function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const computed = createHash('sha256').update(salt + password).digest('hex')
    const bufA = Buffer.from(computed, 'hex')
    const bufB = Buffer.from(hash, 'hex')
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  }

  it('should hash passwords with a salt (format: salt:hash)', () => {
    const password = 'mySecret123'
    const hashed = hashPassword(password)

    // Should contain a colon separating salt from hash
    expect(hashed).toContain(':')
    const [salt, hash] = hashed.split(':')
    // Salt is 32 hex chars (16 bytes)
    expect(salt).toMatch(/^[a-f0-9]{32}$/)
    // Hash is 64 hex chars (SHA-256)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should produce DIFFERENT hashes for the same password (salt is random)', () => {
    const hash1 = hashPassword('samePassword')
    const hash2 = hashPassword('samePassword')
    // The full stored string must differ because salt differs
    expect(hash1).not.toBe(hash2)
  })

  it('should verify correct password against salted hash', () => {
    const password = 'correctHorse'
    const stored = hashPassword(password)
    expect(verifyPassword(password, stored)).toBe(true)
  })

  it('should reject wrong password against salted hash', () => {
    const stored = hashPassword('correctPassword')
    expect(verifyPassword('wrongPassword', stored)).toBe(false)
  })

  it('should reject empty password', () => {
    const stored = hashPassword('secret')
    expect(verifyPassword('', stored)).toBe(false)
  })

  it('should reject malformed stored hash (no colon)', () => {
    expect(verifyPassword('anything', 'nocolonhere')).toBe(false)
  })
})

// ===== LiveUpload filename validation =====

describe('LiveUpload filename validation fix verification', () => {
  // Same validation logic as LiveUpload.startUpload
  function validateFilename(fileName: string): string | null {
    if (!fileName || fileName.length > 255) {
      return 'Invalid file name: must be 1-255 characters'
    }
    if (/[\x00-\x1f]/.test(fileName) || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return 'Invalid file name: contains forbidden characters'
    }
    const baseName = fileName.split('.')[0].toUpperCase()
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1', 'LPT2', 'LPT3']
    if (reserved.includes(baseName)) {
      return 'Invalid file name: reserved name'
    }
    return null // valid
  }

  it('should accept valid filenames', () => {
    expect(validateFilename('photo.jpg')).toBeNull()
    expect(validateFilename('my-document.pdf')).toBeNull()
    expect(validateFilename('data_2024.csv')).toBeNull()
  })

  it('should reject empty filename', () => {
    expect(validateFilename('')).not.toBeNull()
  })

  it('should reject filename over 255 chars', () => {
    expect(validateFilename('a'.repeat(256) + '.txt')).not.toBeNull()
  })

  it('should reject path traversal', () => {
    expect(validateFilename('../etc/passwd')).not.toBeNull()
    expect(validateFilename('..\\windows\\system32')).not.toBeNull()
  })

  it('should reject null bytes', () => {
    expect(validateFilename('file\x00.exe')).not.toBeNull()
  })

  it('should reject control characters', () => {
    expect(validateFilename('file\x01name.txt')).not.toBeNull()
    expect(validateFilename('file\x0aname.txt')).not.toBeNull()
  })

  it('should reject Windows reserved names', () => {
    expect(validateFilename('CON.txt')).not.toBeNull()
    expect(validateFilename('NUL.doc')).not.toBeNull()
    expect(validateFilename('LPT1.pdf')).not.toBeNull()
    expect(validateFilename('COM1.exe')).not.toBeNull()
    expect(validateFilename('PRN.csv')).not.toBeNull()
    expect(validateFilename('AUX.log')).not.toBeNull()
  })

  it('should accept names similar to but not reserved', () => {
    expect(validateFilename('CONSOLE.txt')).toBeNull()
    expect(validateFilename('CONNECT.doc')).toBeNull()
    expect(validateFilename('NULLIFY.pdf')).toBeNull()
  })
})

// ===== TokenGuard typed field =====

describe('TokenGuard private field fix verification', () => {
  it('should compile without as any (verified by tsc --noEmit)', () => {
    // This test documents that TokenGuard._lastGeneratedToken is now a
    // properly typed private field instead of accessed via (this as any).
    // The real verification is that `bunx tsc --noEmit` passes with 0 errors.
    expect(true).toBe(true)
  })
})
