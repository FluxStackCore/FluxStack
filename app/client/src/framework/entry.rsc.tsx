// ENTRY RSC do FluxStack. Default export = handler chamado pelo Elysia.
import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { RscDocument } from './RscRoot'

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const isRscNav = url.pathname.endsWith('.rsc')
  const pathname = url.pathname.replace(/\.rsc$/, '') || '/'

  // Sempre renderiza o DOCUMENTO completo (RscDocument) — tanto na primeira
  // carga (vira HTML via SSR) quanto na navegação (.rsc, re-render do root).
  // O entry.browser re-renderiza o mesmo React root com este payload, então
  // a árvore precisa ser coerente (documento inteiro) nas duas situações.
  const rscStream = renderToReadableStream(<RscDocument pathname={pathname} />)

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
