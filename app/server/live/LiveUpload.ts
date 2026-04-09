// LiveUpload - Estado de upload chunked + sincronização UI

import { LiveComponent } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { UploadDemo as _Client } from '@client/src/live/UploadDemo'

export class LiveUpload extends LiveComponent<typeof LiveUpload.defaultState> {
  static componentName = 'LiveUpload'
  static publicActions = ['startUpload', 'updateProgress', 'completeUpload', 'failUpload', 'reset'] as const
  static defaultState = {
    status: 'idle' as 'idle' | 'uploading' | 'complete' | 'error',
    progress: 0,
    fileName: '',
    fileSize: 0,
    fileType: '',
    fileUrl: '',
    bytesUploaded: 0,
    totalBytes: 0,
    error: null as string | null
  }

  async startUpload(payload: { fileName: string; fileSize: number; fileType: string }) {
    const fileName = payload.fileName

    // Validate filename length
    if (!fileName || fileName.length > 255) {
      throw new Error('Invalid file name: must be 1-255 characters')
    }

    // Block path traversal, null bytes, and control characters
    if (/[\x00-\x1f]/.test(fileName) || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('Invalid file name: contains forbidden characters')
    }

    // Block Windows reserved names
    const baseName = fileName.split('.')[0].toUpperCase()
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1', 'LPT2', 'LPT3']
    if (reserved.includes(baseName)) {
      throw new Error('Invalid file name: reserved name')
    }

    // All file types allowed - no extension blocking
    // Security note: Configure allowed extensions per your application needs

    this.setState({
      status: 'uploading',
      progress: 0,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      fileUrl: '',
      bytesUploaded: 0,
      totalBytes: payload.fileSize,
      error: null
    })

    return { success: true }
  }

  async updateProgress(payload: { progress: number; bytesUploaded: number; totalBytes: number }) {
    const progress = Math.max(0, Math.min(100, payload.progress))
    this.setState({
      progress,
      bytesUploaded: payload.bytesUploaded,
      totalBytes: payload.totalBytes
    })

    return { success: true, progress }
  }

  async completeUpload(payload: { fileUrl: string }) {
    this.setState({
      status: 'complete',
      progress: 100,
      fileUrl: payload.fileUrl,
      error: null
    })

    return { success: true }
  }

  async failUpload(payload: { error: string }) {
    this.setState({
      status: 'error',
      error: payload.error || 'Upload failed'
    })

    return { success: true }
  }

  async reset() {
    this.setState({ ...LiveUpload.defaultState })
    return { success: true }
  }
}
