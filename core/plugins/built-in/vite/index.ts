import type { FluxStack, PluginContext, RequestContext } from "@core/plugins/types"
import { FLUXSTACK_VERSION } from "@core/utils/version"
import { clientConfig } from '@config'
import { pluginsConfig } from '@config'
import { isDevelopment } from "@core/utils/helpers"
import { join } from "path"
import { statSync, existsSync, readdirSync } from "fs"

type Plugin = FluxStack.Plugin

const PLUGIN_PRIORITY = 800
const INDEX_FILE = "index.html"

/** Cached at module load — NODE_ENV does not change at runtime */
const IS_DEV = isDevelopment()

/** One year in seconds — standard for hashed static assets */
const STATIC_MAX_AGE = 31536000

/** Extensions that carry a content hash in their filename (immutable) */
const HASHED_EXT = /\.[0-9a-f]{8,}\.\w+$/

/**
 * Recursively collect all files under `dir` as relative paths (e.g. "/assets/app.abc123.js").
 * Runs once at startup — in production the build output never changes.
 */
function collectFiles(dir: string, prefix = ''): Map<string, string> {
  const map = new Map<string, string>()
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const rel = prefix + '/' + entry.name
      if (entry.isDirectory()) {
        for (const [k, v] of collectFiles(join(dir, entry.name), rel)) {
          map.set(k, v)
        }
      } else if (entry.isFile()) {
        map.set(rel, join(dir, entry.name))
      }
    }
  } catch {}
  return map
}

/** Create static file handler with full in-memory cache */
function createStaticFallback() {
  // Discover base directory once
  const baseDir = existsSync('client') ? 'client'
    : existsSync('dist/client') ? 'dist/client'
    : clientConfig.build.outDir ?? 'dist/client'

  // Pre-scan all files at startup — O(1) lookup per request
  const fileMap = collectFiles(baseDir)

  // Pre-resolve SPA fallback
  const indexAbsolute = join(baseDir, INDEX_FILE)
  const indexExists = existsSync(indexAbsolute)
  const indexFile = indexExists ? Bun.file(indexAbsolute) : null

  // Bun.file() handle cache — avoids re-creating handles on repeated requests
  const fileCache = new Map<string, ReturnType<typeof Bun.file>>()

  return (c: { request?: Request }) => {
    const req = c.request
    if (!req) return

    // Fast pathname extraction — avoid full URL parse when possible
    const rawUrl = req.url
    let pathname: string
    const qIdx = rawUrl.indexOf('?')
    const pathPart = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx)

    // Handle absolute URLs (http://...) vs relative paths
    if (pathPart.charCodeAt(0) === 47) { // '/'
      pathname = pathPart
    } else {
      // Absolute URL — find the path after ://host
      const protoEnd = pathPart.indexOf('://')
      if (protoEnd !== -1) {
        const slashIdx = pathPart.indexOf('/', protoEnd + 3)
        pathname = slashIdx === -1 ? '/' : pathPart.slice(slashIdx)
      } else {
        pathname = pathPart
      }
    }

    // Decode percent-encoding only if needed
    if (pathname.includes('%')) {
      try { pathname = decodeURIComponent(pathname) } catch {}
    }

    if (pathname === '/' || pathname === '') {
      pathname = `/${INDEX_FILE}`
    }

    // O(1) lookup in pre-scanned file map
    const absolutePath = fileMap.get(pathname)
    if (absolutePath) {
      let file = fileCache.get(pathname)
      if (!file) {
        file = Bun.file(absolutePath)
        fileCache.set(pathname, file)
      }

      // Hashed filenames are immutable — cache aggressively
      if (HASHED_EXT.test(pathname)) {
        return new Response(file, {
          headers: {
            'Cache-Control': `public, max-age=${STATIC_MAX_AGE}, immutable`
          }
        })
      }

      return file
    }

    // SPA fallback: serve index.html for unmatched routes
    if (indexFile) {
      return indexFile
    }
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
