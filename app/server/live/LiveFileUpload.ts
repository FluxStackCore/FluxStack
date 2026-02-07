// 📤 LiveFileUpload - Upload de arquivos com chunks
// ZERO interfaces! TypeScript infere tudo automaticamente.
import { LiveComponent } from '@core/types/types'

export const defaultState = {
  uploadedFiles: [] as Array<{
    id: string
    filename: string
    url: string
    uploadedAt: number
  }>,
  maxFiles: 10
}

export class LiveFileUpload extends LiveComponent<typeof defaultState> {
  static defaultState = defaultState
  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
    console.log(`📤 LiveFileUpload created: ${this.id}`)
  }

  async onFileUploaded(payload: { filename: string; fileUrl: string }) {
    const newFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      filename: payload.filename,
      url: payload.fileUrl,
      uploadedAt: Date.now()
    }

    this.setState({
      uploadedFiles: [newFile, ...this.state.uploadedFiles].slice(0, this.state.maxFiles)
    })

    return { success: true, file: newFile }
  }

  async removeFile(payload: { fileId: string }) {
    this.setState({
      uploadedFiles: this.state.uploadedFiles.filter(f => f.id !== payload.fileId)
    })
    return { success: true }
  }

  async clearAll() {
    this.setState({ uploadedFiles: [] })
    return { success: true }
  }
}
