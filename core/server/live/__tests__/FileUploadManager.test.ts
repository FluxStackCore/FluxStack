// 🧪 FileUploadManager Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FileUploadManager } from '../FileUploadManager'
import type { FileUploadStartMessage, FileUploadChunkMessage, FileUploadCompleteMessage } from '@core/plugins/types'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn()
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  createWriteStream: vi.fn(() => ({
    write: vi.fn(),
    end: vi.fn()
  }))
}))

describe('FileUploadManager', () => {
  let uploadManager: FileUploadManager
  let mockWs: any

  beforeEach(() => {
    uploadManager = new FileUploadManager()
    mockWs = {
      send: vi.fn(),
      data: { connectionId: 'test-connection' }
    }
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup any active uploads
    // Note: Timers are automatically cleaned up by vitest
  })

  describe('Upload Initialization', () => {
    it('should start upload successfully', async () => {
      const message: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId: 'upload-123',
        filename: 'test.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024 * 1024, // 1MB
        chunkSize: 64 * 1024 // 64KB
      }

      const result = await uploadManager.startUpload(message)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid file type', async () => {
      const message: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId: 'upload-123',
        filename: 'test.exe',
        fileType: 'application/exe',
        fileSize: 1024,
        chunkSize: 64 * 1024
      }

      const result = await uploadManager.startUpload(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid file type')
    })

    it('should reject file too large', async () => {
      const message: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId: 'upload-123',
        filename: 'huge.jpg',
        fileType: 'image/jpeg',
        fileSize: 100 * 1024 * 1024, // 100MB (over 50MB limit)
        chunkSize: 64 * 1024
      }

      const result = await uploadManager.startUpload(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain('File too large')
    })

    it('should reject duplicate upload ID', async () => {
      const message: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId: 'upload-123',
        filename: 'test.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        chunkSize: 64 * 1024
      }

      // Start first upload
      await uploadManager.startUpload(message)

      // Try to start same upload again
      const result = await uploadManager.startUpload(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain('already in progress')
    })
  })

  describe('Chunk Reception', () => {
    let uploadId: string

    beforeEach(async () => {
      uploadId = 'upload-123'
      const startMessage: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId,
        filename: 'test.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        chunkSize: 512
      }
      
      await uploadManager.startUpload(startMessage)
    })

    it('should receive chunk successfully', async () => {
      const chunkMessage: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 0,
        totalChunks: 2,
        data: Buffer.from('test data').toString('base64')
      }

      const result = await uploadManager.receiveChunk(chunkMessage, mockWs)

      expect(result).toBeTruthy()
      expect(result?.type).toBe('FILE_UPLOAD_PROGRESS')
      expect(result?.chunkIndex).toBe(0)
      expect(result?.progress).toBeGreaterThan(0)
    })

    it('should reject invalid chunk index', async () => {
      const chunkMessage: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 10, // Invalid index
        totalChunks: 2,
        data: Buffer.from('test data').toString('base64')
      }

      await expect(uploadManager.receiveChunk(chunkMessage, mockWs))
        .rejects.toThrow('Invalid chunk index')
    })

    it('should handle duplicate chunks', async () => {
      const chunkMessage: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 0,
        totalChunks: 2,
        data: Buffer.from('test data').toString('base64')
      }

      // Send chunk twice
      await uploadManager.receiveChunk(chunkMessage, mockWs)
      const result = await uploadManager.receiveChunk(chunkMessage, mockWs)

      expect(result).toBeTruthy()
      // Should handle gracefully without error
    })

    it('should calculate progress correctly', async () => {
      const chunk1: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 0,
        totalChunks: 2,
        data: Buffer.from('chunk1').toString('base64')
      }

      const result = await uploadManager.receiveChunk(chunk1, mockWs)

      expect(result?.progress).toBe(50) // 1 of 2 chunks = 50%
    })

    it('should reject chunk for non-existent upload', async () => {
      const chunkMessage: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId: 'non-existent',
        chunkIndex: 0,
        totalChunks: 2,
        data: Buffer.from('test data').toString('base64')
      }

      await expect(uploadManager.receiveChunk(chunkMessage, mockWs))
        .rejects.toThrow('Upload non-existent not found')
    })
  })

  describe('Upload Completion', () => {
    let uploadId: string

    beforeEach(async () => {
      uploadId = 'upload-123'
      const startMessage: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId,
        filename: 'test.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        chunkSize: 512
      }
      
      await uploadManager.startUpload(startMessage)

      // Send all chunks
      const chunk1: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 0,
        totalChunks: 2,
        data: Buffer.from('chunk1').toString('base64')
      }

      const chunk2: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 1,
        totalChunks: 2,
        data: Buffer.from('chunk2').toString('base64')
      }

      await uploadManager.receiveChunk(chunk1, mockWs)
      await uploadManager.receiveChunk(chunk2, mockWs)
    })

    it('should complete upload successfully', async () => {
      const completeMessage: FileUploadCompleteMessage = {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: 'test-component',
        uploadId
      }

      const result = await uploadManager.completeUpload(completeMessage)

      expect(result.success).toBe(true)
      expect(result.filename).toBeTruthy()
      expect(result.fileUrl).toBeTruthy()
    })

    it('should handle missing chunks', async () => {
      // Create new upload with missing chunk
      const newUploadId = 'incomplete-upload'
      const startMessage: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId: newUploadId,
        filename: 'incomplete.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        chunkSize: 512
      }
      
      await uploadManager.startUpload(startMessage)

      // Only send first chunk, not second
      const chunk1: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId: newUploadId,
        chunkIndex: 0,
        totalChunks: 2,
        data: Buffer.from('chunk1').toString('base64')
      }

      await uploadManager.receiveChunk(chunk1, mockWs)

      const completeMessage: FileUploadCompleteMessage = {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: 'test-component',
        uploadId: newUploadId
      }

      const result = await uploadManager.completeUpload(completeMessage)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing chunks')
    })

    it('should handle non-existent upload completion', async () => {
      const completeMessage: FileUploadCompleteMessage = {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: 'test-component',
        uploadId: 'non-existent'
      }

      const result = await uploadManager.completeUpload(completeMessage)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('Upload Status and Statistics', () => {
    it('should return upload status', async () => {
      const uploadId = 'status-test'
      const startMessage: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId,
        filename: 'status.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        chunkSize: 512
      }
      
      await uploadManager.startUpload(startMessage)

      const status = uploadManager.getUploadStatus(uploadId)
      expect(status).toBeTruthy()
      expect(status?.uploadId).toBe(uploadId)
      expect(status?.filename).toBe('status.jpg')
    })

    it('should return null for non-existent upload', () => {
      const status = uploadManager.getUploadStatus('non-existent')
      expect(status).toBeNull()
    })

    it('should provide upload statistics', () => {
      const stats = uploadManager.getStats()
      
      expect(stats).toHaveProperty('activeUploads')
      expect(stats).toHaveProperty('maxUploadSize')
      expect(stats).toHaveProperty('allowedTypes')
      expect(typeof stats.activeUploads).toBe('number')
      expect(Array.isArray(stats.allowedTypes)).toBe(true)
    })
  })

  describe('Cleanup and Maintenance', () => {
    it('should track active uploads', async () => {
      const uploadId = 'tracked-upload'
      const startMessage: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId,
        filename: 'tracked.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        chunkSize: 512
      }

      await uploadManager.startUpload(startMessage)

      const status = uploadManager.getUploadStatus(uploadId)
      expect(status).toBeTruthy()
      expect(status?.uploadId).toBe(uploadId)

      const stats = uploadManager.getStats()
      expect(stats.activeUploads).toBeGreaterThan(0)
    })

    it('should handle upload cleanup after completion', async () => {
      const uploadId = 'cleanup-upload'
      const startMessage: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId,
        filename: 'cleanup.jpg',
        fileType: 'image/jpeg',
        fileSize: 512,
        chunkSize: 512
      }

      await uploadManager.startUpload(startMessage)

      // Upload exists before completion
      expect(uploadManager.getUploadStatus(uploadId)).toBeTruthy()

      // Send chunk
      const chunk: FileUploadChunkMessage = {
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 0,
        totalChunks: 1,
        data: Buffer.from('test').toString('base64')
      }

      await uploadManager.receiveChunk(chunk, mockWs)

      // Complete upload
      const completeMessage: FileUploadCompleteMessage = {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: 'test-component',
        uploadId
      }

      await uploadManager.completeUpload(completeMessage)

      // Upload should be cleaned up after completion
      expect(uploadManager.getUploadStatus(uploadId)).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very small files', async () => {
      const message: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId: 'small-file',
        filename: 'small.jpg',
        fileType: 'image/jpeg',
        fileSize: 10,
        chunkSize: 1024
      }

      const result = await uploadManager.startUpload(message)

      expect(result.success).toBe(true)

      const status = uploadManager.getUploadStatus('small-file')
      expect(status?.totalChunks).toBe(1) // File smaller than chunk size = 1 chunk
    })

    it('should handle very small chunk sizes', async () => {
      const message: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId: 'small-chunks',
        filename: 'test.jpg',
        fileType: 'image/jpeg',
        fileSize: 100,
        chunkSize: 10 // Very small chunks
      }

      const result = await uploadManager.startUpload(message)

      expect(result.success).toBe(true)
      
      const status = uploadManager.getUploadStatus('small-chunks')
      expect(status?.totalChunks).toBe(10) // 100 bytes / 10 bytes per chunk
    })

    it('should handle concurrent uploads', async () => {
      const uploads = []
      
      for (let i = 0; i < 5; i++) {
        const message: FileUploadStartMessage = {
          type: 'FILE_UPLOAD_START',
          componentId: 'test-component',
          uploadId: `concurrent-${i}`,
          filename: `file-${i}.jpg`,
          fileType: 'image/jpeg',
          fileSize: 1024,
          chunkSize: 512
        }
        
        uploads.push(uploadManager.startUpload(message))
      }

      const results = await Promise.all(uploads)
      
      // All uploads should succeed
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      const stats = uploadManager.getStats()
      expect(stats.activeUploads).toBe(5)
    })
  })
})