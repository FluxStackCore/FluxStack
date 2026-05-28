/**
 * SSR do App REAL do FluxStack (PoC — Caminho A).
 *
 * Renderiza o <App/> completo no servidor via renderToString + StaticRouter,
 * para a URL pedida. Os LiveComponents NÃO conectam ao WebSocket aqui: o
 * LiveComponentsProvider só chama connect() quando `typeof document/window`
 * existem, então no server ele renderiza inerte (estado inicial). A conexão
 * acontece no client após a hydration — o "melhor dos dois mundos".
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AppShell } from '@client/src/AppShell'

export function renderAppHtml(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppShell />
    </StaticRouter>
  )
}

/**
 * Documento HTML do site em modo SSR.
 *
 * Em DEV o script de hydration vem do Vite dev server (:5173), que transpila
 * o TSX on-the-fly. Precisa do client do Vite (@vite/client) para HMR e do
 * preâmbulo do React Refresh, senão o plugin-react quebra na hydration.
 */
export function renderAppDocument(appHtml: string, vite: { host: string; port: number }): string {
  const viteBase = `http://${vite.host}:${vite.port}`
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FluxStack (SSR)</title>
    <script type="module">
      import RefreshRuntime from "${viteBase}/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>
    <script type="module" src="${viteBase}/@vite/client"></script>
  </head>
  <body>
    <div id="root">${appHtml}</div>
    <script type="module" src="${viteBase}/src/entry-ssr.tsx"></script>
  </body>
</html>`
}
