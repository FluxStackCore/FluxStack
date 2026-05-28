// SERVER COMPONENTS do site FluxStack via RSC.
//
// Duas funções:
// - RscPage(pathname): retorna SÓ o conteúdo da rota (nav + página). É isto que
//   as NAVEGAÇÕES client buscam (.rsc) — sem <html>, sem Provider, então o shell
//   client (RootClient) e a conexão WebSocket permanecem vivos.
// - RscDocument(pathname): a primeira carga (SSR) — <html> + <RootClient> que
//   envolve o RscPage como conteúdo inicial. O Provider vive no RootClient.
import '../index.css' // Tailwind + temas
import { RscHomePage } from './RscHomePage'
import { RscNav } from './RscNav'
import {
  CounterIsland,
  FormIsland,
  SharedCounterIsland,
  RoomChatIsland,
  AuthIsland,
  PingPongIsland,
} from './DemoIslands'

function DemoPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-57px)] px-4 py-10">
      <div className="absolute inset-0 app-grid-bg opacity-70" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

const ROUTES: Record<string, React.ReactNode> = {
  '/counter': <DemoPage title="Counters" description="Estado local, sala isolada e sala compartilhada em tempo real."><CounterIsland /></DemoPage>,
  '/form': <DemoPage title="Live Form" description="Formulário com campos sincronizados pelo servidor via proxy Live."><FormIsland /></DemoPage>,
  '/shared-counter': <DemoPage title="Shared Counter" description="Sala global sincroniza usuários e estado entre abas."><SharedCounterIsland /></DemoPage>,
  '/room-chat': <DemoPage title="Room Chat" description="Chat multi-sala usando o sistema $room."><RoomChatIsland /></DemoPage>,
  '/auth': <DemoPage title="Auth" description="Autenticação declarativa para Live Components com $auth."><AuthIsland /></DemoPage>,
  '/ping-pong': <DemoPage title="Ping-Pong" description="Latency demo com codec binário msgpack no WebSocket."><PingPongIsland /></DemoPage>,
}

function NotFound({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-black text-white">404</h1>
      <p className="text-gray-400">A rota <code className="text-theme">{pathname}</code> não existe.</p>
      <a href="/" className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black">Voltar ao início</a>
    </div>
  )
}

/** Conteúdo da rota (nav + página). É o que as navegações client buscam. */
export function RscPage({ pathname = '/' }: { pathname?: string }) {
  let page: React.ReactNode
  if (pathname === '/') {
    page = (
      <>
        <RscHomePage />
        <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 pb-16">
          <h2 className="text-lg font-semibold text-white">Live Component (client island)</h2>
          <p className="text-sm text-gray-500">Server component acima · usa a MESMA conexão WebSocket do shell</p>
          <CounterIsland />
        </section>
      </>
    )
  } else {
    page = ROUTES[pathname] ?? <NotFound pathname={pathname} />
  }
  return (
    <>
      <RscNav active={pathname} />
      {page}
    </>
  )
}

/** Documento completo. O controle client (navegação + keep-alive WS) vive no
 *  entry.browser, não aqui — então o body renderiza o RscPage direto. */
export function RscDocument({ pathname = '/' }: { pathname?: string }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>FluxStack</title>
      </head>
      <body>
        <RscPage pathname={pathname} />
      </body>
    </html>
  )
}
