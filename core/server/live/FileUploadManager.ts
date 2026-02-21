import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname, basename } from 'path'
import type {
  ActiveUpload,
  FileUploadStartMessage,
  FileUploadChunkMessage,
  FileUploadCompleteMessage,
  FileUploadProgressResponse,
  FileUploadCompleteResponse
} from '@core/types/types'

export class FileUploadManager {
  private activeUploads = new Map<string, ActiveUpload>()
  private readonly maxUploadSize = 50 * 1024 * 1024 // 🔒 50MB max (reduced from 500MB)
  private readonly chunkTimeout = 30000 // 30 seconds timeout per chunk
  // 🔒 Default allowed MIME types - safe file types only
  private readonly allowedTypes: string[] = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/csv', 'text/markdown',
    'application/json',
    'application/zip', 'application/gzip',
  ]
  // 🔒 Blocked file extensions that could be dangerous
  private readonly blockedExtensions: Set<string> = new Set([
    '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
    '.sh', '.bash', '.zsh', '.csh',
    '.ps1', '.psm1', '.psd1',
    '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
    '.dll', '.sys', '.drv', '.so', '.dylib',
  ])

  constructor() {
    // Cleanup stale uploads every 5 minutes
    setInterval(() => this.cleanupStaleUploads(), 5 * 60 * 1000)
  }

  async startUpload(message: FileUploadStartMessage): Promise<{ success: boolean; error?: string }> {
    try {
      const { uploadId, componentId, filename, fileType, fileSize, chunkSize = 64 * 1024 } = message

      // 🔒 Validate file size
      if (fileSize > this.maxUploadSize) {
        throw new Error(`File too large: ${fileSize} bytes. Max: ${this.maxUploadSize} bytes`)
      }

      // 🔒 Validate MIME type against allowlist
      if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(fileType)) {
        throw new Error(`File type not allowed: ${fileType}`)
      }

      // 🔒 Validate filename - sanitize and check extension
      const safeBase = basename(filename) // Strip any path traversal
      const ext = extname(safeBase).toLowerCase()
      if (this.blockedExtensions.has(ext)) {
        throw new Error(`File extension not allowed: ${ext}`)
      }

      // 🔒 Validate filename length
      if (safeBase.length > 255) {
        throw new Error('Filename too long')
      }

      // Check if upload already exists
      if (this.activeUploads.has(uploadId)) {
        throw new Error(`Upload ${uploadId} already in progress`)
      }

      // Calculate total chunks
      const totalChunks = Math.ceil(fileSize / chunkSize)

      // Create upload record
      const upload: ActiveUpload = {
        uploadId,
        componentId,
        filename,
        fileType,
        fileSize,
        totalChunks,
        receivedChunks: new Map(),
        bytesReceived: 0, // Track actual bytes for adaptive chunking
        startTime: Date.now(),
        lastChunkTime: Date.now()
      }

      this.activeUploads.set(uploadId, upload)

      console.log('📤 Upload started:', {
        uploadId,
        componentId,
        filename,
        fileType,
        fileSize,
        totalChunks
      })

      return { success: true }

    } catch (error: any) {
      console.error('❌ Upload start failed:', error.message)
      return { success: false, error: error.message }
    }
  }

  async receiveChunk(message: FileUploadChunkMessage, ws: any, binaryData: Buffer | null = null): Promise<FileUploadProgressResponse | null> {
    try {
      const { uploadId, chunkIndex, totalChunks, data } = message

      const upload = this.activeUploads.get(uploadId)
      if (!upload) {
        throw new Error(`Upload ${uploadId} not found`)
      }

      // Validate chunk index
      if (chunkIndex < 0 || chunkIndex >= totalChunks) {
        throw new Error(`Invalid chunk index: ${chunkIndex}`)
      }

      // Check if chunk already received
      if (upload.receivedChunks.has(chunkIndex)) {
        console.log(`📦 Chunk ${chunkIndex} already received for upload ${uploadId}`)
      } else {
        // Store chunk data - use binary data if available, otherwise use base64 string
        let chunkBytes: number

        if (binaryData) {
          // Binary protocol: store Buffer directly (more efficient)
          upload.receivedChunks.set(chunkIndex, binaryData)
          chunkBytes = binaryData.length
        } else {
          // JSON protocol: store base64 string (legacy support)
          upload.receivedChunks.set(chunkIndex, data as string)
          chunkBytes = Buffer.from(data as string, 'base64').length
        }

        upload.lastChunkTime = Date.now()
        upload.bytesReceived += chunkBytes

        console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId} (${chunkBytes} bytes, total: ${upload.bytesReceived}/${upload.fileSize})${binaryData ? ' [binary]' : ' [base64]'}`)
      }

      // Calculate progress based on actual bytes received (supports adaptive chunking)
      const progress = (upload.bytesReceived / upload.fileSize) * 100
      const bytesUploaded = upload.bytesReceived

      // Log completion status (but don't finalize until COMPLETE message)
      if (upload.bytesReceived >= upload.fileSize) {
        console.log(`✅ All bytes received for upload ${uploadId} (${upload.bytesReceived}/${upload.fileSize}), waiting for COMPLETE message`)
      }

      return {
        type: 'FILE_UPLOAD_PROGRESS',
        componentId: upload.componentId,
        uploadId: upload.uploadId,
        chunkIndex,
        totalChunks,
        bytesUploaded: Math.min(bytesUploaded, upload.fileSize),
        totalBytes: upload.fileSize,
        progress: Math.min(progress, 100),
        timestamp: Date.now()
      }

    } catch (error: any) {
      console.error(`❌ Chunk receive failed for upload ${message.uploadId}:`, error.message)
      throw error
    }
  }

  private async finalizeUpload(upload: ActiveUpload): Promise<void> {
    try {
      console.log(`✅ Upload completed: ${upload.uploadId}`)
      
      // Assemble file from chunks
      const fileUrl = await this.assembleFile(upload)
      
      // Cleanup
      this.activeUploads.delete(upload.uploadId)
      
    } catch (error: any) {
      console.error(`❌ Upload finalization failed for ${upload.uploadId}:`, error.message)
      throw error
    }
  }

  async completeUpload(message: FileUploadCompleteMessage): Promise<FileUploadCompleteResponse> {
    try {
      const { uploadId } = message

      const upload = this.activeUploads.get(uploadId)
      if (!upload) {
        throw new Error(`Upload ${uploadId} not found`)
      }

      console.log(`✅ Upload completion requested: ${uploadId}`)

      // Validate bytes received (supports adaptive chunking)
      if (upload.bytesReceived !== upload.fileSize) {
        const bytesShort = upload.fileSize - upload.bytesReceived
        throw new Error(`Incomplete upload: received ${upload.bytesReceived}/${upload.fileSize} bytes (${bytesShort} bytes short)`)
      }

      console.log(`✅ Upload validation passed: ${uploadId} (${upload.bytesReceived} bytes)`)


      // Assemble file from chunks
      const fileUrl = await this.assembleFile(upload)

      // Cleanup
      this.activeUploads.delete(uploadId)

      return {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: upload.componentId,
        uploadId: upload.uploadId,
        success: true,
        filename: upload.filename,
        fileUrl,
        timestamp: Date.now()
      }

    } catch (error: any) {
      console.error(`❌ Upload completion failed for ${message.uploadId}:`, error.message)
      
      return {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: '',
        uploadId: message.uploadId,
        success: false,
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  private async assembleFile(upload: ActiveUpload): Promise<string> {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = './uploads'
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // 🔒 Generate secure unique filename using UUID (prevents path traversal and name collisions)
      const extension = extname(basename(upload.filename)).toLowerCase()
      const safeFilename = `${crypto.randomUUID()}${extension}`
      const filePath = join(uploadsDir, safeFilename)

      // Assemble chunks in order
      const chunks: Buffer[] = []
      for (let i = 0; i < upload.totalChunks; i++) {
        const chunkData = upload.receivedChunks.get(i)
        if (chunkData) {
          // Handle both Buffer (binary protocol) and string (base64 JSON protocol)
          if (Buffer.isBuffer(chunkData)) {
            chunks.push(chunkData)
          } else {
            chunks.push(Buffer.from(chunkData, 'base64'))
          }
        }
      }

      // Write assembled file
      const fileBuffer = Buffer.concat(chunks)
      await writeFile(filePath, fileBuffer)

      console.log(`📁 File assembled: ${filePath}`)
      return `/uploads/${safeFilename}`

    } catch (error) {
      console.error('❌ File assembly failed:', error)
      throw error
    }
  }

  private cleanupStaleUploads(): void {
    const now = Date.now()
    const staleUploads: string[] = []

    for (const [uploadId, upload] of this.activeUploads) {
      const timeSinceLastChunk = now - upload.lastChunkTime
      
      if (timeSinceLastChunk > this.chunkTimeout * 2) {
        staleUploads.push(uploadId)
      }
    }

    for (const uploadId of staleUploads) {
      this.activeUploads.delete(uploadId)
      console.log(`🧹 Cleaned up stale upload: ${uploadId}`)
    }

    if (staleUploads.length > 0) {
      console.log(`🧹 Cleaned up ${staleUploads.length} stale uploads`)
    }
  }

  getUploadStatus(uploadId: string): ActiveUpload | null {
    return this.activeUploads.get(uploadId) || null
  }

  getStats() {
    return {
      activeUploads: this.activeUploads.size,
      maxUploadSize: this.maxUploadSize,
      allowedTypes: this.allowedTypes
    }
  }
}

// Global instance
export const fileUploadManager = new FileUploadManager()
