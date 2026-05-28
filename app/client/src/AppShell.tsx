/**
 * AppShell — versão SSR-safe do site (PoC Caminho A).
 *
 * Renderiza o MESMO layout e as rotas estáticas do site, MAS sem o
 * LiveComponentsProvider. Motivo arquitetural (ver plano RSC fase 4):
 * os LiveComponents dependem de WebSocket, que não existe no server.
 * No SSR eles são "ilhas" que só montam/conectam no client após hydration.
 *
 * As rotas Live (form, counter, chat...) renderizam um placeholder no server;
 * o client troca pelo componente real quando hidrata. As rotas estáticas
 * (Home, API-test, 404) renderizam idênticas no server e no client.
 *
 * O App.tsx (SPA puro) continua intocado e é o caminho de produção atual.
 * Este shell é o ponto de partida para o SSR incremental.
 */
import { Routes, Route, useLocation } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'

function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-black text-white mb-4">404</h1>
      <p className="text-xl text-gray-400 mb-6">Pagina nao encontrada</p>
      <p className="text-sm text-gray-500 mb-8">
        O caminho <code className="text-theme">{pathname}</code> nao existe.
      </p>
    </div>
  )
}

/** Placeholder para rotas que dependem de LiveComponents (ilhas client) */
function LiveIsland({ name }: { name: string }) {
  return (
    <div
      data-live-island={name}
      className="rounded-xl border border-theme-active bg-theme-muted p-8 text-center"
    >
      <p className="text-theme">⚡ Carregando componente live: <strong>{name}</strong></p>
      <p className="text-sm text-gray-500 mt-2">
        Este bloco conecta ao WebSocket após a hydration no client.
      </p>
    </div>
  )
}

export function AppShell() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage apiStatus="checking" />} />
        <Route path="/form" element={<LiveIsland name="LiveForm" />} />
        <Route path="/counter" element={<LiveIsland name="LiveCounter" />} />
        <Route path="/shared-counter" element={<LiveIsland name="SharedCounter" />} />
        <Route path="/room-chat" element={<LiveIsland name="RoomChat" />} />
        <Route path="/auth" element={<LiveIsland name="Auth" />} />
        <Route path="/ping-pong" element={<LiveIsland name="PingPong" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default AppShell
