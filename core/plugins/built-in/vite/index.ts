import type { FluxStack, PluginContext, RequestContext } from "@core/plugins/types"
import { FLUXSTACK_VERSION } from "@core/utils/version"
import { clientConfig, pluginsConfig } from '@config'
import { isDevelopment } from "@core/utils/helpers"
import { resolveStaticPath } from "@core/utils/path-resolver"

type Plugin = FluxStack.Plugin

const PLUGIN_PRIORITY = 800

/** Create static file handler using centralized resolver */
function createStaticFallback() {
  return (c: { request?: Request }) => {
    const req = c.request
    if (!req) return

    const pathname = decodeURIComponent(new URL(req.url).pathname)
    const { filePath, isFile } = resolveStaticPath(pathname, {
      publicDir: clientConfig.build.outDir ?? 'dist/client'
    })

    if (isFile && filePath) {
      return new Response(Bun.file(filePath))
    }
  }
}

/** Proxy request to Vite dev server */
async function proxyToVite(ctx: RequestContext): Promise<void> {
  const { host, port } = clientConfig.vite

  try {
    let url: URL
    try {
      url = new URL(ctx.request.url)
    } catch {
      const reqHost = ctx.request.headers.get('host') || 'localhost'
      const protocol = ctx.request.headers.get('x-forwarded-proto') || 'http'
      url = new URL(ctx.request.url, `${protocol}://${reqHost}`)
    }

    const response = await fetch(`http://${host}:${port}${ctx.path}${url.search}`, {
      method: ctx.method,
      headers: ctx.headers,
      body: ctx.method !== 'GET' && ctx.method !== 'HEAD' ? ctx.request.body : undefined
    })

    ctx.handled = true
    ctx.response = new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  } catch (error) {
    if (clientConfig.vite.enableLogging) {
      console.warn(`Vite proxy error: ${error}`)
    }
  }
}

export const vitePlugin: Plugin = {
  name: "vite",
  version: FLUXSTACK_VERSION,
  description: "Optimized Vite integration plugin for FluxStack",
  author: "FluxStack Team",
  priority: PLUGIN_PRIORITY,
  category: "development",
  tags: ["vite", "development", "hot-reload", "optimized"],
  dependencies: [],

  setup: async (context: PluginContext) => {
    if (!pluginsConfig.viteEnabled) {
      context.logger.debug('Vite plugin disabled')
      return
    }

    if (!isDevelopment()) {
      context.logger.debug("Production mode: static file serving enabled (optimized)")
      context.app.all('*', createStaticFallback())
      return
    }

    const { setupViteDev } = await import('./vite-dev')
    await setupViteDev(context)
  },

  onServerStart: async (context: PluginContext) => {
    if (!pluginsConfig.viteEnabled) return

    if (!isDevelopment()) {
      context.logger.debug('Static files ready (optimized)')
      return
    }

    context.logger.debug(`Vite active - ${clientConfig.vite.host}:${clientConfig.vite.port}`)
  },

  onBeforeRoute: async (ctx: RequestContext) => {
    if (!isDevelopment()) return

    const shouldSkip = (pluginsConfig.viteExcludePaths ?? []).some(prefix =>
      ctx.path === prefix || ctx.path.startsWith(prefix + '/')
    )

    if (!shouldSkip) {
      await proxyToVite(ctx)
    }
  }
}

export default vitePlugin
