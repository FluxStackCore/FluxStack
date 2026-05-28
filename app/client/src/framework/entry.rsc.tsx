// ENTRY RSC do FluxStack. Default export = handler chamado pelo Elysia.
import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { RscPage, RscDocument } from './RscRoot'

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const isRscNav = url.pathname.endsWith('.rsc')
  const pathname = url.pathname.replace(/\.rsc$/, '') || '/'

  // Navegação client (.rsc): só o CONTEÚDO da rota (shell client persiste).
  // Primeira carga: documento completo (<html> + RootClient com o Provider).
  const tree = isRscNav ? <RscPage pathname={pathname} /> : <RscDocument pathname={pathname} />
  const rscStream = renderToReadableStream(tree)

  if (isRscNav) {
    return new Response(rscStream, {
      headers: { 'Content-type': 'text/x-component;charset=utf-8' },
    })
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<
    typeof import('./entry.ssr')
  >('ssr', 'index')
  const htmlStream = await ssrEntry.handleSsr(rscStream)

  return new Response(htmlStream, { headers: { 'Content-type': 'text/html' } })
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
