// 🔥 FluxStack Live - Hook para componentes real-time
//
// Uso:
//   import { Live } from '@/core/client'
//   import { LiveForm } from '@server/live/LiveForm'
//
//   // Sem estado inicial - usa defaultState do componente
//   const form = Live.use(LiveForm)
//
//   // Com estado inicial parcial (override)
//   const form = Live.use(LiveForm, { name: 'João' })
//
//   return (
//     <input {...form.$field('name', { syncOn: 'blur' })} />
//     <button onClick={() => form.submit()}>Enviar</button>
//   )

import { useLiveComponent } from '../hooks/useLiveComponent'
import type { UseLiveComponentOptions, LiveProxy } from '../hooks/useLiveComponent'

// ===== Tipos para Inferência do Servidor =====

// Extrai o defaultState estático da classe
type ExtractDefaultState<T> = T extends { defaultState: infer S }
  ? S extends Record<string, any> ? S : Record<string, any>
  : Record<string, any>

// Extrai o State da classe do servidor (via instance.state)
type ExtractState<T> = T extends { new(...args: any[]): { state: infer S } }
  ? S extends Record<string, any> ? S : Record<string, any>
  : ExtractDefaultState<T>

// Extrai as Actions (métodos públicos async) da classe do servidor
type ExtractActions<T> = T extends { new(...args: any[]): infer Instance }
  ? {
      [K in keyof Instance as Instance[K] extends (...args: any[]) => Promise<any>
        ? K extends 'setState' | 'getState' | 'getValue' | 'setValue' | 'setValues' | 'getSnapshot'
          ? never
          : K
        : never
      ]: Instance[K]
    }
  : Record<string, never>

// ===== Hook Principal =====

function useLive<T extends { new(...args: any[]): any; defaultState?: Record<string, any> }>(
  ComponentClass: T,
  initialState?: Partial<ExtractState<T>>,
  options?: UseLiveComponentOptions
): LiveProxy<ExtractState<T>, ExtractActions<T>> {
  const componentName = ComponentClass.name.replace(/Component$/, '')

  // Usa defaultState da classe se não passar initialState
  const defaultState = (ComponentClass as any).defaultState || {}
  const mergedState = { ...defaultState, ...initialState } as ExtractState<T>

  return useLiveComponent<ExtractState<T>, ExtractActions<T>>(
    componentName,
    mergedState,
    options
  )
}

// ===== Export =====

export const Live = {
  use: useLive
}

export default Live
