// 🔥 Typed Live Component Hook - Full Type Inference for Actions
// Similar to Eden Treaty - automatic type inference from backend components

import { useHybridLiveComponent } from './useHybridLiveComponent'
import type { UseHybridLiveComponentReturn } from './useHybridLiveComponent'
import type {
  LiveComponent,
  InferComponentState,
  HybridComponentOptions,
  UseTypedLiveComponentReturn,
  ActionNames,
  ActionPayload,
  ActionReturn
} from '@core/types/types'

/**
 * Type-safe Live Component hook with automatic action inference
 *
 * @example
 * // Backend component definition
 * class LiveClockComponent extends LiveComponent<LiveClockState> {
 *   async setTimeFormat(payload: { format: '12h' | '24h' }) { ... }
 *   async toggleSeconds(payload?: { showSeconds?: boolean }) { ... }
 *   async getServerInfo() { ... }
 * }
 *
 * // Frontend usage with full type inference
 * const { state, call, callAndWait } = useTypedLiveComponent<LiveClockComponent>(
 *   'LiveClock',
 *   initialState
 * )
 *
 * // ✅ Autocomplete for action names
 * await call('setTimeFormat', { format: '12h' })
 *
 * // ✅ Type error if wrong payload
 * await call('setTimeFormat', { format: 'invalid' }) // Error!
 *
 * // ✅ Return type is inferred
 * const result = await callAndWait('getServerInfo')
 * // result is: { success: boolean; info: { serverTime: string; ... } }
 */
export function useTypedLiveComponent<T extends LiveComponent<any>>(
  componentName: string,
  initialState: InferComponentState<T>,
  options: HybridComponentOptions = {}
): UseTypedLiveComponentReturn<T> {
  // Use the original hook
  const result = useHybridLiveComponent<InferComponentState<T>>(
    componentName,
    initialState,
    options
  )

  // Create convenience setValue helper
  const setValue = async <K extends keyof InferComponentState<T>>(
    key: K,
    value: InferComponentState<T>[K]
  ): Promise<void> => {
    await result.call('setValue', { key, value })
  }

  // Return with typed call functions and setValue helper
  // The types are enforced at compile time, runtime behavior is the same
  return {
    ...result,
    setValue
  } as unknown as UseTypedLiveComponentReturn<T>
}

/**
 * Helper type to create a component registry map
 * Maps component names to their class types for even better DX
 *
 * @example
 * // Define your component map
 * type MyComponents = {
 *   LiveClock: LiveClockComponent
 *   LiveCounter: LiveCounterComponent
 *   LiveChat: LiveChatComponent
 * }
 *
 * // Create a typed hook for your app
 * function useMyComponent<K extends keyof MyComponents>(
 *   name: K,
 *   initialState: ComponentState<MyComponents[K]>,
 *   options?: HybridComponentOptions
 * ) {
 *   return useTypedLiveComponent<MyComponents[K]>(name, initialState, options)
 * }
 *
 * // Usage
 * const clock = useMyComponent('LiveClock', { ... })
 * // TypeScript knows exactly which actions are available!
 */
export type ComponentRegistry<T extends Record<string, LiveComponent<any>>> = {
  [K in keyof T]: T[K]
}

/**
 * Create a factory for typed live component hooks
 * Useful when you have many components and want simpler imports
 *
 * @example
 * // In your app/client/src/lib/live.ts
 * import { createTypedLiveComponentHook } from '@core/client/hooks/useTypedLiveComponent'
 * import type { LiveClockComponent } from '@app/server/live/LiveClockComponent'
 *
 * export const useLiveClock = createTypedLiveComponentHook<LiveClockComponent>('LiveClock')
 *
 * // Usage in component
 * const { state, call } = useLiveClock({ currentTime: '', ... })
 */
export function createTypedLiveComponentHook<T extends LiveComponent<any>>(
  componentName: string
) {
  return function useComponent(
    initialState: InferComponentState<T>,
    options: HybridComponentOptions = {}
  ): UseTypedLiveComponentReturn<T> {
    return useTypedLiveComponent<T>(componentName, initialState, options)
  }
}

// Re-export types for convenience
export type {
  InferComponentState,
  ActionNames,
  ActionPayload,
  ActionReturn,
  UseTypedLiveComponentReturn,
  HybridComponentOptions
}
