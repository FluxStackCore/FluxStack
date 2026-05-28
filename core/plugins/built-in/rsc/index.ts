/**
 * FluxStack RSC Plugin
 *
 * Serve React Server Components pelo proxy interno do FluxStack (Elysia),
 * em vez do middleware próprio do @vitejs/plugin-rsc. O Elysia chama o handler
 * do ambiente Vite `rsc` via runner e devolve a Response (HTML ou payload .rsc).
 *
 * Prioridade 860 > ssr (850) > vite (800): intercepta rotas de página antes de
 * ambos. Só age se RSC_ENABLED=true. Em erro NÃO trata (fallback pro Vite/SPA).
 *
 * Requer o Vite criado com o plugin rsc({serverHandler:false}) — ver vite.config.ts
 * (condicionado a RSC_ENABLED) e os entries em app/client/src/framework/.
 *
 * DEV apenas nesta fase. PROD (build dos 3 ambientes) é fase 2 — ver TODO.
 */

import type { FluxStack, PluginContext, RequestContext } from '@core/plugins/types'
import { FLUXSTACK_VERSION } from '@core/utils/version'
import { isDevelopment } from '@core/utils/helpers'
import { clientConfig, pluginsConfig } from '@config'
import { isRunnableDevEnvironment } from 'vite'

type Plugin = FluxStack.Plugin

const PLUGIN_PRIORITY = 860 // > ssr (850) > vite (800)
const IS_DEV = isDevelopment()

/** id do entry rsc no runner (validado via probe: relativo ao root app/client) */
const RSC_ENTRY_ID = '/src/framework/entry.rsc.tsx'

/** Extensões de asset — nunca página (mas .rsc PASSA: o handler trata) */
const ASSET_EXT = /\.(js|mjs|ts|tsx|jsx|css|map|json|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|wasm|txt|xml|webmanifest)$/i
/** Prefixos internos (Vite/API) que nunca são página */
const PASSTHROUGH_PREFIXES = ['/@', '/src/', '/node_modules/', '/api', '/swagger', '/__plugins']

function isPageRoute(path: string): boolean {
  if (ASSET_EXT.test(path)) return false
  return !PASSTHROUGH_PREFIXES.some((p) => path === p || path.startsWith(p))
}

/** Guarda a instância do Vite dev server (setada no setup do vitePlugin) */
let viteServer: { environments: Record<string, unknown> } | null = null

/** Normaliza a URL da request para absoluta (handler RSC precisa de URL completa) */
function absoluteUrl(ctx: RequestContext): string {
  try {
    // se já é absoluta, mantém
    return new URL(ctx.request.url).href
  } catch {
    const host = ctx.request.headers.get('host') || `${clientConfig.vite.host}:3000`
    const proto = ctx.request.headers.get('x-forwarded-proto') || 'http'
    const search = (() => {
      const q = ctx.request.url.indexOf('?')
      return q === -1 ? '' : ctx.request.url.slice(q)
    })()
    return `${proto}://${host}${ctx.path}${search}`
  }
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
    if (!IS_DEV) {
      context.logger.warn('RSC plugin: produção ainda não suportada (build dos 3 ambientes pendente)')
      return
    }
    context.logger.debug(`RSC plugin active (priority ${PLUGIN_PRIORITY})`)
  },

  // Captura a instância do Vite dev server quando o vitePlugin a publica.
  onServerStart: async (context: PluginContext) => {
    if (!(pluginsConfig as Record<string, unknown>).rscEnabled || !IS_DEV) return
    const cfg = (context as PluginContext & { viteConfig?: { server?: unknown } }).viteConfig
    if (cfg?.server) {
      viteServer = cfg.server as { environments: Record<string, unknown> }
      context.logger.debug('RSC: Vite dev server capturado para o runner')
    }
  },

  onBeforeRoute: async (ctx: RequestContext) => {
    if (!(pluginsConfig as Record<string, unknown>).rscEnabled || !IS_DEV) return
    if (ctx.method !== 'GET') return
    if (!isPageRoute(ctx.path)) return

    if (!viteServer) return // server ainda não capturado → fallback

    try {
      const rscEnv = viteServer.environments.rsc
      if (!rscEnv || !isRunnableDevEnvironment(rscEnv as never)) return

      const mod = await (rscEnv as { runner: { import: (id: string) => Promise<{ default: (r: Request) => Promise<Response> }> } })
        .runner.import(RSC_ENTRY_ID)

      // Cold-start: na PRIMEIRA renderização de cada processo dev, o grafo de
      // módulos client (ilhas Live) ainda não está resolvido e o SSR suspende,
      // falhando uma vez. A partir daí fica cacheado. Um retry cobre isso sem
      // afetar o usuário (a 2ª tentativa já tem o grafo pronto).
      let response: Response | null = null
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const request = new Request(absoluteUrl(ctx), { method: ctx.method, headers: ctx.request.headers })
          response = await mod.default(request)
          break
        } catch (e) {
          if (attempt === 1) throw e // segunda falha é real
        }
      }
      if (response) {
        ctx.handled = true
        ctx.response = response
      }
    } catch (err) {
      // Falha no RSC → não trata, deixa o Vite/SPA servir (graceful degradation).
      const msg = err instanceof Error ? err.stack ?? err.message : String(err)
      console.error(`[RSC] render failed for ${ctx.path}, falling back to SPA:`, msg)
    }
  },
}

export default rscPlugin
