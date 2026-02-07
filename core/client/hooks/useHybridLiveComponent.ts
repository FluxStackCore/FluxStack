// 🔥 Hybrid Live Component Hook v2 - Uses Single WebSocket Connection
// Refactored to use LiveComponentsProvider context instead of creating its own connection

import { useState, useEffect, useCallback, useRef } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useLiveComponents } from '../LiveComponentsProvider'
import { StateValidator } from './state-validator'
import type {
  HybridState,
  StateConflict,
  HybridComponentOptions,
  WebSocketMessage,
  WebSocketResponse
} from '@core/types/types'

// Client-side state persistence for reconnection
interface PersistedComponentState {
  componentName: string
  signedState: any
  room?: string
  userId?: string
  lastUpdate: number
}

const STORAGE_KEY_PREFIX = 'fluxstack_component_'
const STATE_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

// Global re-hydration throttling by component name
const globalRehydrationAttempts = new Map<string, Promise<boolean>>()

// Utility functions for state persistence
const persistComponentState = (componentName: string, signedState: any, room?: string, userId?: string) => {
  try {
    const persistedState: PersistedComponentState = {
      componentName,
      signedState,
      room,
      userId,
      lastUpdate: Date.now()
    }

    const key = `${STORAGE_KEY_PREFIX}${componentName}`
    localStorage.setItem(key, JSON.stringify(persistedState))
  } catch (error) {
    console.warn('⚠️ Failed to persist component state:', error)
  }
}

const getPersistedState = (componentName: string): PersistedComponentState | null => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${componentName}`
    const stored = localStorage.getItem(key)

    if (!stored) {
      return null
    }

    const persistedState: PersistedComponentState = JSON.parse(stored)

    // Check if state is not too old
    const age = Date.now() - persistedState.lastUpdate
    if (age > STATE_MAX_AGE) {
      localStorage.removeItem(key)
      return null
    }

    return persistedState
  } catch (error) {
    console.warn('⚠️ Failed to retrieve persisted state:', error)
    return null
  }
}

const clearPersistedState = (componentName: string) => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${componentName}`
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('⚠️ Failed to clear persisted state:', error)
  }
}

interface HybridStore<T> {
  hybridState: HybridState<T>
  updateState: (newState: T, source?: 'server' | 'mount') => void
  reset: (initialState: T) => void
}

export interface UseHybridLiveComponentReturn<T> {
  // Server-driven state (read-only from frontend perspective)
  state: T

  // Status information
  loading: boolean
  error: string | null
  connected: boolean
  componentId: string | null

  // Connection status with all possible states
  status: 'synced' | 'disconnected' | 'connecting' | 'reconnecting' | 'loading' | 'mounting' | 'error'

  // Actions (all go to server)
  call: (action: string, payload?: any) => Promise<void>
  callAndWait: (action: string, payload?: any, timeout?: number) => Promise<any>
  mount: () => Promise<void>
  unmount: () => Promise<void>

  // Helper for temporary input state
  useControlledField: <K extends keyof T>(field: K, action?: string) => {
    value: T[K]
    setValue: (value: T[K]) => void
    commit: (value?: T[K]) => Promise<void>
    isDirty: boolean
  }
}

/**
 * Create Zustand store for component instance
 */
function createHybridStore<T>(initialState: T) {
  return create<HybridStore<T>>()(
    subscribeWithSelector((set, get) => ({
      hybridState: {
        data: initialState,
        validation: StateValidator.createValidation(initialState, 'mount'),
        conflicts: [],
        status: 'disconnected' as const
      },

      updateState: (newState: T, source: 'server' | 'mount' = 'server') => {
        set((state) => {
          return {
            hybridState: {
              data: newState,
              validation: StateValidator.createValidation(newState, source),
              conflicts: [],
              status: 'synced'
            }
          }
        })
      },

      reset: (initialState: T) => {
        set({
          hybridState: {
            data: initialState,
            validation: StateValidator.createValidation(initialState, 'mount'),
            conflicts: [],
            status: 'disconnected'
          }
        })
      }
    }))
  )
}

export function useHybridLiveComponent<T = any>(
  componentName: string,
  initialState: T,
  options: HybridComponentOptions = {}
): UseHybridLiveComponentReturn<T> {
  const {
    fallbackToLocal = true,
    room,
    userId,
    autoMount = true,
    debug = false,
    onConnect,
    onMount,
    onDisconnect,
    onRehydrate,
    onError,
    onStateChange
  } = options

  // Use Live Components context (singleton WebSocket connection)
  const {
    connected,
    sendMessage: contextSendMessage,
    sendMessageAndWait: contextSendMessageAndWait,
    registerComponent,
    unregisterComponent
  } = useLiveComponents()

  // Create unique instance ID
  const instanceId = useRef(`${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const logPrefix = `${instanceId.current}${room ? `[${room}]` : ''}`

  // Create Zustand store instance (one per component instance)
  const storeRef = useRef<ReturnType<typeof createHybridStore<T>> | null>(null)
  if (!storeRef.current) {
    storeRef.current = createHybridStore(initialState)
  }
  const store = storeRef.current

  // Get state from Zustand store
  const hybridState = store((state) => state.hybridState)
  const stateData = store((state) => state.hybridState.data)
  const updateState = store((state) => state.updateState)

  // Component state
  const [componentId, setComponentId] = useState<string | null>(null)
  const [lastServerState, setLastServerState] = useState<T | null>(null)
  const [mountLoading, setMountLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rehydrating, setRehydrating] = useState(false)
  const [currentSignedState, setCurrentSignedState] = useState<any>(null)
  const mountedRef = useRef(false)
  const mountingRef = useRef(false)
  const lastKnownComponentIdRef = useRef<string | null>(null)

  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[${logPrefix}] ${message}`, data)
    }
  }, [debug, logPrefix])

  // Prevent multiple simultaneous re-hydration attempts
  const rehydrationAttemptRef = useRef<Promise<boolean> | null>(null)

  // Register this component with WebSocket context
  useEffect(() => {
    if (!componentId) return

    log('📝 Registering component with WebSocket context', componentId)

    const unregister = registerComponent(componentId, (message: WebSocketResponse) => {
      log('📨 Received message for component', { type: message.type })

      switch (message.type) {
        case 'STATE_UPDATE':
          if (message.payload?.state) {
            const newState = message.payload.state
            const oldState = stateData
            updateState(newState, 'server')
            setLastServerState(newState)

            // Call onStateChange callback
            onStateChange?.(newState, oldState)

            if (message.payload?.signedState) {
              setCurrentSignedState(message.payload.signedState)
              persistComponentState(componentName, message.payload.signedState, room, userId)
            }
          }
          break

        case 'STATE_REHYDRATED':
          if (message.payload?.state && message.payload?.newComponentId) {
            const newState = message.payload.state
            const newComponentId = message.payload.newComponentId

            log('Component re-hydrated successfully', { newComponentId })

            setComponentId(newComponentId)
            lastKnownComponentIdRef.current = newComponentId
            updateState(newState, 'server')
            setLastServerState(newState)

            if (message.payload?.signedState) {
              setCurrentSignedState(message.payload.signedState)
              persistComponentState(componentName, message.payload.signedState, room, userId)
            }

            setRehydrating(false)
            setError(null)

            // Call onRehydrate callback
            onRehydrate?.()
          }
          break

        case 'COMPONENT_REHYDRATED':
          if (message.success && message.result?.newComponentId) {
            log('✅ Re-hydration succeeded', message.result.newComponentId)

            setComponentId(message.result.newComponentId)
            lastKnownComponentIdRef.current = message.result.newComponentId
            setRehydrating(false)
            setError(null)

            // Call onRehydrate callback
            onRehydrate?.()
          } else if (!message.success) {
            log('❌ Re-hydration failed', message.error)
            setRehydrating(false)
            const errorMessage = message.error || 'Re-hydration failed'
            setError(errorMessage)

            // Call onError callback
            onError?.(errorMessage)
          }
          break

        case 'MESSAGE_RESPONSE':
          if (!message.success && message.error?.includes?.('COMPONENT_REHYDRATION_REQUIRED')) {
            log('🔄 Component re-hydration required')
            if (!rehydrating) {
              attemptRehydration()
            }
          }
          break

        case 'ERROR':
          const errorMsg = message.payload?.error || 'Unknown error'
          if (errorMsg.includes('COMPONENT_REHYDRATION_REQUIRED')) {
            log('🔄 Component re-hydration required from ERROR')
            if (!rehydrating) {
              attemptRehydration()
            }
          } else {
            setError(errorMsg)
            // Call onError callback
            onError?.(errorMsg)
          }
          break

        case 'COMPONENT_PONG':
          log('🏓 Received pong from server')
          // Component is alive - update lastActivity if needed
          break
      }
    })

    return () => {
      log('🗑️ Unregistering component from WebSocket context')
      unregister()
    }
  }, [componentId, registerComponent, unregisterComponent, log, updateState, componentName, room, userId, rehydrating, stateData, onStateChange, onRehydrate, onError])

  // Automatic re-hydration on reconnection
  const attemptRehydration = useCallback(async () => {
    if (!connected || rehydrating || mountingRef.current) {
      return false
    }

    // Prevent multiple simultaneous attempts (local)
    if (rehydrationAttemptRef.current) {
      return await rehydrationAttemptRef.current
    }

    // Prevent multiple simultaneous attempts (global)
    if (globalRehydrationAttempts.has(componentName)) {
      return await globalRehydrationAttempts.get(componentName)!
    }

    const persistedState = getPersistedState(componentName)
    if (!persistedState) {
      return false
    }

    // Check if state is too old (> 1 hour = likely expired signing key)
    const stateAge = Date.now() - persistedState.lastUpdate
    const ONE_HOUR = 60 * 60 * 1000
    if (stateAge > ONE_HOUR) {
      log('⏰ Persisted state too old, clearing and skipping rehydration', {
        age: stateAge,
        ageMinutes: Math.floor(stateAge / 60000)
      })
      clearPersistedState(componentName)
      return false
    }

    const rehydrationPromise = (async () => {
      setRehydrating(true)
      setError(null)

      try {
        const tempComponentId = lastKnownComponentIdRef.current || instanceId.current

        const response = await contextSendMessageAndWait({
          type: 'COMPONENT_REHYDRATE',
          componentId: tempComponentId,
          payload: {
            componentName,
            signedState: persistedState.signedState,
            room: persistedState.room,
            userId: persistedState.userId
          }
        }, 2000) // Reduced from 10s to 2s - fast fail for invalid states

        if (response?.success && response?.result?.newComponentId) {
          setComponentId(response.result.newComponentId)
          lastKnownComponentIdRef.current = response.result.newComponentId
          mountedRef.current = true

          // Call onRehydrate callback after React has processed the state update
          // This ensures the component is registered to receive messages before the callback runs
          setTimeout(() => {
            onRehydrate?.()
          }, 0)

          return true
        } else {
          clearPersistedState(componentName)
          const errorMsg = response?.error || 'Re-hydration failed'
          setError(errorMsg)
          onError?.(errorMsg)
          return false
        }

      } catch (error: any) {
        clearPersistedState(componentName)
        setError(error.message)
        return false
      } finally {
        setRehydrating(false)
        rehydrationAttemptRef.current = null
        globalRehydrationAttempts.delete(componentName)
      }
    })()

    rehydrationAttemptRef.current = rehydrationPromise
    globalRehydrationAttempts.set(componentName, rehydrationPromise)

    return await rehydrationPromise
  }, [connected, rehydrating, componentName, contextSendMessageAndWait, log, onRehydrate, onError])

  // Mount component
  const mount = useCallback(async () => {
    if (!connected || mountedRef.current || mountingRef.current) {
      return
    }

    mountingRef.current = true
    setMountLoading(true)
    setError(null)

    try {
      const message: WebSocketMessage = {
        type: 'COMPONENT_MOUNT',
        componentId: instanceId.current,
        payload: {
          component: componentName,
          props: initialState,
          room,
          userId
        }
      }

      const response = await contextSendMessageAndWait(message, 5000) // 5s for mount is enough

      if (response?.success && response?.result?.componentId) {
        const newComponentId = response.result.componentId
        setComponentId(newComponentId)
        lastKnownComponentIdRef.current = newComponentId
        mountedRef.current = true

        if (response.result.signedState) {
          setCurrentSignedState(response.result.signedState)
          persistComponentState(componentName, response.result.signedState, room, userId)
        }

        if (response.result.initialState) {
          updateState(response.result.initialState, 'server')
          setLastServerState(response.result.initialState)
        }

        log('✅ Component mounted successfully', { componentId: newComponentId })

        // Call onMount callback after React has processed the state update
        // This ensures the component is registered to receive messages before the callback runs
        setTimeout(() => {
          onMount?.()
        }, 0)
      } else {
        throw new Error(response?.error || 'No component ID returned from server')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Mount failed'
      setError(errorMessage)
      log('❌ Mount failed', err)

      // Call onError callback
      onError?.(errorMessage)

      if (!fallbackToLocal) {
        throw err
      }
    } finally {
      setMountLoading(false)
      mountingRef.current = false
    }
  }, [connected, componentName, initialState, room, userId, contextSendMessageAndWait, log, fallbackToLocal, updateState, onMount, onError])

  // Unmount component
  const unmount = useCallback(async () => {
    if (!componentId || !connected) {
      return
    }

    try {
      await contextSendMessage({
        type: 'COMPONENT_UNMOUNT',
        componentId
      })

      setComponentId(null)
      mountedRef.current = false
      mountingRef.current = false
      log('✅ Component unmounted successfully')
    } catch (err) {
      log('❌ Unmount failed', err)
    }
  }, [componentId, connected, contextSendMessage, log])

  // Server-only actions
  const call = useCallback(async (action: string, payload?: any): Promise<void> => {
    // Use ref as fallback for componentId (handles timing issues after rehydration)
    const currentComponentId = componentId || lastKnownComponentIdRef.current
    if (!currentComponentId || !connected) {
      throw new Error('Component not mounted or WebSocket not connected')
    }

    try {
      const message: WebSocketMessage = {
        type: 'CALL_ACTION',
        componentId: currentComponentId,
        action,
        payload
      }

      const response = await contextSendMessageAndWait(message, 5000)

      if (!response.success && response.error?.includes?.('COMPONENT_REHYDRATION_REQUIRED')) {
        const rehydrated = await attemptRehydration()
        if (rehydrated) {
          // Use updated ref for retry
          const retryComponentId = lastKnownComponentIdRef.current || currentComponentId
          const retryMessage: WebSocketMessage = {
            type: 'CALL_ACTION',
            componentId: retryComponentId,
            action,
            payload
          }
          await contextSendMessageAndWait(retryMessage, 5000)
        } else {
          throw new Error('Component lost connection and could not be recovered')
        }
      } else if (!response.success) {
        throw new Error(response.error || 'Action failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Action failed'
      setError(errorMessage)
      throw err
    }
  }, [componentId, connected, contextSendMessageAndWait, attemptRehydration])

  // Call action and wait for specific return value
  const callAndWait = useCallback(async (action: string, payload?: any, timeout?: number): Promise<any> => {
    // Use ref as fallback for componentId (handles timing issues after rehydration)
    const currentComponentId = componentId || lastKnownComponentIdRef.current
    if (!currentComponentId || !connected) {
      throw new Error('Component not mounted or WebSocket not connected')
    }

    try {
      const message: WebSocketMessage = {
        type: 'CALL_ACTION',
        componentId: currentComponentId,
        action,
        payload
      }

      const result = await contextSendMessageAndWait(message, timeout)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Action failed'
      setError(errorMessage)
      throw err
    }
  }, [componentId, connected, contextSendMessageAndWait])

  // Auto-mount with re-hydration attempt
  useEffect(() => {
    if (connected && autoMount && !mountedRef.current && !componentId && !mountingRef.current && !rehydrating) {
      attemptRehydration().then(rehydrated => {
        if (!rehydrated && !mountedRef.current && !componentId && !mountingRef.current) {
          mount()
        }
      }).catch(() => {
        if (!mountedRef.current && !componentId && !mountingRef.current) {
          mount()
        }
      })
    }
  }, [connected, autoMount, mount, componentId, rehydrating, attemptRehydration])

  // Monitor connection status changes
  const prevConnectedRef = useRef(connected)
  useEffect(() => {
    const wasConnected = prevConnectedRef.current
    const isConnected = connected

    if (wasConnected && !isConnected && mountedRef.current) {
      mountedRef.current = false
      setComponentId(null)
      // Call onDisconnect callback
      onDisconnect?.()
    }

    if (!wasConnected && isConnected) {
      // Call onConnect callback when WebSocket connects
      onConnect?.()

      if (!mountedRef.current && !mountingRef.current && !rehydrating) {
        setTimeout(() => {
          if (!mountedRef.current && !mountingRef.current && !rehydrating) {
            const persistedState = getPersistedState(componentName)

            if (persistedState?.signedState) {
              attemptRehydration()
            } else {
              mount()
            }
          }
        }, 100)
      }
    }

    prevConnectedRef.current = connected
  }, [connected, mount, componentId, attemptRehydration, componentName, rehydrating, onDisconnect, onConnect])

  // Unmount on cleanup
  useEffect(() => {
    return () => {
      if (mountedRef.current) {
        unmount()
      }
    }
  }, [unmount])

  // Helper for controlled inputs
  const useControlledField = useCallback(<K extends keyof T>(
    field: K,
    action: string = 'updateField'
  ) => {
    const [tempValue, setTempValue] = useState<T[K]>(stateData[field])

    useEffect(() => {
      setTempValue(stateData[field])
    }, [stateData[field]])

    const commitValue = useCallback(async (value?: T[K]) => {
      const valueToCommit = value !== undefined ? value : tempValue
      await call(action, { field, value: valueToCommit })
    }, [tempValue, field, action])

    return {
      value: tempValue,
      setValue: setTempValue,
      commit: commitValue,
      isDirty: JSON.stringify(tempValue) !== JSON.stringify(stateData[field])
    }
  }, [stateData, call])

  // Calculate status
  const getStatus = () => {
    if (!connected) return 'connecting'
    if (rehydrating) return 'reconnecting'
    if (mountLoading) return 'loading'
    if (error) return 'error'
    if (!componentId) return 'mounting'
    if (hybridState.status === 'disconnected') return 'disconnected'
    return 'synced'
  }

  const status = getStatus()

  return {
    state: stateData,
    loading: mountLoading,
    error,
    connected,
    componentId,
    status,
    call,
    callAndWait,
    mount,
    unmount,
    useControlledField
  }
}
