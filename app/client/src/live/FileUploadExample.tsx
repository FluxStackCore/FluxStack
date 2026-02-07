// 📤 FileUploadExample - usando nova API Live.use()
import { useState, useRef } from 'react'
import { Live, useChunkedUpload, useLiveComponents } from '@/core/client'
import { LiveFileUpload } from '@server/live/LiveFileUpload'

export function FileUploadExample() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { sendMessageAndWait } = useLiveComponents()

  // Nova API simplificada
  const upload = Live.use(LiveFileUpload, {
    uploadedFiles: [],
    maxFiles: 10
  })

  // Chunked Upload Hook
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
    onError: (error) => console.error('❌ Upload error:', error)
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop() || ''
    const icons: Record<string, string> = {
      pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
      mp4: '🎥', mp3: '🎵', zip: '🗜️', rar: '🗜️'
    }
    return icons[ext] || '📎'
  }

  const isImage = (filename: string) =>
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(filename)

  if (!upload.$connected) {
    return (
      <div className="p-6 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-300">🔌 Conectando...</p>
      </div>
    )
  }

  const remainingSlots = upload.maxFiles - upload.uploadedFiles.length

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">📤 Upload de Arquivos</h2>
          <p className="text-gray-400 mt-1">Qualquer tipo de arquivo até 500MB</p>
        </div>

        {/* Upload Section */}
        <div className="p-6 border-b border-white/10 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) { setSelectedFile(file); resetUpload() }
            }}
            disabled={uploading || remainingSlots === 0}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 disabled:opacity-50"
          />

          {selectedFile && !uploading && (
            <div className="p-3 bg-white/5 rounded-lg text-gray-300">
              {getFileIcon(selectedFile.name)} {selectedFile.name} ({formatBytes(selectedFile.size)})
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Enviando...</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-400">{formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}</p>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">
              ❌ {uploadError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => selectedFile && uploadFile(selectedFile)}
              disabled={!selectedFile || uploading || remainingSlots === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
            >
              {uploading ? '⏳ Enviando...' : '📤 Enviar'}
            </button>
            {uploading && (
              <button onClick={cancelUpload} className="px-4 py-2 bg-red-600 text-white rounded-lg">
                ❌ Cancelar
              </button>
            )}
            {upload.uploadedFiles.length > 0 && (
              <button
                onClick={() => upload.clearAll()}
                disabled={uploading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg ml-auto disabled:opacity-50"
              >
                🗑️ Limpar
              </button>
            )}
          </div>

          <p className="text-sm text-gray-400">
            {remainingSlots > 0 ? `✅ ${remainingSlots} slots disponíveis` : '⚠️ Máximo atingido'}
          </p>
        </div>

        {/* Files Grid */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Arquivos ({upload.uploadedFiles.length}/{upload.maxFiles})
          </h3>

          {upload.uploadedFiles.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-lg text-gray-400">
              Nenhum arquivo enviado
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upload.uploadedFiles.map((file) => (
                <div key={file.id} className="relative bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                  <div className="aspect-video bg-black/20 flex items-center justify-center">
                    {isImage(file.filename) ? (
                      <img src={file.url} alt={file.filename} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-5xl">{getFileIcon(file.filename)}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-white truncate">{file.filename}</p>
                    <p className="text-xs text-gray-400">{new Date(file.uploadedAt).toLocaleString()}</p>
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline">
                      Download
                    </a>
                  </div>
                  <button
                    onClick={() => upload.removeFile({ fileId: file.id })}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
