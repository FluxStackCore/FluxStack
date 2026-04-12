/**
 * SSR App — Server-safe component tree
 *
 * This mirrors the real App structure but:
 * - NO hooks (useState, useEffect, etc.)
 * - NO LiveComponentsProvider (dual-React crash)
 * - Server components render real HTML
 * - Client components wrapped in ClientBoundary markers
 *
 * After the server sends this HTML, the client bootstrap
 * finds the ClientBoundary markers and hydrates/renders
 * the real interactive components.
 */

import { Routes, Route } from 'react-router'
import { ClientBoundary } from '../../../plugins/bun-next/client-boundary'
import { HomePage } from './pages/HomePage'

/**
 * Server-safe layout shell — matches AppLayout structure without hooks
 */
function SSRLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation bar — static version */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <a href="/" className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                FluxStack
              </span>
            </a>
            <div className="hidden sm:flex items-center gap-1">
              {[
                { to: '/', label: 'Home' },
                { to: '/counter', label: 'Counter' },
                { to: '/form', label: 'Form' },
                { to: '/shared-counter', label: 'Shared Counter' },
                { to: '/room-chat', label: 'Room Chat' },
                { to: '/auth', label: 'Auth' },
              ].map(item => (
                <a
                  key={item.to}
                  href={item.to}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main>
        {children}
      </main>
    </div>
  )
}

/**
 * SSR-safe 404 page
 */
function SSR404() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-black text-white mb-4">404</h1>
      <p className="text-xl text-gray-400 mb-6">Pagina nao encontrada</p>
      <a
        href="/"
        className="px-6 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
      >
        Voltar ao inicio
      </a>
    </div>
  )
}

/**
 * Loading skeleton for client-only routes (live demos)
 */
function RouteLoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  )
}

/**
 * The SSR App — rendered server-side, then client takes over
 */
export function SSRApp() {
  return (
    <SSRLayout>
      <Routes>
        {/* HomePage is a server component — rendered to full HTML, zero client JS */}
        <Route path="/" element={<HomePage apiStatus="checking" />} />

        {/* Client-only routes — render skeleton, client bootstrap renders real component */}
        <Route path="/counter" element={
          <ClientBoundary component="app/client/src/live/CounterDemo" fallback={<RouteLoadingSkeleton label="Loading Counter..." />} />
        } />
        <Route path="/form" element={
          <ClientBoundary component="app/client/src/live/FormDemo" fallback={<RouteLoadingSkeleton label="Loading Form..." />} />
        } />
        <Route path="/upload" element={
          <ClientBoundary component="app/client/src/live/UploadDemo" fallback={<RouteLoadingSkeleton label="Loading Upload..." />} />
        } />
        <Route path="/shared-counter" element={
          <ClientBoundary component="app/client/src/live/SharedCounterDemo" fallback={<RouteLoadingSkeleton label="Loading Shared Counter..." />} />
        } />
        <Route path="/room-chat" element={
          <ClientBoundary component="app/client/src/live/RoomChatDemo" fallback={<RouteLoadingSkeleton label="Loading Room Chat..." />} />
        } />
        <Route path="/auth" element={
          <ClientBoundary component="app/client/src/live/AuthDemo" fallback={<RouteLoadingSkeleton label="Loading Auth..." />} />
        } />
        <Route path="/ping-pong" element={
          <ClientBoundary component="app/client/src/live/PingPongDemo" fallback={<RouteLoadingSkeleton label="Loading Ping Pong..." />} />
        } />
        <Route path="/api-test" element={
          <ClientBoundary component="app/client/src/pages/ApiTestPage" fallback={<RouteLoadingSkeleton label="Loading API Test..." />} />
        } />

        {/* 404 — server-rendered */}
        <Route path="*" element={<SSR404 />} />
      </Routes>
    </SSRLayout>
  )
}
