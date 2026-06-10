// SERVER COMPONENTS do site FluxStack via RSC — agora com roteamento FILE-BASED.
//
// O dev NÃO edita este arquivo para adicionar páginas: basta criar um arquivo em
// app/client/src/pages/ (ver framework/routes.ts). Aqui só montamos a casca
// (navbar + a página que casa com o pathname) a partir do mapa descoberto.
import '../index.css' // Tailwind + temas
import { RscNav } from './RscNav'
import { routes, matchRoute } from './routes'

function NotFound({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-black text-white">404</h1>
      <p className="text-gray-400">A rota <code className="text-theme">{pathname}</code> não existe.</p>
      <a href="/" className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black">Voltar ao início</a>
    </div>
  )
}

/** Conteúdo da rota (nav + página). É o que as navegações client buscam (.rsc). */
export function RscPage({ pathname = '/' }: { pathname?: string }) {
  const match = matchRoute(pathname)
  return (
    <>
      <RscNav active={pathname} />
      {match
        ? <match.route.Component params={match.params} />
        : <NotFound pathname={pathname} />}
    </>
  )
}

/** Documento completo. Controle client (navegação + keep-alive WS) vive no
 *  entry.browser; o body renderiza o RscPage direto.
 *  csrfToken: injetado pelo server p/ o client não precisar fazer fetch('/api/__csrf'). */
export function RscDocument({ pathname = '/', csrfToken, pluginHooksHash }: { pathname?: string; csrfToken?: string; pluginHooksHash?: string }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {csrfToken && <meta name="csrf-token" content={csrfToken} />}
        {/* SRI-style integrity for plugin client-hooks — see pluginHooksHash.ts */}
        {pluginHooksHash && <meta name="plugin-hooks-hash" content={pluginHooksHash} />}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>FluxStack</title>
      </head>
      <body>
        <RscPage pathname={pathname} />
      </body>
    </html>
  )
}

// re-export para conveniência
export { routes }
