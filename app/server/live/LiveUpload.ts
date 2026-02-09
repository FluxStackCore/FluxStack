// LiveUpload - Chunked upload state + UI sync

import { LiveComponent } from '@core/types/types'

type LiveUploadState = {
  status: 'idle' | 'uploading' | 'complete' | 'error'
  progress: number
  fileName: string
  fileSize: number
  fileType: string
  fileUrl: string
  bytesUploaded: number
  totalBytes: number
  error: string | null
}

export const defaultState: LiveUploadState = {
  status: 'idle',
  progress: 0,
  fileName: '',
  fileSize: 0,
  fileType: '',
  fileUrl: '',
  bytesUploaded: 0,
  totalBytes: 0,
  error: null
}

export class LiveUpload extends LiveComponent<LiveUploadState> {
  static componentName = 'LiveUpload'
  static defaultState = defaultState

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
  }

  async startUpload(payload: { fileName: string; fileSize: number; fileType: string }) {
    const normalized = payload.fileName.toLowerCase()
    if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
      throw new Error('Invalid file name')
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
    this.setState({ ...defaultState })
    return { success: true }
  }
}
