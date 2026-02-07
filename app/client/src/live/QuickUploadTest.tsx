// 🚀 QuickUploadTest - usando nova API Live.use()
import { useState, useRef } from 'react'
import { Live, useChunkedUpload, useLiveComponents } from '@/core/client'
import { LiveFileUpload } from '@server/live/LiveFileUpload'

export function QuickUploadTest() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { sendMessageAndWait } = useLiveComponents()

  // ✨ Sem initialState! Usa defaultState do backend automaticamente
  const upload = Live.use(LiveFileUpload)

  const {
    uploading,
    progress,
    error: uploadError,
    uploadFile,
    cancelUpload,
    reset: resetUpload,
    bytesUploaded,
    totalBytes
  } = useChunkedUpload(upload.$componentId || '', {
    chunkSize: 64 * 1024,
    maxFileSize: 500 * 1024 * 1024,
    allowedTypes: [],
    sendMessageAndWait,
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
        await upload.onFileUploaded({
          filename: selectedFile.name,
          fileUrl: response.fileUrl
        })
      }
      setSelectedFile(null)
      resetUpload()
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (error) => console.error('Upload error:', error)
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`
  }

  if (!upload.$connected) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="text-yellow-400 text-sm">🔌 Conectando...</div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">📤</div>
        <div>
          <h3 className="text-lg font-semibold text-white">Adaptive Upload</h3>
          <p className="text-xs text-gray-400">Chunk dinâmico habilitado</p>
        </div>
      </div>

      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) { setSelectedFile(file); resetUpload() }
          }}
          disabled={uploading}
          className="block w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 disabled:opacity-50"
        />

        {selectedFile && !uploading && (
          <div className="text-sm text-gray-300">
            📁 {selectedFile.name} ({formatBytes(selectedFile.size)})
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-300">
              <span>Enviando...</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-400">
              {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}
            </div>
          </div>
        )}

        {uploadError && <div className="text-xs text-red-400">❌ {uploadError}</div>}

        <div className="flex gap-2">
          <button
            onClick={() => selectedFile && uploadFile(selectedFile)}
            disabled={!selectedFile || uploading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 font-medium text-sm"
          >
            {uploading ? '⏳ Enviando...' : '🚀 Upload'}
          </button>
          {uploading && (
            <button onClick={cancelUpload} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
              ❌
            </button>
          )}
        </div>

        {upload.uploadedFiles.length > 0 && !uploading && (
          <div className="pt-3 border-t border-white/10 text-xs text-green-400">
            ✅ Último: {upload.uploadedFiles[0].filename}
          </div>
        )}
      </div>
    </div>
  )
}
