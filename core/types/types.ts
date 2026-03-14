// FluxStack Live Components - Shared Types
// Re-exports from @fluxstack/live for backward compatibility

// LiveComponent base class
export { LiveComponent } from '@fluxstack/live'

// EMIT_OVERRIDE_KEY: uses Symbol.for() for cross-module compatibility
// Not yet exported from @fluxstack/live runtime, so we define it here
export const EMIT_OVERRIDE_KEY = Symbol.for('fluxstack:emitOverride')

// WebSocket types — FluxStack aliases
export type { GenericWebSocket as FluxStackWebSocket } from '@fluxstack/live'
export type { LiveWSData as FluxStackWSData } from '@fluxstack/live'

// For Bun-specific raw WS (FluxStack-specific)
import type { ServerWebSocket } from 'bun'
import type { LiveWSData } from '@fluxstack/live'
export type FluxStackServerWebSocket = ServerWebSocket<LiveWSData>

// Protocol messages
export type {
  LiveMessage,
  ComponentState,
  LiveComponentInstance,
  ComponentDefinition,
  BroadcastMessage,
  WebSocketMessage,
  WebSocketResponse,
  HybridState,
  HybridComponentOptions,
  ServerRoomHandle,
  ServerRoomProxy,
  FileChunkData,
  FileUploadStartMessage,
  FileUploadChunkMessage,
  FileUploadCompleteMessage,
  FileUploadProgressResponse,
  FileUploadCompleteResponse,
  BinaryChunkHeader,
  ActiveUpload,
} from '@fluxstack/live'

// Auth types
export type {
  LiveAuthContext,
  LiveComponentAuth,
  LiveActionAuth,
  LiveActionAuthMap,
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthUser,
  LiveAuthResult,
} from '@fluxstack/live'

// Type inference utilities
export type {
  ExtractActions,
  ActionNames,
  ActionPayload,
  ActionReturn,
  InferComponentState,
  InferPrivateState,
  TypedCall,
  TypedCallAndWait,
  TypedSetValue,
  UseTypedLiveComponentReturn,
} from '@fluxstack/live'

// Utility types (FluxStack-specific aliases)
export type ComponentActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never
}

export type ComponentProps<T extends import('@fluxstack/live').LiveComponent> =
  T extends import('@fluxstack/live').LiveComponent<infer TState> ? TState : never

export type ActionParameters<T, K extends keyof T> =
  T[K] extends (...args: infer P) => any ? P : never

export type ActionReturnType<T, K extends keyof T> =
  T[K] extends (...args: any[]) => infer R ? R : never

// Deprecated types (backward compat)
/** @deprecated Use FluxStackWSData instead */
export interface WebSocketData {
  components: Map<string, unknown>
  userId?: string
  subscriptions: Set<string>
}

/** @deprecated Not used in current protocol */
export interface StateValidation {
  checksum: string
  version: number
  source: 'client' | 'server' | 'mount'
  timestamp: number
}

/** @deprecated Not used in current protocol */
export interface StateConflict {
  property: string
  clientValue: unknown
  serverValue: unknown
  timestamp: number
  resolved: boolean
}
