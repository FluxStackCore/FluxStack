/**
 * FluxStack SSR Routes (PoC)
 *
 * Rota de demonstração que renderiza React no servidor e devolve HTML pronto.
 * Fora do prefixo /api porque devolve text/html, não JSON.
 *
 * IMPORTANTE: '/ssr-demo' precisa estar em VITE_EXCLUDE_PATHS (plugins.config.ts)
 * para que o proxy do Vite (em dev) não intercepte a rota antes do Elysia.
 */

import { Elysia } from 'elysia'
import { renderSsrDemo, renderDocument } from '../ssr/render'
import { renderAppHtml, renderAppDocument } from '../ssr/renderApp'
import { clientConfig } from '@config'

export const ssrRoutes = new Elysia({ tags: ['SSR'] })
  .get('/ssr-demo', () => {
    const result = renderSsrDemo('/ssr-demo', {
      renderedAt: new Date().toISOString(),
      counter: 42,
    })

    return new Response(renderDocument(result), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  })

  // SSR do site REAL. Renderiza o <App/> para o path pedido.
  // GET /ssr           -> renderiza a home ('/')
  // GET /ssr/counter   -> renderiza a rota '/counter', etc.
  .get('/ssr', ({ request }) => renderSite(request, '/'))
  .get('/ssr/*', ({ request, params }) => renderSite(request, '/' + (params['*'] ?? '')))

function renderSite(request: Request, appPath: string): Response {
  try {
    const appHtml = renderAppHtml(appPath)
    const vite = {
      host: (clientConfig.vite.host as string) || 'localhost',
      port: (clientConfig.vite.port as number) || 5173,
    }
    return new Response(renderAppDocument(appHtml, vite), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack}` : String(err)
    return new Response(`SSR render error:\n\n${msg}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
