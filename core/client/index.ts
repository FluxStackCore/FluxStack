// FluxStack Client Core - Main Export
// Re-exports from @fluxstack/live-react + FluxStack-specific code

// === Re-exports from @fluxstack/live-react ===

// Provider
export { LiveComponentsProvider, useLiveComponents } from '@fluxstack/live-react'
export type {
  LiveComponentsProviderProps,
  LiveComponentsContextValue,
} from '@fluxstack/live-react'
export type { LiveAuthOptions } from '@fluxstack/live-react'

// Live.use() API
export { Live } from '@fluxstack/live-react'

// Upload Hooks
export { useChunkedUpload } from '@fluxstack/live-react'
export type { ChunkedUploadOptions, ChunkedUploadState } from '@fluxstack/live-react'
export { useLiveChunkedUpload } from '@fluxstack/live-react'
export type { LiveChunkedUploadOptions } from '@fluxstack/live-react'

// === FluxStack-specific (stays here) ===

// Eden Treaty API client
export {
  createEdenClient,
  getErrorMessage,
  getDefaultBaseUrl,
  treaty,
  type EdenClientOptions
} from './api'

// useLiveUpload (FluxStack-specific convenience wrapper)
export { useLiveUpload } from './hooks/useLiveUpload'
