/**
 * SSR App — Uses the REAL AppLayout for server rendering
 *
 * The same layout component (AppLayout) runs on both server and client,
 * so the SSR HTML is visually identical to the client-rendered app.
 * Hooks work in SSR (useState returns initial state, useEffect is skipped).
 *
 * The entire tree is wrapped in a ClientBoundary for App.tsx — after the
 * server sends the HTML, the client loads App and takes over with full
 * interactivity (WebSocket, health check, SPA navigation).
 */

import { Routes, Route } from 'react-router'
import { ClientBoundary } from '../../../plugins/bun-next/client-boundary'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'

/**
 * Loading skeleton for client-only routes
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
 * The SSR App
 *
 * 1. Server renders the REAL AppLayout + route-matched content
 * 2. ClientBoundary wraps everything — bootstrap loads App.tsx and takes over
 * 3. Dev writes normal components — no SSR-specific code needed
 */
export function SSRApp() {
  return (
    <ClientBoundary
      component="app/client/src/App"
      mode="client-only"
      fallback={
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage apiStatus="checking" />} />
            <Route path="/counter" element={<RouteLoadingSkeleton label="Loading Counter..." />} />
            <Route path="/form" element={<RouteLoadingSkeleton label="Loading Form..." />} />
            <Route path="/upload" element={<RouteLoadingSkeleton label="Loading Upload..." />} />
            <Route path="/shared-counter" element={<RouteLoadingSkeleton label="Loading Shared Counter..." />} />
            <Route path="/room-chat" element={<RouteLoadingSkeleton label="Loading Room Chat..." />} />
            <Route path="/auth" element={<RouteLoadingSkeleton label="Loading Auth..." />} />
            <Route path="/ping-pong" element={<RouteLoadingSkeleton label="Loading Ping Pong..." />} />
            <Route path="/api-test" element={<RouteLoadingSkeleton label="Loading API Test..." />} />
            <Route path="*" element={<SSR404 />} />
          </Route>
        </Routes>
      }
    />
  )
}
