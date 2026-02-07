// 🔥 FluxStack Client Core - Main Export

// API Client (Eden Treaty)
export {
  createEdenClient,
  getErrorMessage,
  getDefaultBaseUrl,
  treaty,
  type EdenClientOptions
} from './api'

// Live Components Provider (Singleton WebSocket Connection)
export {
  LiveComponentsProvider,
  useLiveComponents
} from './LiveComponentsProvider'
export type {
  LiveComponentsProviderProps,
  LiveComponentsContextValue
} from './LiveComponentsProvider'

// Chunked Upload Hook
export { useChunkedUpload } from './hooks/useChunkedUpload'
export type { ChunkedUploadOptions, ChunkedUploadState } from './hooks/useChunkedUpload'

// Live Component Hook (API principal)
export { Live } from './components/Live'
