/**
 * FluxStack App — Server-first Architecture
 *
 * This component runs on BOTH server and client:
 * - Server: renderToReadableStream generates full HTML
 * - Client: hydrateRoot attaches event handlers to existing DOM
 *
 * Components that need browser-only features (Live Components, WebSocket)
 * are wrapped in ClientBoundary — they render a placeholder on the server
 * and are hydrated individually on the client via code-split chunks.
 *
 * NO "use client" directive — this is a server component by default.
 */

import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import { api } from './lib/eden-api'
import { AppLayout } from './components/AppLayout'
import { DemoPage } from './components/DemoPage'
import { HomePage } from './pages/HomePage'
import { ApiTestPage } from './pages/ApiTestPage'
import { ClientBoundary } from '../../../plugins/bun-next/client-boundary'

// ---------------------------------------------------------------------------
// Server-safe components (no live-react dependency)
// ---------------------------------------------------------------------------

function NotFoundPage() {
  const location = useLocation()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-black text-white mb-4">404</h1>
      <p className="text-xl text-gray-400 mb-6">Pagina nao encontrada</p>
      <p className="text-sm text-gray-500 mb-8">
        O caminho <code className="text-theme">{location.pathname}</code> nao existe.
      </p>
      <a
        href="/"
        className="px-6 py-3 rounded-xl bg-theme-muted border border-theme-active text-theme hover:bg-theme-muted transition-all"
      >
        Voltar ao inicio
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton shown during SSR for client-only components
// ---------------------------------------------------------------------------

function LiveDemoSkeleton({ label }: { label: string }) {
  return (
    <DemoPage>
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-gray-400 text-sm">{label}</p>
      </div>
    </DemoPage>
  )
}

// ---------------------------------------------------------------------------
// App Content — server-rendered routes
// ---------------------------------------------------------------------------

function AppContent() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [apiResponse, setApiResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // useEffect only runs on the client — SSR skips this
  useEffect(() => {
    checkApiStatus()
  }, [])

  const checkApiStatus = async () => {
    try {
      const { error } = await api.health.get()
      setApiStatus(error ? 'offline' : 'online')
    } catch {
      setApiStatus('offline')
    }
  }

  const testHealthCheck = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.health.get()
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  const testGetUsers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.users.get()
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  const testCreateUser = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.users.post({
        name: `Test User ${Date.now()}`,
        email: `test${Date.now()}@example.com`
      })
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Server component — rendered to full HTML, zero JS overhead */}
        <Route path="/" element={<HomePage apiStatus={apiStatus} />} />

        {/* Server component — rendered on server, hydrated on client */}
        <Route
          path="/api-test"
          element={
            <ApiTestPage
              apiResponse={apiResponse}
              isLoading={isLoading}
              onHealth={testHealthCheck}
              onGetUsers={testGetUsers}
              onCreateUser={testCreateUser}
            />
          }
        />

        {/* Client-only components — use Live.use() which needs LiveComponentsProvider */}
        {/* Server renders skeleton, client loads chunk + hydrates with providers */}
        <Route path="/form" element={
          <ClientBoundary component="app/client/src/live/FormDemo" fallback={<LiveDemoSkeleton label="Loading Form..." />} />
        } />
        <Route path="/counter" element={
          <ClientBoundary component="app/client/src/live/CounterDemo" fallback={<LiveDemoSkeleton label="Loading Counter..." />} />
        } />
        <Route path="/upload" element={
          <ClientBoundary component="app/client/src/live/UploadDemo" fallback={<LiveDemoSkeleton label="Loading Upload..." />} />
        } />
        <Route path="/shared-counter" element={
          <ClientBoundary component="app/client/src/live/SharedCounterDemo" fallback={<LiveDemoSkeleton label="Loading Shared Counter..." />} />
        } />
        <Route path="/room-chat" element={
          <ClientBoundary component="app/client/src/live/RoomChatDemo" fallback={<LiveDemoSkeleton label="Loading Room Chat..." />} />
        } />
        <Route path="/auth" element={
          <ClientBoundary component="app/client/src/live/AuthDemo" fallback={<LiveDemoSkeleton label="Loading Auth..." />} />
        } />
        <Route path="/ping-pong" element={
          <ClientBoundary component="app/client/src/live/PingPongDemo" fallback={<LiveDemoSkeleton label="Loading Ping Pong..." />} />
        } />

        {/* Server component — full HTML */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// App Root — NO LiveComponentsProvider (that's client-only, in bootstrap)
// ---------------------------------------------------------------------------

export default function App() {
  return <AppContent />
}
