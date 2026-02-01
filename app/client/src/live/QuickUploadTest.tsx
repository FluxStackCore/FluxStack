// 🚀 Quick Upload Test - Compact upload tester for home page
import { useState, useRef } from 'react'
import { useTypedLiveComponent, useChunkedUpload, useLiveComponents } from '@/core/client'

// Import component type DIRECTLY from backend - full type inference!
import type { LiveFileUploadComponent } from '@/app/server/live/LiveFileUploadComponent'

export function QuickUploadTest() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Get sendMessageAndWait from LiveComponents context
  const { sendMessageAndWait } = useLiveComponents()

  // Setup Live Component with full type inference
  const {
    state,
    call,
    componentId,
    connected
  } = useTypedLiveComponent<LiveFileUploadComponent>('LiveFileUpload', {
    uploadedFiles: [],
    maxFiles: 10
  })

  // Setup Chunked Upload with Adaptive Chunking
  const {
    uploading,
    progress,
    error: uploadError,
    uploadFile,
    cancelUpload,
    reset: resetUpload,
    bytesUploaded,
    totalBytes
  } = useChunkedUpload(componentId || '', {
    chunkSize: 64 * 1024,
    maxFileSize: 500 * 1024 * 1024,
    allowedTypes: [], // Aceita todos os tipos
    sendMessageAndWait,

    // Enable Adaptive Chunking
    adaptiveChunking: true,
    adaptiveConfig: {
      minChunkSize: 16 * 1024,
      maxChunkSize: 512 * 1024,
      initialChunkSize: 64 * 1024,
      targetLatency: 200,
      adjustmentFactor: 1.5,
      measurementWindow: 3
    },

    onComplete: async (response) => {
      if (selectedFile && response.fileUrl) {
        await call('onFileUploaded', {
          filename: selectedFile.name,
          fileUrl: response.fileUrl
        })
      }
      setSelectedFile(null)
      resetUpload()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },

    onError: (error) => {
      console.error('Upload error:', error)
    }
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      resetUpload()
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    await uploadFile(selectedFile)
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (!connected) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="text-yellow-400 text-sm">🔌 Connecting...</div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">📤</div>
        <div>
          <h3 className="text-lg font-semibold text-white">Adaptive Upload Test</h3>
          <p className="text-xs text-gray-400">Dynamic chunk sizing enabled</p>
        </div>
      </div>

      {/* File Input */}
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          disabled={uploading}
          className="block w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 disabled:opacity-50 cursor-pointer"
        />

        {/* Selected File */}
        {selectedFile && !uploading && (
          <div className="text-sm text-gray-300">
            📁 {selectedFile.name} ({formatBytes(selectedFile.size)})
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-300">
              <span>Uploading...</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-400">
              {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}
            </div>
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <div className="text-xs text-red-400">❌ {uploadError}</div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all"
          >
            {uploading ? '⏳ Uploading...' : '🚀 Upload'}
          </button>

          {uploading && (
            <button
              onClick={cancelUpload}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
            >
              ❌
            </button>
          )}
        </div>

        {/* Last Upload Info */}
        {state.uploadedFiles.length > 0 && !uploading && (
          <div className="pt-3 border-t border-white/10">
            <div className="text-xs text-green-400">
              ✅ Last: {state.uploadedFiles[0].filename}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="pt-3 border-t border-white/10">
          <div className="text-xs text-gray-400 space-y-1">
            <div>🚀 Adaptive: 16KB - 512KB</div>
            <div>📊 Target: 200ms/chunk</div>
            <div>💾 Max: 500MB</div>
            <div>📁 All file types</div>
          </div>
        </div>
      </div>
    </div>
  )
}
