// ENTRY RSC do FluxStack. Default export = handler chamado pelo Elysia.
import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { RscDocument } from './RscRoot'
import { generateCsrfToken, buildCsrfCookie, CSRF_COOKIE } from './csrf'
import { matchRoute } from './routes'

/** Diretiva de cache da página → header lido pelo rscPlugin (override estilo Next).
 *  'off' = não cacheia esta rota; 'ttl:<n>' = cacheia com TTL custom. */
function cacheDirectiveHeader(pathname: string): string | null {
  const c = matchRoute(pathname)?.route.cache
  if (c === false) return 'off'
  if (c && typeof c === 'object' && typeof c.revalidate === 'number') return `ttl:${c.revalidate}`
  return null // sem diretiva → comportamento padrão do plugin
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const isRscNav = url.pathname.endsWith('.rsc')
  const pathname = url.pathname.replace(/\.rsc$/, '') || '/'

  // CSRF via SSR (model Next): o token vai SÓ no cookie XSRF-TOKEN (não no HTML),
  // então o HTML é user-agnostic e cacheável. O client lê o token do cookie.
  // Geramos/setamos o cookie quando ainda não existe.
  const cookieHeader = request.headers.get('cookie') ?? ''
  const existing = cookieHeader.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`))?.[1]

  // O hash dos plugin client-hooks (SRI) é estável e vem via header do rscPlugin
  // (o entry roda em ambiente isolado onde o singleton de hooks está vazio).
  const pluginHooksHash = request.headers.get('x-plugin-hooks-hash') ?? undefined

  // Diretiva de cache declarada pela página (override) → header pro rscPlugin.
  const cacheDirective = cacheDirectiveHeader(pathname)

  const rscStream = renderToReadableStream(
    <RscDocument pathname={pathname} pluginHooksHash={pluginHooksHash} />,
  )

  if (isRscNav) {
    const headers: Record<string, string> = { 'Content-type': 'text/x-component;charset=utf-8' }
    if (cacheDirective) headers['x-rsc-cache'] = cacheDirective
    return new Response(rscStream, { headers })
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<
    typeof import('./entry.ssr')
  >('ssr', 'index')
  const htmlStream = await ssrEntry.handleSsr(rscStream)

  const headers: Record<string, string> = { 'Content-type': 'text/html' }
  if (cacheDirective) headers['x-rsc-cache'] = cacheDirective
  if (!existing) {
    // 1ª visita: emite um token novo via Set-Cookie (secure em https).
    headers['Set-Cookie'] = buildCsrfCookie(generateCsrfToken(), url.protocol === 'https:')
  }
  return new Response(htmlStream, { headers })
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
