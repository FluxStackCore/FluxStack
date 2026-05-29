// ENTRY RSC do FluxStack. Default export = handler chamado pelo Elysia.
import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { RscDocument } from './RscRoot'
import { generateCsrfToken, buildCsrfCookie, CSRF_COOKIE } from './csrf'

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const isRscNav = url.pathname.endsWith('.rsc')
  const pathname = url.pathname.replace(/\.rsc$/, '') || '/'

  // CSRF via SSR: reusa o token do cookie se já existe; senão gera um novo.
  // O token vai como <meta name="csrf-token"> no HTML, então o client não
  // precisa fazer fetch('/api/__csrf') — nasce com o token (zero round-trip).
  const cookieHeader = request.headers.get('cookie') ?? ''
  const existing = cookieHeader.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`))?.[1]
  const csrfToken = existing ?? generateCsrfToken()

  const rscStream = renderToReadableStream(<RscDocument pathname={pathname} csrfToken={csrfToken} />)

  if (isRscNav) {
    return new Response(rscStream, {
      headers: { 'Content-type': 'text/x-component;charset=utf-8' },
    })
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<
    typeof import('./entry.ssr')
  >('ssr', 'index')
  const htmlStream = await ssrEntry.handleSsr(rscStream)

  const headers: Record<string, string> = { 'Content-type': 'text/html' }
  if (!existing) {
    // Seta o cookie só na primeira vez (secure em https).
    headers['Set-Cookie'] = buildCsrfCookie(csrfToken, url.protocol === 'https:')
  }
  return new Response(htmlStream, { headers })
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
