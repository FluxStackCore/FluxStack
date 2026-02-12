import type { FluxStack, PluginContext, RequestContext } from "@core/plugins/types"
import { FLUXSTACK_VERSION } from "@core/utils/version"
import { clientConfig } from '@config'
import { pluginsConfig } from '@config'
import { isDevelopment } from "@core/utils/helpers"
import { join } from "path"
import { statSync, existsSync } from "fs"

type Plugin = FluxStack.Plugin

const PLUGIN_PRIORITY = 800
const INDEX_FILE = "index.html"

/** Cached at module load — NODE_ENV does not change at runtime */
const IS_DEV = isDevelopment()

/** Create static file handler with cached base directory */
function createStaticFallback() {
  // Discover base directory once
  const baseDir = existsSync('client') ? 'client'
    : existsSync('dist/client') ? 'dist/client'
    : clientConfig.build.outDir ?? 'dist/client'

  return (c: { request?: Request }) => {
    const req = c.request
    if (!req) return

    let pathname = decodeURIComponent(new URL(req.url).pathname)
    if (pathname === '/' || pathname === '') {
      pathname = `/${INDEX_FILE}`
    }

    // Try to serve the requested file
    const filePath = join(baseDir, pathname)
    try {
      if (statSync(filePath).isFile()) {
        return Bun.file(filePath)
      }
    } catch {}

    // SPA fallback: serve index.html
    const indexPath = join(baseDir, INDEX_FILE)
    try {
      statSync(indexPath)
      return Bun.file(indexPath)
    } catch {}
  }
}

/** Proxy request to Vite dev server */
async function proxyToVite(ctx: RequestContext): Promise<void> {
  const { host, port } = clientConfig.vite

  try {
    // Parse URL (handle relative URLs)
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
  description: "Vite integration plugin for FluxStack",
  author: "FluxStack Team",
  priority: PLUGIN_PRIORITY,
  category: "development",
  tags: ["vite", "development", "hot-reload"],
  dependencies: [],

  setup: async (context: PluginContext) => {
    if (!pluginsConfig.viteEnabled) {
      context.logger.debug('Vite plugin disabled')
      return
    }

    if (!IS_DEV) {
      context.logger.debug("Production mode: static file serving enabled")
      context.app.all('*', createStaticFallback())
      return
    }

    const { setupViteDev } = await import('./vite-dev')
    await setupViteDev(context)
  },

  onServerStart: async (context: PluginContext) => {
    if (!pluginsConfig.viteEnabled) return

    if (!IS_DEV) {
      context.logger.debug('Static files ready')
      return
    }

    context.logger.debug(`Vite active - ${clientConfig.vite.host}:${clientConfig.vite.port}`)
  },

  onBeforeRoute: async (ctx: RequestContext) => {
    if (!IS_DEV) return

    const shouldSkip = (pluginsConfig.viteExcludePaths ?? []).some(prefix =>
      ctx.path === prefix || ctx.path.startsWith(prefix + '/')
    )

    if (!shouldSkip) {
      await proxyToVite(ctx)
    }
  }
}

export default vitePlugin
