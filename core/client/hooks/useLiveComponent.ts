// 🔥 FluxStack Live Component Hook - Proxy-based State Access
// Acesse estado do servidor como se fossem variáveis locais (estilo Livewire)
//
// Uso:
//   const clock = useLiveComponent('LiveClock', { currentTime: '', format: '24h' })
//
//   // Lê estado como variável normal
//   console.log(clock.currentTime)  // "14:30:25"
//
//   // Escreve estado - sincroniza automaticamente com servidor
//   clock.format = '12h'
//
//   // Chama actions diretamente
//   await clock.setTimeFormat({ format: '24h' })
//
//   // Metadata via $ prefix
//   clock.$connected  // boolean
//   clock.$loading    // boolean
//   clock.$error      // string | null

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useLiveComponents } from '../LiveComponentsProvider'
import { StateValidator } from './state-validator'
import type {
  HybridState,
  HybridComponentOptions,
  WebSocketMessage,
  WebSocketResponse
} from '@core/types/types'

// ===== Tipos =====

// Opções para $field()
export interface FieldOptions {
  /** Quando sincronizar: 'change' (debounced), 'blur' (ao sair), 'manual' (só $sync) */
  syncOn?: 'change' | 'blur' | 'manual'
  /** Debounce em ms (só para syncOn: 'change'). Default: 150 */
  debounce?: number
  /** Transformar valor antes de sincronizar */
  transform?: (value: any) => any
}

// Retorno do $field()
export interface FieldBinding {
  value: any
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onBlur: () => void
  name: string
}

export interface LiveComponentProxy<TState extends Record<string, any>> {
  // Propriedades de estado são acessadas diretamente: proxy.propertyName

  // Metadata ($ prefix)
  readonly $state: TState
  readonly $connected: boolean
  readonly $loading: boolean
  readonly $error: string | null
  readonly $status: 'synced' | 'disconnected' | 'connecting' | 'reconnecting' | 'loading' | 'mounting' | 'error'
  readonly $componentId: string | null
  readonly $dirty: boolean

  // Methods
  $call: (action: string, payload?: any) => Promise<void>
  $callAndWait: <R = any>(action: string, payload?: any, timeout?: number) => Promise<R>
  $mount: () => Promise<void>
  $unmount: () => Promise<void>
  $refresh: () => Promise<void>
  $set: <K extends keyof TState>(key: K, value: TState[K]) => Promise<void>

  /** Bind de campo com controle de sincronização */
  $field: <K extends keyof TState>(key: K, options?: FieldOptions) => FieldBinding

  /** Sincroniza todos os campos pendentes (para syncOn: 'manual') */
  $sync: () => Promise<void>
}

// Actions são qualquer método que não existe no state
export type LiveProxy<
  TState extends Record<string, any>,
  TActions = {}
> = TState & LiveComponentProxy<TState> & TActions

export interface UseLiveComponentOptions extends HybridComponentOptions {
  /** Debounce para sets (ms). Default: 150 */
  debounce?: number
  /** Atualização otimista (UI atualiza antes do servidor confirmar). Default: true */
  optimistic?: boolean
  /** Modo de sync: 'immediate' | 'debounced' | 'manual'. Default: 'debounced' */
  syncMode?: 'immediate' | 'debounced' | 'manual'
}

// ===== Propriedades Reservadas =====

const RESERVED_PROPS = new Set([
  '$state', '$connected', '$loading', '$error', '$status', '$componentId', '$dirty',
  '$call', '$callAndWait', '$mount', '$unmount', '$refresh', '$set',
  'then', 'toJSON', 'valueOf', 'toString',
  Symbol.toStringTag, Symbol.iterator,
])

// ===== Persistência de Estado =====

const STORAGE_KEY_PREFIX = 'fluxstack_component_'
const STATE_MAX_AGE = 24 * 60 * 60 * 1000

interface PersistedState {
  componentName: string
  signedState: any
  room?: string
  userId?: string
  lastUpdate: number
}

const persistState = (name: string, signedState: any, room?: string, userId?: string) => {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${name}`, JSON.stringify({
      componentName: name, signedState, room, userId, lastUpdate: Date.now()
    }))
  } catch {}
}

const getPersistedState = (name: string): PersistedState | null => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${name}`)
    if (!stored) return null
    const state: PersistedState = JSON.parse(stored)
    if (Date.now() - state.lastUpdate > STATE_MAX_AGE) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${name}`)
      return null
    }
    return state
  } catch { return null }
}

const clearPersistedState = (name: string) => {
  try { localStorage.removeItem(`${STORAGE_KEY_PREFIX}${name}`) } catch {}
}

// ===== Zustand Store =====

interface Store<T> {
  state: T
  status: 'synced' | 'disconnected'
  updateState: (newState: T) => void
}

function createStore<T>(initialState: T) {
  return create<Store<T>>()(
    subscribeWithSelector((set) => ({
      state: initialState,
      status: 'disconnected',
      updateState: (newState: T) => set({ state: newState, status: 'synced' })
    }))
  )
}

// ===== Hook Principal =====

export function useLiveComponent<
  TState extends Record<string, any>,
  TActions = {}
>(
  componentName: string,
  initialState: TState,
  options: UseLiveComponentOptions = {}
): LiveProxy<TState, TActions> {
  const {
    debounce = 150,
    optimistic = true,
    syncMode = 'debounced',
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

  // WebSocket context
  const {
    connected,
    sendMessage,
    sendMessageAndWait,
    registerComponent,
    unregisterComponent
  } = useLiveComponents()

  // Refs
  const instanceId = useRef(`${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const storeRef = useRef<ReturnType<typeof createStore<TState>> | null>(null)
  if (!storeRef.current) storeRef.current = createStore(initialState)
  const store = storeRef.current

  const pendingChanges = useRef<Map<keyof TState, { value: any; synced: boolean }>>(new Map())
  const debounceTimers = useRef<Map<keyof TState, NodeJS.Timeout>>(new Map())
  const localFieldValues = useRef<Map<keyof TState, any>>(new Map()) // Valores locais para campos com syncOn: blur/manual
  const fieldOptions = useRef<Map<keyof TState, FieldOptions>>(new Map()) // Opções por campo
  const [localVersion, setLocalVersion] = useState(0) // Força re-render quando valores locais mudam
  const mountedRef = useRef(false)
  const mountingRef = useRef(false)
  const lastComponentIdRef = useRef<string | null>(null)

  // State
  const stateData = store((s) => s.state)
  const updateState = store((s) => s.updateState)
  const [componentId, setComponentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rehydrating, setRehydrating] = useState(false)
  const [mountFailed, setMountFailed] = useState(false) // Previne loop infinito de mount

  const log = useCallback((msg: string, data?: any) => {
    if (debug) console.log(`[${componentName}] ${msg}`, data || '')
  }, [debug, componentName])

  // ===== Set Property =====
  const setProperty = useCallback(async <K extends keyof TState>(key: K, value: TState[K]) => {
    // Clear existing timer
    const timer = debounceTimers.current.get(key)
    if (timer) clearTimeout(timer)

    // Track pending
    pendingChanges.current.set(key, { value, synced: false })

    const doSync = async () => {
      try {
        const id = componentId || lastComponentIdRef.current
        if (!id || !connected) return

        await sendMessageAndWait({
          type: 'CALL_ACTION',
          componentId: id,
          action: 'setValue',
          payload: { key, value }
        }, 5000)

        pendingChanges.current.get(key)!.synced = true
      } catch (err: any) {
        pendingChanges.current.delete(key)
        setError(err.message)
      }
    }

    if (syncMode === 'immediate') {
      await doSync()
    } else if (syncMode === 'debounced') {
      debounceTimers.current.set(key, setTimeout(doSync, debounce))
    }
  }, [componentId, connected, sendMessageAndWait, debounce, syncMode])

  // ===== Mount =====
  const mount = useCallback(async () => {
    if (!connected || mountedRef.current || mountingRef.current || mountFailed) return

    mountingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const response = await sendMessageAndWait({
        type: 'COMPONENT_MOUNT',
        componentId: instanceId.current,
        payload: { component: componentName, props: initialState, room, userId }
      }, 5000)

      if (response?.success && response?.result?.componentId) {
        const newId = response.result.componentId
        setComponentId(newId)
        lastComponentIdRef.current = newId
        mountedRef.current = true

        if (response.result.signedState) {
          persistState(componentName, response.result.signedState, room, userId)
        }
        if (response.result.initialState) {
          updateState(response.result.initialState)
        }

        log('Mounted', newId)
        setTimeout(() => onMount?.(), 0)
      } else {
        throw new Error(response?.error || 'Mount failed')
      }
    } catch (err: any) {
      setError(err.message)
      setMountFailed(true) // Previne loop infinito
      onError?.(err.message)
      if (!fallbackToLocal) throw err
    } finally {
      setLoading(false)
      mountingRef.current = false
    }
  }, [connected, componentName, initialState, room, userId, sendMessageAndWait, updateState, log, onMount, onError, fallbackToLocal, mountFailed])

  // ===== Unmount =====
  const unmount = useCallback(async () => {
    if (!componentId || !connected) return
    try {
      await sendMessage({ type: 'COMPONENT_UNMOUNT', componentId })
      setComponentId(null)
      mountedRef.current = false
    } catch {}
  }, [componentId, connected, sendMessage])

  // ===== Rehydrate =====
  const rehydrate = useCallback(async () => {
    if (!connected || rehydrating || mountingRef.current) return false

    const persisted = getPersistedState(componentName)
    if (!persisted) return false

    // Skip if too old (> 1 hour)
    if (Date.now() - persisted.lastUpdate > 60 * 60 * 1000) {
      clearPersistedState(componentName)
      return false
    }

    setRehydrating(true)
    try {
      const response = await sendMessageAndWait({
        type: 'COMPONENT_REHYDRATE',
        componentId: lastComponentIdRef.current || instanceId.current,
        payload: {
          componentName,
          signedState: persisted.signedState,
          room: persisted.room,
          userId: persisted.userId
        }
      }, 2000)

      if (response?.success && response?.result?.newComponentId) {
        setComponentId(response.result.newComponentId)
        lastComponentIdRef.current = response.result.newComponentId
        mountedRef.current = true
        setTimeout(() => onRehydrate?.(), 0)
        return true
      }
      clearPersistedState(componentName)
      return false
    } catch {
      clearPersistedState(componentName)
      return false
    } finally {
      setRehydrating(false)
    }
  }, [connected, rehydrating, componentName, sendMessageAndWait, onRehydrate])

  // ===== Call Action =====
  const call = useCallback(async (action: string, payload?: any) => {
    const id = componentId || lastComponentIdRef.current
    if (!id || !connected) throw new Error('Not connected')

    const response = await sendMessageAndWait({
      type: 'CALL_ACTION',
      componentId: id,
      action,
      payload
    }, 5000)

    if (!response.success) throw new Error(response.error || 'Action failed')
  }, [componentId, connected, sendMessageAndWait])

  const callAndWait = useCallback(async <R = any>(action: string, payload?: any, timeout = 10000): Promise<R> => {
    const id = componentId || lastComponentIdRef.current
    if (!id || !connected) throw new Error('Not connected')

    const response = await sendMessageAndWait({
      type: 'CALL_ACTION',
      componentId: id,
      action,
      payload
    }, timeout)

    return response as R
  }, [componentId, connected, sendMessageAndWait])

  // ===== Refresh =====
  const refresh = useCallback(async () => {
    for (const [key, change] of pendingChanges.current) {
      if (!change.synced) {
        await setProperty(key, change.value)
      }
    }
  }, [setProperty])

  // ===== Sync (para campos com syncOn: manual) =====
  const sync = useCallback(async () => {
    const promises: Promise<void>[] = []

    for (const [key, value] of localFieldValues.current) {
      const currentServerValue = stateData[key]
      if (value !== currentServerValue) {
        promises.push(setProperty(key, value))
      }
    }

    await Promise.all(promises)
  }, [stateData, setProperty])

  // ===== Field Binding =====
  const createFieldBinding = useCallback(<K extends keyof TState>(
    key: K,
    options: FieldOptions = {}
  ): FieldBinding => {
    const {
      syncOn = 'change',
      debounce: fieldDebounce = debounce,
      transform
    } = options

    // Salvar opções do campo
    fieldOptions.current.set(key, options)

    // Valor atual: local (se existir) ou do servidor
    const currentValue = localFieldValues.current.has(key)
      ? localFieldValues.current.get(key)
      : stateData[key]

    return {
      name: String(key),
      value: currentValue ?? '',

      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        let value: any = e.target.value

        // Checkbox support
        if (e.target.type === 'checkbox') {
          value = (e.target as HTMLInputElement).checked
        }

        // Transform
        if (transform) {
          value = transform(value)
        }

        // Sempre salvar localmente primeiro (para UI responsiva)
        localFieldValues.current.set(key, value)

        // Forçar re-render
        setLocalVersion(v => v + 1)
        pendingChanges.current.set(key, { value, synced: false })

        if (syncOn === 'change') {
          // Debounced sync
          const timer = debounceTimers.current.get(key)
          if (timer) clearTimeout(timer)

          debounceTimers.current.set(key, setTimeout(async () => {
            await setProperty(key, value)
            localFieldValues.current.delete(key) // Limpar valor local após sync
          }, fieldDebounce))
        }
        // blur e manual: não faz nada aqui, espera onBlur ou $sync()
      },

      onBlur: () => {
        if (syncOn === 'blur') {
          const value = localFieldValues.current.get(key)
          if (value !== undefined && value !== stateData[key]) {
            setProperty(key, value).then(() => {
              localFieldValues.current.delete(key)
            })
          }
        }
      }
    }
  }, [stateData, debounce, setProperty, localVersion])

  // ===== Register with WebSocket =====
  useEffect(() => {
    if (!componentId) return

    const unregister = registerComponent(componentId, (message: WebSocketResponse) => {
      switch (message.type) {
        case 'STATE_UPDATE':
          if (message.payload?.state) {
            const oldState = stateData
            updateState(message.payload.state)
            onStateChange?.(message.payload.state, oldState)
            if (message.payload?.signedState) {
              persistState(componentName, message.payload.signedState, room, userId)
            }
          }
          break
        case 'STATE_REHYDRATED':
          if (message.payload?.state && message.payload?.newComponentId) {
            setComponentId(message.payload.newComponentId)
            lastComponentIdRef.current = message.payload.newComponentId
            updateState(message.payload.state)
            setRehydrating(false)
            onRehydrate?.()
          }
          break
        case 'ERROR':
          setError(message.payload?.error || 'Unknown error')
          onError?.(message.payload?.error)
          break
      }
    })

    return () => unregister()
  }, [componentId, registerComponent, updateState, stateData, componentName, room, userId, onStateChange, onRehydrate, onError])

  // ===== Auto Mount =====
  useEffect(() => {
    if (connected && autoMount && !mountedRef.current && !componentId && !mountingRef.current && !rehydrating && !mountFailed) {
      rehydrate().then(ok => {
        if (!ok && !mountedRef.current && !mountFailed) mount()
      })
    }
  }, [connected, autoMount, mount, componentId, rehydrating, rehydrate, mountFailed])

  // ===== Connection Changes =====
  const prevConnected = useRef(connected)
  useEffect(() => {
    if (prevConnected.current && !connected && mountedRef.current) {
      mountedRef.current = false
      setComponentId(null)
      onDisconnect?.()
    }
    if (!prevConnected.current && connected) {
      onConnect?.()
      if (!mountedRef.current && !mountingRef.current) {
        setTimeout(() => {
          const persisted = getPersistedState(componentName)
          if (persisted?.signedState) rehydrate()
          else mount()
        }, 100)
      }
    }
    prevConnected.current = connected
  }, [connected, mount, rehydrate, componentName, onConnect, onDisconnect])

  // ===== Cleanup =====
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(t => clearTimeout(t))
      if (mountedRef.current) unmount()
    }
  }, [unmount])

  // ===== Status =====
  const getStatus = () => {
    if (!connected) return 'connecting'
    if (rehydrating) return 'reconnecting'
    if (loading) return 'loading'
    if (error) return 'error'
    if (!componentId) return 'mounting'
    return 'synced'
  }

  // ===== Proxy =====
  const proxy = useMemo(() => {
    return new Proxy({} as LiveProxy<TState, TActions>, {
      get(_, prop: string | symbol) {
        if (typeof prop === 'symbol') {
          if (prop === Symbol.toStringTag) return 'LiveComponent'
          return undefined
        }

        // Metadata ($ prefix)
        switch (prop) {
          case '$state': return stateData
          case '$connected': return connected
          case '$loading': return loading
          case '$error': return error
          case '$status': return getStatus()
          case '$componentId': return componentId
          case '$dirty': return pendingChanges.current.size > 0
          case '$call': return call
          case '$callAndWait': return callAndWait
          case '$mount': return mount
          case '$unmount': return unmount
          case '$refresh': return refresh
          case '$set': return setProperty
          case '$field': return createFieldBinding
          case '$sync': return sync
        }

        // Se é propriedade do state → retorna valor
        if (prop in stateData) {
          // Valor local tem prioridade (para UI responsiva com $field)
          if (localFieldValues.current.has(prop as keyof TState)) {
            return localFieldValues.current.get(prop as keyof TState)
          }
          // Optimistic update
          if (optimistic) {
            const pending = pendingChanges.current.get(prop as keyof TState)
            if (pending && !pending.synced) return pending.value
          }
          return stateData[prop as keyof TState]
        }

        // Se NÃO é propriedade do state → é uma action!
        // Retorna uma função que chama a action no servidor
        return async (payload?: any) => {
          const id = componentId || lastComponentIdRef.current
          if (!id || !connected) throw new Error('Not connected')

          const response = await sendMessageAndWait({
            type: 'CALL_ACTION',
            componentId: id,
            action: prop,
            payload
          }, 10000)

          if (!response.success) throw new Error(response.error || 'Action failed')
          return response.result
        }
      },

      set(_, prop: string | symbol, value) {
        if (typeof prop === 'symbol' || RESERVED_PROPS.has(prop as string)) return false
        setProperty(prop as keyof TState, value)
        return true
      },

      has(_, prop) {
        if (typeof prop === 'symbol') return false
        return RESERVED_PROPS.has(prop) || prop in stateData
      },

      ownKeys() {
        return [...Object.keys(stateData), '$state', '$connected', '$loading', '$error', '$status', '$componentId', '$dirty', '$call', '$callAndWait', '$mount', '$unmount', '$refresh', '$set', '$field', '$sync']
      }
    })
  }, [stateData, connected, loading, error, componentId, call, callAndWait, mount, unmount, refresh, setProperty, optimistic, sendMessageAndWait, createFieldBinding, sync, localVersion])

  return proxy
}

// ===== Factory =====

export function createLiveComponent<
  TState extends Record<string, any>,
  TActions = {}
>(
  componentName: string,
  defaultOptions: Omit<UseLiveComponentOptions, keyof HybridComponentOptions> = {}
) {
  return function useComponent(
    initialState: TState,
    options: UseLiveComponentOptions = {}
  ): LiveProxy<TState, TActions> {
    return useLiveComponent<TState, TActions>(componentName, initialState, { ...defaultOptions, ...options })
  }
}
