'use client'
// Ilhas client dos demos Live. Cada demo já é client (usa Live.use).
//
// Cada ilha tem seu PRÓPRIO LiveComponentsProvider — necessário porque o React
// Context client NÃO atravessa a fronteira de serialização RSC (um Provider no
// shell server-payload não alcança as ilhas). Mas isso NÃO cria N conexões: o
// connectionPool (módulo singleton do @fluxstack/live-react) faz todas as ilhas
// compartilharem a MESMA conexão WebSocket por chave. E o RootClient mantém um
// Provider "âncora" (refcount) para a conexão sobreviver entre navegações.
import { type ReactNode } from 'react'
import { LiveComponentsProvider } from '@/core/client'
import { ClientOnly } from './ClientOnly'
import { FormDemo } from '../live/FormDemo'
import { CounterDemo } from '../live/CounterDemo'
import { SharedCounterDemo } from '../live/SharedCounterDemo'
import { RoomChatDemo } from '../live/RoomChatDemo'
import { AuthDemo } from '../live/AuthDemo'
import { PingPongDemo } from '../live/PingPongDemo'

// Placeholder mostrado no SSR/antes de hidratar (Live só monta no client).
function Loading() {
  return (
    <div className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] p-12 text-sm text-gray-500">
      <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-theme" />
      Conectando ao Live…
    </div>
  )
}

function Island({ children }: { children: ReactNode }) {
  return (
    <ClientOnly fallback={<Loading />}>
      <LiveComponentsProvider autoConnect reconnectInterval={1000} maxReconnectAttempts={5} heartbeatInterval={30000}>
        {children}
      </LiveComponentsProvider>
    </ClientOnly>
  )
}

export function CounterIsland() { return <Island><CounterDemo /></Island> }
export function FormIsland() { return <Island><FormDemo /></Island> }
export function SharedCounterIsland() { return <Island><SharedCounterDemo /></Island> }
export function RoomChatIsland() { return <Island><RoomChatDemo /></Island> }
export function AuthIsland() { return <Island><AuthDemo /></Island> }
export function PingPongIsland() { return <Island><PingPongDemo /></Island> }
