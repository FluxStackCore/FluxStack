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

/**
 * Backward-compatible liveAuthManager.
 * Buffers register() calls that happen before the plugin setup(),
 * then delegates to liveServer.authManager once available.
 * @deprecated Access via liveServer.authManager instead
 */
export const liveAuthManager = {
  register(provider: _LiveAuthProvider) {
    if (liveServer) {
      liveServer.useAuth(provider)
    } else {
      pendingAuthProviders.push(provider)
    }
  },
  get authenticate() { return liveServer!.authManager.authenticate.bind(liveServer!.authManager) },
  get hasProviders() { return liveServer!.authManager.hasProviders.bind(liveServer!.authManager) },
  get authorizeRoom() { return liveServer!.authManager.authorizeRoom.bind(liveServer!.authManager) },
  get authorizeAction() { return liveServer!.authManager.authorizeAction.bind(liveServer!.authManager) },
  get authorizeComponent() { return liveServer!.authManager.authorizeComponent.bind(liveServer!.authManager) },
} as any

/** @deprecated Access via liveServer.registry instead */
export const componentRegistry = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.registry as any)[prop] }
})

/** @deprecated Access via liveServer.connectionManager instead */
export const connectionManager = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.connectionManager as any)[prop] }
})

/** @deprecated Access via liveServer.roomManager instead */
export const liveRoomManager = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.roomManager as any)[prop] }
})

/** @deprecated Access via liveServer.roomEvents instead */
export const roomEvents = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.roomEvents as any)[prop] }
})

/** @deprecated Access via liveServer.fileUploadManager instead */
export const fileUploadManager = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.fileUploadManager as any)[prop] }
})

/** @deprecated Access via liveServer.performanceMonitor instead */
export const performanceMonitor = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.performanceMonitor as any)[prop] }
})

/** @deprecated Access via liveServer.stateSignature instead */
export const stateSignature = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.stateSignature as any)[prop] }
})

// Room state backward compat
export const roomState = new Proxy({} as any, {
  get(_, prop) { return (liveServer!.roomManager as any)[prop] }
})
