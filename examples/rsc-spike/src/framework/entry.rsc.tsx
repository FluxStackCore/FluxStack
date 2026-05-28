// ENTRY RSC (ambiente "react-server"). Default export = request handler.
// Serializa a árvore de Server Components em RSC stream e delega ao SSR.
import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { Root } from '../root'

export default async function handler(request: Request): Promise<Response> {
  const rscStream = renderToReadableStream(<Root />)

  // Requisição direta do payload RSC (navegação client-side): devolve o stream.
  if (request.url.endsWith('.rsc')) {
    return new Response(rscStream, {
      headers: { 'Content-type': 'text/x-component;charset=utf-8' },
    })
  }

  // Caso normal: SSR environment transforma payload -> HTML.
  const ssrEntry = await import.meta.viteRsc.loadModule<
    typeof import('./entry.ssr')
  >('ssr', 'index')
  const htmlStream = await ssrEntry.handleSsr(rscStream)

  return new Response(htmlStream, {
    headers: { 'Content-type': 'text/html' },
  })
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
