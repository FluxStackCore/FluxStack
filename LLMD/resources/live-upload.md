# Live Upload (Chunked Upload via WebSocket)

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Overview

FluxStack supports chunked file upload over the Live Components WebSocket. The
server tracks progress and assembles the file in `uploads/`. The client streams
chunks without loading the entire file into memory.

## Server: LiveUpload Component

```typescript
// app/server/live/LiveUpload.ts
import { LiveComponent } from '@core/types/types'
import { liveUploadDefaultState, type LiveUploadState } from '@app/shared'

export const defaultState: LiveUploadState = liveUploadDefaultState

export class LiveUpload extends LiveComponent<LiveUploadState> {
  static defaultState = defaultState

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
  }

  async startUpload(payload: { fileName: string; fileSize: number; fileType: string }) {
    const normalized = payload.fileName.toLowerCase()
    if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
      throw new Error('Invalid file name')
    }

    const ext = normalized.includes('.') ? normalized.split('.').pop() || '' : ''
    const blocked = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'jar']
    if (ext && blocked.includes(ext)) {
      throw new Error(`File extension not allowed: .${ext}`)
    }

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
```

## Client: useLiveUpload + Widget

```typescript
// app/client/src/live/UploadDemo.tsx
import { useLiveUpload } from './useLiveUpload'
import { LiveUploadWidget } from '../components/LiveUploadWidget'

export function UploadDemo() {
  const { live } = useLiveUpload()

  return (
    <LiveUploadWidget live={live} />
  )
}
```

## Chunked Upload Flow

1. Client calls `startUpload()` (Live Component action).
2. Client streams file chunks over WebSocket with `useChunkedUpload`.
3. Server assembles file in `uploads/` and returns `/uploads/...`.
4. Client maps to `/api/uploads/...` for access.

## Error Handling

- If an action throws, the error surfaces in `live.$error` on the client.
- The widget shows `localError || state.error || $error`.

## Files Involved

**Server**
- `app/server/live/LiveUpload.ts`
- `core/server/live/FileUploadManager.ts`
- `core/server/live/websocket-plugin.ts`

**Client**
- `core/client/hooks/useChunkedUpload.ts`
- `core/client/hooks/useLiveUpload.ts`
- `app/client/src/components/LiveUploadWidget.tsx`
