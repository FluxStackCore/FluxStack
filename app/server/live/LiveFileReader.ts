// LiveFileReader - Demonstrates server-side code with Node.js-only imports
// This component reads files from the filesystem on the server side.
// When imported by a client component, the `fs` import should NOT leak
// into the client bundle.

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface FileInfo {
  name: string
  content: string
  size: number
  exists: boolean
}

export class LiveFileReader extends LiveComponent<typeof LiveFileReader.defaultState> {
  static componentName = 'LiveFileReader'
  static publicActions = ['readFile', 'checkFile'] as const
  static defaultState = {
    currentFile: null as FileInfo | null,
    lastError: null as string | null,
    filesRead: 0
  }

  async readFile(payload: { filePath: string }) {
    try {
      const fullPath = join(process.cwd(), payload.filePath)

      if (!existsSync(fullPath)) {
        this.setState({
          lastError: `File not found: ${payload.filePath}`,
          currentFile: null
        })
        return { success: false, error: 'File not found' }
      }

      const content = readFileSync(fullPath, 'utf-8')

      this.setState({
        currentFile: {
          name: payload.filePath,
          content: content.slice(0, 1000), // Limit content size
          size: content.length,
          exists: true
        },
        lastError: null,
        filesRead: this.state.filesRead + 1
      })

      return { success: true, fileName: payload.filePath, size: content.length }
    } catch (error: any) {
      this.setState({
        lastError: error.message,
        currentFile: null
      })
      return { success: false, error: error.message }
    }
  }

  async checkFile(payload: { filePath: string }) {
    const fullPath = join(process.cwd(), payload.filePath)
    const exists = existsSync(fullPath)

    return { exists, filePath: payload.filePath }
  }
}
