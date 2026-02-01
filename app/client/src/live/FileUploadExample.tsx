// 📤 File Upload Example - Demonstrates chunked file upload with Live Components
import { useState, useRef } from 'react'
import { useTypedLiveComponent, useChunkedUpload, useLiveComponents } from '@/core/client'

// Import component type DIRECTLY from backend - full type inference!
import type { LiveFileUploadComponent } from '@/app/server/live/LiveFileUploadComponent'

export function FileUploadExample() {
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

  // Setup Chunked Upload Hook with Adaptive Chunking
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
    chunkSize: 64 * 1024, // 64KB initial chunk size
    maxFileSize: 500 * 1024 * 1024, // 500MB max (aceita qualquer arquivo)
    allowedTypes: [], // Aceita todos os tipos de arquivo
    sendMessageAndWait,

    // Enable Adaptive Chunking for optimal upload speed
    adaptiveChunking: true,
    adaptiveConfig: {
      minChunkSize: 16 * 1024,   // 16KB minimum
      maxChunkSize: 512 * 1024,  // 512KB maximum (safer for web)
      initialChunkSize: 64 * 1024, // 64KB start
      targetLatency: 200,        // Target 200ms per chunk
      adjustmentFactor: 1.5,     // Moderate adjustment
      measurementWindow: 3       // Measure last 3 chunks
    },

    onProgress: (progress, uploaded, total) => {
      console.log(`📤 Upload progress: ${progress.toFixed(1)}% (${uploaded}/${total} bytes)`)
    },

    onComplete: async (response) => {
      console.log('✅ Upload complete:', response)

      // Notify the Live Component about the successful upload
      if (selectedFile && response.fileUrl) {
        await call('onFileUploaded', {
          filename: selectedFile.name,
          fileUrl: response.fileUrl
        })
      }

      // Reset state
      setSelectedFile(null)
      resetUpload()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },

    onError: (error) => {
      console.error('❌ Upload error:', error)
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

  const handleRemoveFile = async (fileId: string) => {
    await call('removeFile', { fileId })
  }

  const handleClearAll = async () => {
    await call('clearAll', {})
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (filename: string): string => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    const iconMap: Record<string, string> = {
      '.pdf': '📄',
      '.doc': '📝',
      '.docx': '📝',
      '.xls': '📊',
      '.xlsx': '📊',
      '.ppt': '📽️',
      '.pptx': '📽️',
      '.zip': '🗜️',
      '.rar': '🗜️',
      '.7z': '🗜️',
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.png': '🖼️',
      '.gif': '🖼️',
      '.webp': '🖼️',
      '.mp4': '🎥',
      '.avi': '🎥',
      '.mov': '🎥',
      '.mp3': '🎵',
      '.wav': '🎵',
      '.jar': '☕',
      '.java': '☕',
      '.js': '📜',
      '.ts': '📜',
      '.json': '📋',
      '.xml': '📋',
      '.txt': '📃',
      '.md': '📰'
    }
    return iconMap[ext] || '📎'
  }

  const isImageFile = (filename: string): boolean => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)
  }

  if (!connected) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">🔌 Connecting to Live Components...</p>
      </div>
    )
  }

  const remainingSlots = state.maxFiles - state.uploadedFiles.length

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            📤 Universal File Upload
          </h2>
          <p className="mt-2 text-gray-600">
            Upload any type of file with real-time progress tracking and adaptive chunking
          </p>
        </div>

        {/* Upload Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="space-y-4">
            {/* File Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Any File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={uploading || remainingSlots === 0}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum file size: 500 MB • All file types supported
              </p>
            </div>

            {/* Selected File Info */}
            {selectedFile && !uploading && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Selected:</strong> {getFileIcon(selectedFile.name)} {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Uploading {selectedFile?.name}...</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}
                </p>
              </div>
            )}

            {/* Error Display */}
            {uploadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">❌ {uploadError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading || remainingSlots === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {uploading ? '⏳ Uploading...' : '📤 Upload'}
              </button>

              {uploading && (
                <button
                  onClick={cancelUpload}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                >
                  ❌ Cancel
                </button>
              )}

              {state.uploadedFiles.length > 0 && (
                <button
                  onClick={handleClearAll}
                  disabled={uploading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 font-medium ml-auto"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>

            {/* Slots Info */}
            <div className="text-sm text-gray-600">
              {remainingSlots > 0 ? (
                <span>✅ {remainingSlots} upload slot(s) remaining</span>
              ) : (
                <span className="text-red-600">⚠️ Maximum files reached</span>
              )}
            </div>
          </div>
        </div>

        {/* Uploaded Files Grid */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Uploaded Files ({state.uploadedFiles.length}/{state.maxFiles})
          </h3>

          {state.uploadedFiles.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No files uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* File Preview */}
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    {isImageFile(file.filename) ? (
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.parentElement!.innerHTML = `<div class="text-6xl">${getFileIcon(file.filename)}</div>`
                        }}
                      />
                    ) : (
                      <div className="text-6xl">{getFileIcon(file.filename)}</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(file.uploadedAt).toLocaleString()}
                    </p>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Download
                    </a>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveFile(file.id)}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                    title="Remove file"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Technical Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-2">📋 Technical Details</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✅ <strong>Adaptive Chunking:</strong> Enabled (16KB - 512KB)</li>
          <li>✅ <strong>Initial Chunk Size:</strong> 64KB</li>
          <li>✅ <strong>Max File Size:</strong> 500MB</li>
          <li>✅ <strong>Allowed Types:</strong> All file types supported</li>
          <li>✅ <strong>Real-time Progress:</strong> Shows bytes uploaded and percentage</li>
          <li>✅ <strong>State Sync:</strong> Uploaded files synced via Live Component</li>
          <li>✅ <strong>Component ID:</strong> {componentId || 'Not connected'}</li>
          <li>🚀 <strong>Optimization:</strong> Chunk size adjusts based on connection speed</li>
        </ul>
      </div>
    </div>
  )
}
