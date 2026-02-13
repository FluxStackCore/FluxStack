import { resolveStaticPath } from "@core/utils/path-resolver"
import type { Plugin, PluginContext } from "@core/plugins"

// Default configuration values
const DEFAULTS = {
  enabled: true,
  publicDir: "./dist/client",
  indexFile: "index.html",
  cacheMaxAge: 3600 // 1 hour
}

export const staticPlugin: Plugin = {
  name: "static",
  version: "2.1.0",
  description: "Optimized static file serving plugin for FluxStack",
  author: "FluxStack Team",
  priority: 200, 
  category: "core",
  tags: ["static", "files", "spa", "optimized"],
  dependencies: [],

  setup: async (context: PluginContext) => {
    if (!DEFAULTS.enabled) {
      context.logger.info('Static files plugin disabled')
      return
    }

    context.logger.info("Static files plugin activated (optimized)")

    const staticFallback = (c: any) => {
      const req = c.request
      if (!req) return

      const url = new URL(req.url)
      const pathname = decodeURIComponent(url.pathname)

      const { filePath, isFile } = resolveStaticPath(pathname, {
        publicDir: DEFAULTS.publicDir,
        indexFile: DEFAULTS.indexFile
      })

      if (isFile && filePath) {
        const response = new Response(Bun.file(filePath))
        
        // Add Cache-Control headers
        response.headers.set('Cache-Control', `public, max-age=${DEFAULTS.cacheMaxAge}`)
        
        return response
      }
    }

    context.app.all('*', staticFallback)
  },

  onServerStart: async (context: PluginContext) => {
    if (DEFAULTS.enabled) {
      context.logger.info(`Static files plugin ready (optimized)`)
    }
  }
}

export default staticPlugin
