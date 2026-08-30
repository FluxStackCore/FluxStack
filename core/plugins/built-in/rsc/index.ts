/**
 * FluxStack RSC Plugin
 *
 * Serve React Server Components pelo proxy interno do FluxStack (Elysia), em vez
 * do middleware próprio do @vitejs/plugin-rsc. Prioridade 860 > ssr (850) >
 * vite (800): intercepta rotas de página antes deles. Só age se RSC_ENABLED=true.
 *
 * DEV: chama o handler do ambiente Vite `rsc` via runner (Vite dev server).
 * PROD: importa o handler RSC BUILDADO (app/client/dist/rsc/index.js, default) e
 *   serve os assets buildados (app/client/dist/client/assets). Sem Vite em prod.
 *
 * Em erro NÃO trata (fallback pro Vite/SPA). Requer o Vite criado com
 * rsc({serverHandler:false}) — ver vite.config.ts (condicionado a RSC_ENABLED).
 */

import type { FluxStack, PluginContext, RequestContext } from '@core/plugins/types'
import { FLUXSTACK_VERSION } from '@core/utils/version'
import { isDevelopment } from '@core/utils/helpers'
import { clientConfig, pluginsConfig } from '@config'
import { isRunnableDevEnvironment } from 'vite'
import { join } from 'path'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { pluginClientHooks } from '@core/server/plugin-client-hooks'
import { normalizeCacheKey, makeCachedPage, parseCacheDirective, type CachedPage } from '@server/cache/RscPageCache'
import { cacheManager, type CacheDriver } from '@server/cache'
import { generateCsrfToken, buildCsrfCookie, CSRF_COOKIE } from '@client/src/framework/csrf'
import { sessionConfig } from '@config'

/**
 * Hash of the registered plugin client-hooks, computed HERE in the Elysia
 * process where the hooks are actually registered. The RSC entry runs in an
 * isolated Vite environment with a SEPARATE module instance of pluginClientHooks
 * (empty there), so we pass the trusted hash via a request header instead of
 * letting the RSC entry read the singleton. Must match the client's
 * computeHooksHash (sha256 of JSON.stringify(hooks)).
 */
function pluginHooksHash(): string {
  const canonical = JSON.stringify(pluginClientHooks.getHooks())
  return 'sha256-' + createHash('sha256').update(canonical).digest('hex')
}

type Plugin = FluxStack.Plugin
type RscHandler = (request: Request) => Promise<Response>

// ── Page cache (SSR/RSC) — storage delegated to the pluggable CacheDriver ────
const pcfg = pluginsConfig as Record<string, unknown>
const CACHE_ENABLED = (pcfg.rscCacheEnabled ?? true) === true && !isDevelopment() // off in dev (HMR)
const CACHE_TTL = Number(pcfg.rscCacheTtl ?? 60)             // segundos (server + s-maxage CDN)
const CDN_MAX_AGE = CACHE_TTL
const SWR = Number(pcfg.rscCacheSwr ?? CDN_MAX_AGE)          // stale-while-revalidate
const BROWSER_MAX_AGE = Number(pcfg.rscCacheBrowserMaxAge ?? 0)
const MAX_ENTRY_BYTES = Number(pcfg.rscCacheMaxEntryBytes ?? 1_000_000)

/**
 * Driver programado pelo dev. O FluxStack só define o CONTRATO (`CacheDriver`);
 * o dev implementa o storage que quiser (qualquer um — `class MeuDriver
 * implements CacheDriver {}`) e o injeta aqui, em código:
 *
 *   import { setRscCacheDriver } from '@core/plugins/built-in/rsc'
 *   setRscCacheDriver(new MeuDriver())   // antes de framework.use(rscPlugin)
 *
 * Se não for setado, usa o driver de cache padrão do app (memory). O framework
 * é neutro: não conhece Redis/Memcached/etc — é escolha de cada dev.
 */
let customDriver: CacheDriver | null = null

/** Programa o driver de cache de página. Aceita qualquer `CacheDriver`. */
export function setRscCacheDriver(driver: CacheDriver | null): void {
  customDriver = driver
}

/** Resolve o driver: o programado pelo dev, senão o padrão do app (memory). */
function pageStore(): CacheDriver {
  return customDriver ?? cacheManager.driver()
}

const SESSION_COOKIE = (sessionConfig as { cookieName?: string }).cookieName ?? 'fluxstack_session'

/** A request is cacheable only when public + GET + no query + no auth session. */
function isCacheable(ctx: RequestContext): boolean {
  if (!CACHE_ENABLED) return false
  const url = new URL(absoluteUrl(ctx))
  if (url.search !== '') return false // query string → dynamic, don't cache
  const cookie = ctx.request.headers.get('cookie') ?? ''
  if (cookie.includes(`${SESSION_COOKIE}=`)) return false // authenticated → per-user content
  const cc = ctx.request.headers.get('cache-control') ?? ''
  if (cc.includes('no-store')) return false
  return true
}

/** Set-Cookie do CSRF token quando o usuário ainda não tem (1ª visita). O token
 *  vai SÓ no cookie (não no HTML), então o cookie é setado por-request mesmo
 *  servindo HTML cacheado — é o que mantém o token único por usuário. */
function csrfSetCookie(ctx: RequestContext): string | null {
  const cookie = ctx.request.headers.get('cookie') ?? ''
  if (new RegExp(`${CSRF_COOKIE}=`).test(cookie)) return null // já tem
  const secure = new URL(absoluteUrl(ctx)).protocol === 'https:'
  return buildCsrfCookie(generateCsrfToken(), secure)
}

/** Build a Response from a user-agnostic cached page. Public Cache-Control so a
 *  CDN can serve it; the per-user CSRF cookie is set separately per-request.
 *  `ttl` (segundos) controla o s-maxage do CDN (override por página). */
function serveCached(
  ctx: RequestContext,
  entry: { html: string; etag: string; contentType: string },
  isRscNav: boolean,
  ttl: number = CDN_MAX_AGE,
): Response {
  const headers: Record<string, string> = {
    'Content-Type': entry.contentType,
    ETag: entry.etag,
    // User-agnostic HTML → cacheable by shared caches/CDN. `s-maxage` é o TTL do
    // CDN; `stale-while-revalidate` serve stale enquanto revalida em background.
    'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${SWR}` +
      (BROWSER_MAX_AGE > 0 ? `, max-age=${BROWSER_MAX_AGE}` : ''),
  }
  if (ctx.request.headers.get('if-none-match') === entry.etag) {
    return new Response(null, { status: 304, headers })
  }
  // O cookie do CSRF NÃO faz parte do corpo cacheado — setado por-request aqui.
  const setCookie = isRscNav ? null : csrfSetCookie(ctx)
  if (setCookie) headers['Set-Cookie'] = setCookie
  return new Response(entry.html, { headers })
}

/** Resposta dinâmica (página optou por 'off'): não cacheável por ninguém. */
function withNoStore(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.delete('x-rsc-cache')
  headers.set('Cache-Control', 'private, no-store')
  return new Response(response.body, { status: response.status, headers })
}

const PLUGIN_PRIORITY = 860 // > ssr (850) > vite (800)
const IS_DEV = isDevelopment()

/** id do entry rsc no runner (dev) — relativo ao root app/client */
const RSC_ENTRY_ID = '/src/framework/entry.rsc.tsx'
/** caminho do handler RSC buildado (prod) e dos assets do client */
const PROD_RSC_HANDLER = join(process.cwd(), 'app', 'client', 'dist', 'rsc', 'index.js')
const PROD_CLIENT_DIR = join(process.cwd(), 'app', 'client', 'dist', 'client')

const ASSET_EXT = /\.(js|mjs|ts|tsx|jsx|css|map|json|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|wasm|txt|xml|webmanifest)$/i
const PASSTHROUGH_PREFIXES = ['/@', '/src/', '/node_modules/', '/api', '/swagger', '/__plugins']

function isPageRoute(path: string): boolean {
  if (ASSET_EXT.test(path)) return false
  return !PASSTHROUGH_PREFIXES.some((p) => path === p || path.startsWith(p))
}

/** Vite dev server (dev) — capturado do vitePlugin. */
let viteServer: { environments: Record<string, unknown> } | null = null
/** Handler RSC buildado (prod) — importado uma vez e cacheado. */
let prodHandler: RscHandler | null = null

/** Normaliza a URL da request para absoluta (handler RSC precisa de URL completa). */
function absoluteUrl(ctx: RequestContext): string {
  try {
    return new URL(ctx.request.url).href
  } catch {
    const host = ctx.request.headers.get('host') || `${clientConfig.vite.host}:3000`
    const proto = ctx.request.headers.get('x-forwarded-proto') || 'http'
    const q = ctx.request.url.indexOf('?')
    const search = q === -1 ? '' : ctx.request.url.slice(q)
    return `${proto}://${host}${ctx.path}${search}`
  }
}

/** Resolve o handler RSC (dev via runner, prod via import do build). */
async function getHandler(): Promise<RscHandler | null> {
  if (IS_DEV) {
    if (!viteServer) return null
    const rscEnv = viteServer.environments.rsc
    if (!rscEnv || !isRunnableDevEnvironment(rscEnv as never)) return null
    const mod = await (rscEnv as { runner: { import: (id: string) => Promise<{ default: RscHandler }> } })
      .runner.import(RSC_ENTRY_ID)
    return mod.default
  }
  // prod: importa o handler buildado uma vez
  if (!prodHandler) {
    if (!existsSync(PROD_RSC_HANDLER)) return null
    const mod = await import(/* @vite-ignore */ PROD_RSC_HANDLER) as { default: RscHandler }
    prodHandler = mod.default
  }
  return prodHandler
}

export const rscPlugin: Plugin = {
  name: 'rsc',
  version: FLUXSTACK_VERSION,
  description: 'React Server Components served through the FluxStack proxy',
  author: 'FluxStack Team',
  priority: PLUGIN_PRIORITY,
  category: 'rendering',
  tags: ['rsc', 'react', 'server-components'],
  dependencies: [],

  setup: async (context: PluginContext) => {
    if (!(pluginsConfig as Record<string, unknown>).rscEnabled) {
      context.logger.debug('RSC plugin disabled (set RSC_ENABLED=true)')
      return
    }
    if (!IS_DEV && !existsSync(PROD_RSC_HANDLER)) {
      context.logger.warn(`RSC: handler buildado não encontrado (${PROD_RSC_HANDLER}). Rode o build com RSC_ENABLED=true.`)
      return
    }
    context.logger.debug(`RSC plugin active (priority ${PLUGIN_PRIORITY}, ${IS_DEV ? 'dev' : 'prod'})`)
  },

  // DEV: captura o Vite dev server (do vitePlugin) para o runner.
  onServerStart: async (context: PluginContext) => {
    if (!(pluginsConfig as Record<string, unknown>).rscEnabled || !IS_DEV) return
    const cfg = (context as PluginContext & { viteConfig?: { server?: unknown } }).viteConfig
    if (cfg?.server) {
      viteServer = cfg.server as { environments: Record<string, unknown> }
      context.logger.debug('RSC: Vite dev server capturado para o runner')
    }
  },

  onBeforeRoute: async (ctx: RequestContext) => {
    if (!(pluginsConfig as Record<string, unknown>).rscEnabled) return
    if (ctx.method !== 'GET') return

    // PROD: servir assets buildados (/assets/*, /favicon.svg) do dist/client.
    if (!IS_DEV && !isPageRoute(ctx.path)) {
      const assetPath = join(PROD_CLIENT_DIR, ctx.path)
      if (ctx.path !== '/' && existsSync(assetPath)) {
        ctx.handled = true
        ctx.response = new Response(Bun.file(assetPath))
      }
      return
    }
    if (!isPageRoute(ctx.path)) return // dev: assets vão pro Vite

    try {
      const handler = await getHandler()
      if (!handler) return // sem handler → fallback

      const cacheable = isCacheable(ctx)
      const { key, isRscNav } = normalizeCacheKey(ctx.path)

      // Cache HIT: serve the user-agnostic cached page (CSRF cookie set per-request).
      if (cacheable) {
        const hit = await pageStore().get<CachedPage>(key)
        if (hit) {
          ctx.handled = true
          ctx.response = serveCached(ctx, hit, isRscNav)
          return
        }
      }

      // Cold-start (dev): a 1ª render pode suspender enquanto o grafo client
      // carrega; um retry cobre. Em prod o handler já está pronto (1 tentativa).
      const attempts = IS_DEV ? 2 : 1
      let response: Response | null = null
      for (let i = 0; i < attempts; i++) {
        try {
          // Pass the trusted plugin-hooks hash (computed in THIS process where the
          // hooks are registered) so the RSC entry can embed it for SRI-style
          // integrity, despite running in an isolated module environment.
          const headers = new Headers(ctx.request.headers)
          headers.set('x-plugin-hooks-hash', pluginHooksHash())
          const request = new Request(absoluteUrl(ctx), { method: ctx.method, headers })
          response = await handler(request)
          break
        } catch (e) {
          if (i === attempts - 1) throw e
        }
      }
      if (response) {
        // Override por página (estilo Next): a página pode setar 'x-rsc-cache'.
        //   'off'      → nunca cacheia esta rota (mesmo sendo pública)
        //   'ttl:<n>'  → cacheia com TTL custom
        //   ausente    → comportamento padrão (cacheia se `cacheable`, TTL default)
        const { off: pageOff, ttl: pageTtl } = parseCacheDirective(response.headers.get('x-rsc-cache'))

        if (cacheable && !pageOff) {
          // MISS: materialize the stream (HTML is user-agnostic — no token in it),
          // cache it via the pluggable driver, then serve. Skip caching huge renders.
          const html = await response.text()
          const contentType = response.headers.get('content-type') || (isRscNav ? 'text/x-component;charset=utf-8' : 'text/html')
          const entry = makeCachedPage(html, contentType)
          const ttl = pageTtl && pageTtl > 0 ? pageTtl : CACHE_TTL
          if (Buffer.byteLength(html, 'utf8') <= MAX_ENTRY_BYTES) {
            await pageStore().set<CachedPage>(key, entry, ttl)
          }
          ctx.handled = true
          ctx.response = serveCached(ctx, entry, isRscNav, ttl)
        } else {
          // Não-cacheável (query/sessão) OU a página optou por 'off' → resposta
          // dinâmica: dynamic Cache-Control e sem armazenar.
          ctx.handled = true
          ctx.response = pageOff ? withNoStore(response) : response
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[RSC] render failed for ${ctx.path}, falling back: ${msg}`)
    }
  },
}

export default rscPlugin
