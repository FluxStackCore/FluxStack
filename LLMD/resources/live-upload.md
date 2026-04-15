# Live Upload (Chunked Upload via WebSocket)

**Version:** @fluxstack/live 0.7.2 | **Updated:** 2026-04-14

## Overview

FluxStack supports chunked file upload over the Live Components WebSocket. The
server tracks progress and assembles the file in `uploads/`. The client streams
chunks without loading the entire file into memory.

## Security Features

### Implemented in LiveUpload.ts (app example)

The `LiveUpload` component in `app/server/live/LiveUpload.ts` implements these validations directly:

- **Filename length validation** - Must be 1-255 characters
- **Path traversal prevention** - Blocks `..`, `/`, `\` in filenames
- **Control character blocking** - Rejects null bytes and control chars (`\x00-\x1f`)
- **Windows reserved name blocking** - Rejects CON, PRN, AUX, NUL, COM1-4, LPT1-3
- **No extension blocking** - The app example does NOT block file extensions by default (comment says "configure per your application needs")

### Available in @fluxstack/live framework (FileUploadManager)

The `FileUploadManager` in `@fluxstack/live` core provides additional security features that applications can leverage. These are **available in the framework** but are handled at the framework transport layer, not in the `LiveUpload` component itself:

- **MIME type allowlist** - Configurable list of safe file types (default: images, PDF, text, JSON, archives)
- **Extension blocklist** - 31 dangerous extensions blocked (.exe, .bat, .sh, .dll, .ps1, .vbs, etc.)
- **Double extension prevention** - Detects `malware.exe.jpg` style attacks
- **Magic bytes validation** - Verifies actual file content matches claimed MIME type on completion
- **Per-user upload quota** - Configurable daily limit per user (default: 500MB/day)
- **File size limit** - Configurable max per file (default: 50MB)
- **Filename sanitization** - Path traversal prevention via `path.basename()`
- **Stale upload cleanup** - Abandoned uploads removed automatically (chunk timeout x2)
- **Custom file assembly** - Pluggable `assembleFile` handler for custom storage backends

### FileUploadManager Configuration

```typescript
// Configuration options available in @fluxstack/live
interface FileUploadConfig {
  maxUploadSize?: number        // Default: 50MB
  chunkTimeout?: number         // Default: 30s
  maxBytesPerUser?: number      // Default: 500MB/day
  quotaResetInterval?: number   // Default: 24h
  allowedTypes?: string[]       // Default: images, PDF, text, JSON, archives
  blockedExtensions?: string[]  // Default: 31 dangerous extensions
  uploadsDir?: string           // Default: './uploads'
  assembleFile?: (upload: ActiveUpload) => Promise<string>  // Custom handler
}
```

## Server: LiveUpload Component

```typescript
// app/server/live/LiveUpload.ts
import { LiveComponent } from '@core/types/types'

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

    // All file types allowed - no extension blocking in this example
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

1. Client calls `startUpload()` (Live Component action) -- validates filename.
2. Client streams file chunks over WebSocket with `useChunkedUpload`.
3. Server (`FileUploadManager`) receives chunks and validates size/count.
4. On completion, `FileUploadManager` validates **magic bytes** against claimed MIME type.
5. Server assembles file in `uploads/` with UUID filename and returns `/uploads/...`.
6. Client maps to `/api/uploads/...` for access.

## Magic Bytes Validation (framework level)

The `FileUploadManager` in `@fluxstack/live` validates actual file content against known magic byte signatures before assembling. This happens at the framework transport layer, not in the `LiveUpload` component:

| MIME Type | Magic Bytes |
|-----------|-------------|
| `image/jpeg` | `FF D8 FF` |
| `image/png` | `89 50 4E 47 0D 0A 1A 0A` |
| `image/gif` | `47 49 46 38 37 61` or `47 49 46 38 39 61` |
| `image/webp` | `52 49 46 46` (RIFF header) |
| `application/pdf` | `25 50 44 46` (%PDF) |
| `application/zip` | `50 4B 03 04` or `50 4B 05 06` |
| `application/gzip` | `1F 8B` |

Text-based types (text/plain, text/csv, application/json, image/svg+xml) skip binary validation.

## Per-User Upload Quotas (framework level)

Each authenticated user has a daily upload quota (default: 500MB/day), managed by `FileUploadManager`:

- Quota is checked before upload starts
- Quota is reserved when upload begins (even if upload doesn't complete)
- Quotas reset daily (configurable interval)
- Anonymous uploads (no userId) bypass quota checks

```typescript
// Check user's remaining quota (framework API)
const usage = fileUploadManager.getUserUploadUsage(userId)
// { used: 104857600, limit: 524288000, remaining: 419430400 }
```

> **Note:** Quota enforcement happens in `FileUploadManager.startUpload()`, which is called by the framework's WebSocket plugin before reaching the `LiveUpload` component.

## Error Handling

- If an action throws, the error surfaces in `live.$error` on the client.
- The widget shows `localError || state.error || $error`.
- Magic bytes validation failure: `"File content does not match claimed type 'image/jpeg'"`
- Quota exceeded: `"Upload quota exceeded for user"`
- Double extension: `"Suspicious double extension detected: .exe in malware.exe.jpg"`
- Path traversal: `"Invalid file name: contains forbidden characters"`
- Reserved name: `"Invalid file name: reserved name"`

## Files Involved

**Server**
- `app/server/live/LiveUpload.ts` -- Component with state tracking and filename validation
- `core/server/live/FileUploadManager.ts` (from `@fluxstack/live`) -- chunk handling, magic bytes, quotas, extension blocking, file assembly
- `core/server/live/websocket-plugin.ts` -- upload message routing, userId passthrough

**Client**
- `core/client/hooks/useChunkedUpload.ts` -- streaming chunks over WebSocket
- `core/client/hooks/useLiveUpload.ts` -- Live Component wrapper hook
- `app/client/src/components/LiveUploadWidget.tsx` -- UI widget
