// 📤 Live File Upload Component - Universal file upload with chunking
import { LiveComponent } from '@core/types/types'

interface FileUploadState {
  uploadedFiles: Array<{
    id: string
    filename: string
    url: string
    uploadedAt: number
  }>
  maxFiles: number
}

export class LiveFileUploadComponent extends LiveComponent<FileUploadState> {
  constructor(initialState: Partial<FileUploadState>, ws: any, options?: { room?: string; userId?: string }) {
    const defaults: FileUploadState = {
      uploadedFiles: [],
      maxFiles: 10,
    };
    super({ ...defaults, ...initialState }, ws, options)
  }

  /**
   * Handle successful file upload
   * This is called from the client after useChunkedUpload completes
   */
  async onFileUploaded(payload: { filename: string; fileUrl: string }): Promise<void> {
    const { filename, fileUrl } = payload

    // Add new file to the list
    const newFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filename,
      url: fileUrl,
      uploadedAt: Date.now()
    }

    // Limit to maxFiles
    const updatedFiles = [newFile, ...this.state.uploadedFiles].slice(0, this.state.maxFiles)

    // Update state and broadcast to all clients
    this.setState({
      uploadedFiles: updatedFiles
    })
  }

  /**
   * Remove an uploaded file
   */
  async removeFile(payload: { fileId: string }): Promise<void> {
    this.setState({
      uploadedFiles: this.state.uploadedFiles.filter(file => file.id !== payload.fileId)
    })
  }

  /**
   * Clear all uploaded files
   */
  async clearAll(): Promise<void> {
    this.setState({
      uploadedFiles: []
    })
  }

  /**
   * Get upload statistics
   */
  async getStats(): Promise<{
    totalFiles: number
    remainingSlots: number
  }> {
    return {
      totalFiles: this.state.uploadedFiles.length,
      remainingSlots: this.state.maxFiles - this.state.uploadedFiles.length
    }
  }
}
