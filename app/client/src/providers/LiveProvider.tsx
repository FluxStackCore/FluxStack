/**
 * SSR-safe LiveComponentsProvider wrapper
 *
 * On the server: renders children directly (no WebSocket, no context)
 * On the client: lazy-loads @fluxstack/live-react and wraps with the real provider
 *
 * This lets the dev use it in App.tsx normally — SSR just works.
 */

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'

// Stub context for SSR — provides safe default values
const LiveStubContext = createContext<Record<string, any>>({
  connected: false,
  connecting: false,
  authenticated: false,
  $auth: {},
  sendMessage: () => Promise.resolve(),
  sendMessageAndWait: () => Promise.resolve({}),
  registerComponent: () => () => {},
  unregisterComponent: () => {},
  reconnect: () => {},
  authenticate: () => {},
  getWebSocket: () => null,
})

const isServer = typeof window === 'undefined'

interface LiveProviderProps {
  url?: string
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  debug?: boolean
  children: ReactNode
}

export function LiveProvider({
  children,
  ...props
}: LiveProviderProps) {
  const [RealProvider, setRealProvider] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    // Only runs on client — lazy load the real LiveComponentsProvider
    import('@fluxstack/live-react').then(mod => {
      setRealProvider(() => mod.LiveComponentsProvider)
    })
  }, [])

  // Server-side or before provider loads: render with stub context
  if (isServer || !RealProvider) {
    return (
      <LiveStubContext.Provider value={{ connected: false, connecting: true }}>
        {children}
      </LiveStubContext.Provider>
    )
  }

  // Client-side with real provider loaded
  return <RealProvider {...props}>{children}</RealProvider>
}

/**
 * SSR-safe hook — returns stub values on server, real values on client.
 * Components can use this instead of importing directly from @fluxstack/live-react.
 */
export function useLiveStatus() {
  return useContext(LiveStubContext)
}
