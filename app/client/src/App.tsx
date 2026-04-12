"use client"

import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import { api } from './lib/eden-api'
import { LiveComponentsProvider, useLiveComponents } from '@/core/client'
import { executeHook } from './lib/plugin-hooks'
import { FormDemo } from './live/FormDemo'
import { CounterDemo } from './live/CounterDemo'
import { UploadDemo } from './live/UploadDemo'
import { RoomChatDemo } from './live/RoomChatDemo'
import { SharedCounterDemo } from './live/SharedCounterDemo'
import { AuthDemo } from './live/AuthDemo'
import { PingPongDemo } from './live/PingPongDemo'
import { AppLayout } from './components/AppLayout'
import { DemoPage } from './components/DemoPage'
import { HomePage } from './pages/HomePage'
import { ApiTestPage } from './pages/ApiTestPage'

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

/**
 * Executes the 'onLiveConnect' plugin hook once when
 * the LiveComponents WebSocket connection is established.
 */
function PluginHookExecutor() {
  const { connected, getWebSocket } = useLiveComponents()
  const firedRef = useRef(false)

  useEffect(() => {
    if (connected && !firedRef.current) {
      firedRef.current = true

      executeHook('onLiveConnect', { connected, getWebSocket }).catch(() => {})
    }
    if (!connected) {
      firedRef.current = false
    }
  }, [connected, getWebSocket])

  return null
}

function AppContent() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [apiResponse, setApiResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

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
        <Route path="/" element={<HomePage apiStatus={apiStatus} />} />
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
        <Route
          path="/form"
          element={
            <DemoPage
              note={<>? Este formul?rio usa <code className="text-theme">Live.use()</code> - cada campo sincroniza automaticamente com o servidor!</>}
            >
              <FormDemo />
            </DemoPage>
          }
        />
        <Route
          path="/counter"
          element={
            <DemoPage>
              <CounterDemo />
            </DemoPage>
          }
        />
        <Route
          path="/upload"
          element={
            <DemoPage>
              <UploadDemo />
            </DemoPage>
          }
        />
        <Route
          path="/shared-counter"
          element={
            <DemoPage
              note={<>Contador compartilhado usando <code className="text-theme">LiveRoom</code> - abra em varias abas!</>}
            >
              <SharedCounterDemo />
            </DemoPage>
          }
        />
        <Route
          path="/room-chat"
          element={
            <DemoPage
              note={<>Chat com múltiplas salas usando o sistema <code className="text-theme">$room</code>.</>}
            >
              <RoomChatDemo />
            </DemoPage>
          }
        />
        <Route
          path="/auth"
          element={
            <DemoPage
              note={<>🔒 Sistema de autenticação declarativo para Live Components com <code className="text-theme">$auth</code>!</>}
            >
              <AuthDemo />
            </DemoPage>
          }
        />
        <Route
          path="/ping-pong"
          element={
            <DemoPage
              note={<>Latency demo com <code className="text-theme-secondary">msgpack</code> binary codec - mensagens binárias no WebSocket!</>}
            >
              <PingPongDemo />
            </DemoPage>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  // In dev, connect WebSocket directly to backend (port 3000) to avoid
  // Vite proxy overhead and HMR WebSocket contention on port 5173.
  // In production, both are served from the same origin so auto-detect works.
  const wsUrl = import.meta.env.DEV
    ? 'ws://localhost:3000/api/live/ws'
    : undefined

  return (
    <LiveComponentsProvider
      url={wsUrl}
      autoConnect={true}
      reconnectInterval={1000}
      maxReconnectAttempts={5}
      heartbeatInterval={30000}
      debug={false}
    >
      <PluginHookExecutor />
      <AppContent />
    </LiveComponentsProvider>
  )
}

export default App
