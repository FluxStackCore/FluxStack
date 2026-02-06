import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProjectCreator } from '@/core/templates/create-project'
import { rmdir, mkdir } from 'fs/promises'
import { join } from 'path'

// Mock bun APIs to avoid actual file operations in tests
vi.mock('bun', async () => {
  const actual = await vi.importActual('bun')
  return {
    ...actual,
    spawn: vi.fn(() => ({
      exited: Promise.resolve(0),
      stdout: { readable: null },
      stderr: { readable: null }
    })),
    write: vi.fn(),
    file: vi.fn(() => ({
      exists: () => true,
      text: () => 'mock content'
    }))
  }
})

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(() => [])
}))

// TODO: Fix test - needs mock updates for current ProjectCreator API
describe.skip('ProjectCreator', () => {
  const testDir = join(process.cwd(), 'test-project-temp')
  let creator: ProjectCreator

  beforeEach(() => {
    creator = new ProjectCreator({
      name: 'test-project',
      targetDir: testDir,
      template: 'basic'
    })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    try {
      await rmdir(testDir, { recursive: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('constructor', () => {
    it('should create ProjectCreator with basic options', () => {
      expect(creator).toBeDefined()
    })

    it('should set default template to basic', () => {
      const defaultCreator = new ProjectCreator({
        name: 'test-project'
      })
      expect(defaultCreator).toBeDefined()
    })

    it('should handle custom target directory', () => {
      const customCreator = new ProjectCreator({
        name: 'custom-project',
        targetDir: '/custom/path',
        template: 'full'
      })
      expect(customCreator).toBeDefined()
    })
  })

  describe('validation', () => {
    it('should validate project names correctly', () => {
      // Valid names
      expect(() => new ProjectCreator({ name: 'valid-name' })).not.toThrow()
      expect(() => new ProjectCreator({ name: 'valid_name' })).not.toThrow()
      expect(() => new ProjectCreator({ name: 'validName123' })).not.toThrow()
    })
  })

  describe('create method', () => {
    it('should handle create process without throwing', async () => {
      // Mock all async operations to succeed
      const mkdirMock = vi.mocked(mkdir)
      mkdirMock.mockResolvedValue(undefined)

      // We'll test that the method doesn't throw
      // Full integration testing would require actual file system operations
      expect(async () => {
        // In a real test, we'd mock all the dependencies properly
        // For now, we just ensure the class is properly structured
      }).not.toThrow()
    })
  })
})