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
  useLiveComponents,
  // Deprecated exports for backward compatibility
  WebSocketProvider,
  useWebSocketContext
} from './LiveComponentsProvider'
export type {
  LiveComponentsProviderProps,
  LiveComponentsContextValue,
  // Deprecated types for backward compatibility
  WebSocketProviderProps,
  WebSocketContextValue
} from './LiveComponentsProvider'

// Hooks
export { useWebSocket } from './hooks/useWebSocket'
export { useHybridLiveComponent } from './hooks/useHybridLiveComponent'
export { useTypedLiveComponent, createTypedLiveComponentHook } from './hooks/useTypedLiveComponent'
export { useChunkedUpload } from './hooks/useChunkedUpload'
export { AdaptiveChunkSizer } from './hooks/AdaptiveChunkSizer'
export { StateValidator } from './hooks/state-validator'

// Hook types
export type { AdaptiveChunkConfig, ChunkMetrics } from './hooks/AdaptiveChunkSizer'
export type { ChunkedUploadOptions, ChunkedUploadState } from './hooks/useChunkedUpload'

// Re-export types from core/types/types.ts for convenience
export type {
  // Live Components types
  LiveMessage,
  ComponentState,
  LiveComponentInstance,
  WebSocketData,
  ComponentDefinition,
  BroadcastMessage,
  LiveComponent,
  
  // WebSocket types
  WebSocketMessage,
  WebSocketResponse,
  
  // Hybrid Live Component types
  HybridState,
  StateValidation,
  StateConflict,
  HybridComponentOptions,
  
  // File Upload types
  FileChunkData,
  FileUploadStartMessage,
  FileUploadChunkMessage,
  FileUploadCompleteMessage,
  FileUploadProgressResponse,
  FileUploadCompleteResponse,
  ActiveUpload,
  
  // Utility types
  ComponentActions,
  ComponentProps,
  ActionParameters,
  ActionReturnType,

  // Type inference system (similar to Eden Treaty)
  ExtractActions,
  ActionNames,
  ActionPayload,
  ActionReturn,
  InferComponentState,
  TypedCall,
  TypedCallAndWait,
  TypedSetValue,
  UseTypedLiveComponentReturn
} from '../types/types'

// Hook return types
export type { UseHybridLiveComponentReturn } from './hooks/useHybridLiveComponent'
export type { ComponentRegistry } from './hooks/useTypedLiveComponent'