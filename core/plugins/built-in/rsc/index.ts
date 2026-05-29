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

type Plugin = FluxStack.Plugin
type RscHandler = (request: Request) => Promise<Response>

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

      // Cold-start (dev): a 1ª render pode suspender enquanto o grafo client
      // carrega; um retry cobre. Em prod o handler já está pronto (1 tentativa).
      const attempts = IS_DEV ? 2 : 1
      let response: Response | null = null
      for (let i = 0; i < attempts; i++) {
        try {
          const request = new Request(absoluteUrl(ctx), { method: ctx.method, headers: ctx.request.headers })
          response = await handler(request)
          break
        } catch (e) {
          if (i === attempts - 1) throw e
        }
      }
      if (response) {
        ctx.handled = true
        ctx.response = response
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[RSC] render failed for ${ctx.path}, falling back: ${msg}`)
    }
  },
}

export default rscPlugin
