/**
 * FluxStack SSR Plugin
 *
 * Renderiza o HTML do app no servidor (renderToString) para rotas de PÁGINA,
 * substituindo o `<div id="root"></div>` vazio do SPA por markup pronto.
 * Os assets (JS/CSS/imagens, /@vite, /src/*) continuam servidos pelo Vite (dev)
 * ou pelo static fallback (prod) — o SSR só intercepta navegação de página.
 *
 * Ordem: prioridade 850 > vite (800), então o onBeforeRoute do SSR roda ANTES
 * do proxy do Vite. Se o SSR tratar a request (handled=true), o Vite não vê.
 *
 * O renderer do app é injetado via registry (registerSsrRenderer) — o core não
 * conhece o React do app. Ver ./registry.ts.
 *
 * LIMITAÇÃO ATUAL (PoC): pipeline de hydration montado para DEV (Vite :5173).
 * Produção (sem Vite dev) precisa apontar para os assets buildados — TODO abaixo.
 */

import type { FluxStack, PluginContext, RequestContext } from '@core/plugins/types'
import { FLUXSTACK_VERSION } from '@core/utils/version'
import { isDevelopment } from '@core/utils/helpers'
import { clientConfig, pluginsConfig } from '@config'
import { getSsrRenderer } from './registry'

type Plugin = FluxStack.Plugin

const PLUGIN_PRIORITY = 850 // > vite (800): intercepta páginas antes do proxy Vite
const IS_DEV = isDevelopment()

/** Extensões de asset — nunca devem ser tratadas como página */
const ASSET_EXT = /\.(js|mjs|ts|tsx|jsx|css|map|json|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|wasm|txt|xml|webmanifest)$/i

/** Prefixos internos (Vite/API/dev) que NUNCA são páginas — passam direto */
const PASSTHROUGH_PREFIXES = ['/@', '/src/', '/node_modules/', '/api', '/swagger', '/__plugins']

/** Decide se um path é uma rota de PÁGINA (candidata a SSR) */
function isPageRoute(path: string): boolean {
  if (ASSET_EXT.test(path)) return false
  return !PASSTHROUGH_PREFIXES.some((p) => path === p || path.startsWith(p))
}

/** Monta o documento HTML completo com o markup SSR + pipeline de hydration */
function buildDocument(opts: {
  appHtml: string
  bootstrapData?: Record<string, unknown>
  headTags?: string
}): string {
  const { appHtml, bootstrapData, headTags = '' } = opts

  const viteHost = (clientConfig.vite.host as string) || 'localhost'
  const vitePort = (clientConfig.vite.port as number) || 5173
  const viteBase = `http://${viteHost}:${vitePort}`
  const entry = (pluginsConfig as Record<string, unknown>).ssrClientEntry as string | undefined
    ?? '/src/entry-ssr.tsx'

  const dataScript = bootstrapData
    ? `<script>window.__SSR_DATA__ = ${JSON.stringify(bootstrapData).replace(/</g, '\\u003c')};</script>`
    : ''

  // DEV: pipeline do Vite (react-refresh preamble + client + entry TSX)
  const devScripts = IS_DEV
    ? `<script type="module">
      import RefreshRuntime from "${viteBase}/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>
    <script type="module" src="${viteBase}/@vite/client"></script>
    <script type="module" src="${viteBase}${entry}"></script>`
    // PROD: TODO — apontar para o entry buildado (ler do manifest do Vite).
    // Por ora, sem script em prod (HTML estático apenas, sem interatividade).
    : `<!-- TODO(SSR prod): injetar /assets/entry-ssr.[hash].js do build manifest -->`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FluxStack</title>
    ${headTags}
    ${IS_DEV ? devScripts : ''}
  </head>
  <body>
    <div id="root">${appHtml}</div>
    ${dataScript}
    ${IS_DEV ? '' : devScripts}
  </body>
</html>`
}

export const ssrPlugin: Plugin = {
  name: 'ssr',
  version: FLUXSTACK_VERSION,
  description: 'Server-side rendering of the React app for page routes',
  author: 'FluxStack Team',
  priority: PLUGIN_PRIORITY,
  category: 'rendering',
  tags: ['ssr', 'react', 'hydration'],
  dependencies: [],

  setup: async (context: PluginContext) => {
    const enabled = (pluginsConfig as Record<string, unknown>).ssrEnabled
    if (!enabled) {
      context.logger.debug('SSR plugin disabled (set SSR_ENABLED=true)')
      return
    }
    context.logger.debug(`SSR plugin active (priority ${PLUGIN_PRIORITY})`)
  },

  onBeforeRoute: async (ctx: RequestContext) => {
    if (!(pluginsConfig as Record<string, unknown>).ssrEnabled) return
    if (ctx.method !== 'GET') return
    if (!isPageRoute(ctx.path)) return

    const renderer = getSsrRenderer()
    if (!renderer) return // app não registrou renderer → deixa o SPA fallback agir

    try {
      const result = await renderer({ url: ctx.path, headers: ctx.headers })
      const html = buildDocument({
        appHtml: result.html,
        bootstrapData: result.bootstrapData,
        headTags: result.headTags,
      })
      ctx.handled = true
      ctx.response = new Response(html, {
        status: result.status ?? 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    } catch (err) {
      // SSR falhou → NÃO trata (handled fica false), deixa o Vite/SPA servir.
      // Falhar para o SPA é melhor que mostrar 500: o client ainda renderiza.
      const msg = err instanceof Error ? err.message : String(err)
      ;(ctx as unknown as { logger?: { error: (m: string) => void } }).logger?.error?.(
        `SSR render failed for ${ctx.path}, falling back to SPA: ${msg}`
      )
    }
  },
}

export default ssrPlugin
