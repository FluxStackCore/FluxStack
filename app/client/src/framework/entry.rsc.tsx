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

  // SRI-style integrity for plugin client-hooks: embed the hash of the legitimate
  // hooks in the trusted SSR HTML so the client can reject a tampered HTTP payload.
  // The hash is computed by the rscPlugin in the Elysia process (where the hooks
  // are registered) and passed via header — the RSC entry runs in an isolated
  // module environment where the pluginClientHooks singleton would be empty.
  const pluginHooksHash = request.headers.get('x-plugin-hooks-hash') ?? undefined

  const rscStream = renderToReadableStream(
    <RscDocument pathname={pathname} csrfToken={csrfToken} pluginHooksHash={pluginHooksHash} />,
  )

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
