// 🔥 FluxStack Live - Hook para componentes real-time
//
// Uso:
//   import { Live } from '@/core/client'
//   import { LiveForm } from '@server/live/LiveForm'
//
//   const form = Live.use(LiveForm, { name: '', email: '' })
//
//   return (
//     <input {...form.$field('name', { syncOn: 'blur' })} />
//     <button onClick={() => form.submit()}>Enviar</button>
//   )

import { useLiveComponent } from '../hooks/useLiveComponent'
import type { UseLiveComponentOptions, LiveProxy } from '../hooks/useLiveComponent'

// ===== Tipos para Inferência do Servidor =====

// Extrai o State da classe do servidor
type ExtractState<T> = T extends { new(...args: any[]): { state: infer S } }
  ? S extends Record<string, any> ? S : Record<string, any>
  : Record<string, any>

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

function useLive<T extends { new(...args: any[]): any }>(
  ComponentClass: T,
  initialState: ExtractState<T>,
  options?: UseLiveComponentOptions
): LiveProxy<ExtractState<T>, ExtractActions<T>> {
  const componentName = ComponentClass.name.replace(/Component$/, '')
  return useLiveComponent<ExtractState<T>, ExtractActions<T>>(
    componentName,
    initialState,
    options
  )
}

// ===== Export =====

export const Live = {
  use: useLive
}

export default Live
