import { useEffect, useMemo, useState } from 'react'
import { useLiveChunkedUpload } from '@/core/client'
import type { LiveChunkedUploadOptions } from '@/core/client'
import type { FileUploadCompleteResponse } from '@core/types/types'
import { LiveUpload } from '@server/live/LiveUpload'
import { FaArrowUpFromBracket, FaFile, FaRotateRight, FaXmark } from 'react-icons/fa6'

// Derive the state type from the actual LiveUpload component to avoid duplication
type LiveUploadState = typeof LiveUpload.defaultState

// Minimal interface for any Live.use() proxy compatible with LiveUpload
interface LiveUploadProxy {
  $componentId: string | null
  $connected: boolean
  $state: LiveUploadState
  $error?: string | null
  startUpload: (payload: { fileName: string; fileSize: number; fileType: string }) => Promise<any>
  updateProgress: (payload: { progress: number; bytesUploaded: number; totalBytes: number }) => Promise<any>
  completeUpload: (payload: { fileUrl: string }) => Promise<any>
  failUpload: (payload: { error: string }) => Promise<any>
  reset: () => Promise<any>
}

export interface LiveUploadWidgetProps {
  live: LiveUploadProxy
  title?: string
  description?: string
  allowPreview?: boolean
  options?: LiveChunkedUploadOptions
  onComplete?: (response: FileUploadCompleteResponse) => void
}

export function LiveUploadWidget({
  live,
  title = 'Chunked upload',
  description = 'Upload over WebSocket with server-side progress and Live state updates.',
  allowPreview = true,
  options,
  onComplete
}: LiveUploadWidgetProps) {
  // live is expected to be a LiveUpload-compatible component
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const mergedOptions = useMemo<LiveChunkedUploadOptions>(() => {
    return {
      allowedTypes: [],
      maxFileSize: 500 * 1024 * 1024,
      adaptiveChunking: true,
      fileUrlResolver: (fileUrl) => fileUrl.startsWith('/uploads/') ? `/api${fileUrl}` : fileUrl,
      onComplete,
      ...options
    }
  }, [options, onComplete])

  const {
    uploading,
    bytesUploaded,
    totalBytes,
    uploadFile,
    cancelUpload,
    reset
  } = useLiveChunkedUpload(live, mergedOptions)

  const canUpload = live.$connected && !!live.$componentId && !uploading

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setLocalError(null)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    if (allowPreview && file && file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleStartUpload = async () => {
    if (!selectedFile) {
      setLocalError('Selecione um arquivo primeiro.')
      return
    }

    if (!live.$connected || !live.$componentId) {
      setLocalError('WebSocket ainda nao conectou. Tente novamente em alguns segundos.')
      return
    }

    setLocalError(null)
    await uploadFile(selectedFile)
  }

  const handleReset = async () => {
    setSelectedFile(null)
    setLocalError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    await reset()
  }

  const resolvedUrl = live.$state.fileUrl

  return (
    <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#07070b]/85 p-5 shadow-2xl shadow-black/20 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs ${
          live.$connected
            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
            : 'border-red-400/25 bg-red-400/10 text-red-200'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live.$connected ? 'bg-emerald-300' : 'bg-red-300'}`} />
          {live.$connected ? 'Connected' : 'Offline'}
        </span>
      </div>

      <div className="space-y-4">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.025] px-4 py-8 text-center transition hover:border-white/25 hover:bg-white/[0.045]">
          <FaFile className="mb-3 text-2xl text-theme" />
          <span className="text-sm font-medium text-white">
            {selectedFile ? selectedFile.name : 'Choose a file'}
          </span>
          <span className="mt-1 text-xs text-gray-500">
            {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : 'Up to 500 MB, adaptive chunks'}
          </span>
          <input
            type="file"
            onChange={handleSelectFile}
            className="sr-only"
            disabled={!live.$connected || uploading}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <button
            onClick={handleStartUpload}
            disabled={!canUpload || !selectedFile}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
          >
            <FaArrowUpFromBracket className="h-3.5 w-3.5" />
            Start upload
          </button>
          <button
            onClick={cancelUpload}
            disabled={!uploading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 disabled:opacity-50"
          >
            <FaXmark className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            onClick={handleReset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
          >
            <FaRotateRight className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

        {(localError || live.$state.error || live.$error) && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {localError || live.$state.error || live.$error}
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-black/40 p-4">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Status: {live.$state.status}</span>
            <span>{Math.round(live.$state.progress)}%</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-theme-gradient transition-all"
              style={{ width: `${live.$state.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{live.$state.fileName || 'Nenhum arquivo selecionado'}</span>
            <span>{bytesUploaded > 0 ? `${Math.round(bytesUploaded / 1024)} KB` : ''}{totalBytes > 0 ? ` / ${Math.round(totalBytes / 1024)} KB` : ''}</span>
          </div>
        </div>

        {previewUrl && (
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <div className="text-xs text-gray-400 mb-2">Preview</div>
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-48 w-full object-contain rounded-lg border border-white/10"
            />
          </div>
        )}

        {resolvedUrl && live.$state.status === 'complete' && (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            Upload complete: <a className="underline" href={resolvedUrl} target="_blank" rel="noopener noreferrer">open file</a>
          </div>
        )}
      </div>
    </div>
  )
}
