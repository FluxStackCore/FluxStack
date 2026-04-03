// FluxStack Live - Server Exports
// Re-exports from @fluxstack/live + backward-compatible singleton accessors

export { liveComponentsPlugin, liveServer } from './websocket-plugin'

// Re-export classes and types from @fluxstack/live
export { RoomStateManager, createTypedRoomState } from '@fluxstack/live'
export type { RoomStateData, RoomInfo } from '@fluxstack/live'

export { RoomEventBus, createTypedRoomEventBus } from '@fluxstack/live'
export type { EventHandler, RoomSubscription } from '@fluxstack/live'

export { ComponentRegistry } from '@fluxstack/live'
export { WebSocketConnectionManager } from '@fluxstack/live'
export { FileUploadManager } from '@fluxstack/live'
export { StateSignatureManager } from '@fluxstack/live'
export { PerformanceMonitor } from '@fluxstack/live'
export { liveLog, liveWarn, registerComponentLogging, unregisterComponentLogging } from '@fluxstack/live'
export type { LiveLogCategory, LiveLogConfig } from '@fluxstack/live'

// Auth system
export { LiveAuthManager } from '@fluxstack/live'
export { AuthenticatedContext, AnonymousContext, ANONYMOUS_CONTEXT } from '@fluxstack/live'
export type {
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthSession,
  LiveAuthUser,
  LiveAuthContext,
  LiveComponentAuth,
  LiveActionAuth,
  LiveActionAuthMap,
  LiveAuthResult,
} from '@fluxstack/live'

// Register auth provider — buffers if LiveServer not yet initialized
import { liveServer as _ls, pendingAuthProviders } from './websocket-plugin'
import type { LiveAuthProvider as _LiveAuthProvider } from '@fluxstack/live'

export function registerAuthProvider(provider: _LiveAuthProvider) {
  if (_ls) {
    _ls.useAuth(provider)
  } else {
    pendingAuthProviders.push(provider)
  }
}
