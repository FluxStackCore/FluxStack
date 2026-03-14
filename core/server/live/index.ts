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
  LiveAuthUser,
  LiveAuthContext,
  LiveComponentAuth,
  LiveActionAuth,
  LiveActionAuthMap,
  LiveAuthResult,
} from '@fluxstack/live'

// Backward-compatible singleton accessors
// These lazily access the LiveServer instance created by the plugin
import { liveServer, pendingAuthProviders } from './websocket-plugin'
import type { LiveAuthProvider as _LiveAuthProvider } from '@fluxstack/live'
import type { ComponentRegistry as _ComponentRegistry } from '@fluxstack/live'
import type { WebSocketConnectionManager as _WebSocketConnectionManager } from '@fluxstack/live'
import type { RoomStateManager as _RoomStateManager } from '@fluxstack/live'
import type { LiveRoomManager as _LiveRoomManager } from '@fluxstack/live'
import type { RoomEventBus as _RoomEventBus } from '@fluxstack/live'
import type { FileUploadManager as _FileUploadManager } from '@fluxstack/live'
import type { PerformanceMonitor as _PerformanceMonitor } from '@fluxstack/live'
import type { StateSignatureManager as _StateSignatureManager } from '@fluxstack/live'
import type { LiveAuthManager as _LiveAuthManager } from '@fluxstack/live'

function requireLiveServer() {
  if (!liveServer) {
    throw new Error(
      'LiveComponents plugin not initialized. ' +
      'Ensure the live-components plugin is loaded before accessing Live singletons.'
    )
  }
  return liveServer
}

/**
 * Backward-compatible liveAuthManager.
 * Buffers register() calls that happen before the plugin setup(),
 * then delegates to liveServer.authManager once available.
 * @deprecated Access via liveServer.authManager instead
 */
export const liveAuthManager: Pick<_LiveAuthManager, 'authenticate' | 'hasProviders' | 'authorizeRoom' | 'authorizeAction' | 'authorizeComponent'> & { register: (provider: _LiveAuthProvider) => void } = {
  register(provider: _LiveAuthProvider) {
    if (liveServer) {
      liveServer.useAuth(provider)
    } else {
      pendingAuthProviders.push(provider)
    }
  },
  get authenticate() { return requireLiveServer().authManager.authenticate.bind(requireLiveServer().authManager) },
  get hasProviders() { return requireLiveServer().authManager.hasProviders.bind(requireLiveServer().authManager) },
  get authorizeRoom() { return requireLiveServer().authManager.authorizeRoom.bind(requireLiveServer().authManager) },
  get authorizeAction() { return requireLiveServer().authManager.authorizeAction.bind(requireLiveServer().authManager) },
  get authorizeComponent() { return requireLiveServer().authManager.authorizeComponent.bind(requireLiveServer().authManager) },
}

/** Helper to create a typed lazy proxy that delegates to a LiveServer property */
function createLazyProxy<T extends object>(accessor: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) { return (accessor() as Record<string | symbol, unknown>)[prop] }
  })
}

/** @deprecated Access via liveServer.registry instead */
export const componentRegistry = createLazyProxy<_ComponentRegistry>(() => requireLiveServer().registry)

/** @deprecated Access via liveServer.connectionManager instead */
export const connectionManager = createLazyProxy<_WebSocketConnectionManager>(() => requireLiveServer().connectionManager)

/** @deprecated Access via liveServer.roomManager instead */
export const liveRoomManager = createLazyProxy<_LiveRoomManager>(() => requireLiveServer().roomManager)

/** @deprecated Access via liveServer.roomEvents instead */
export const roomEvents = createLazyProxy<_RoomEventBus>(() => requireLiveServer().roomEvents)

/** @deprecated Access via liveServer.fileUploadManager instead */
export const fileUploadManager = createLazyProxy<_FileUploadManager>(() => requireLiveServer().fileUploadManager)

/** @deprecated Access via liveServer.performanceMonitor instead */
export const performanceMonitor = createLazyProxy<_PerformanceMonitor>(() => requireLiveServer().performanceMonitor)

/** @deprecated Access via liveServer.stateSignature instead */
export const stateSignature = createLazyProxy<_StateSignatureManager>(() => requireLiveServer().stateSignature)

// Room state backward compat
export const roomState = createLazyProxy<_LiveRoomManager>(() => requireLiveServer().roomManager)
