/**
 * Bun Native Renderer
 *
 * Uses Bun.serve() internally with HTML imports for:
 * - Native JS/TS/TSX/CSS bundling
 * - HMR (Hot Module Replacement)
 * - Production static file serving
 */

import type { PluginContext, RequestContext } from "@fluxstack/plugin-kit"
import { join } from "path"
import { existsSync } from "fs"

// @ts-ignore — Bun HTML import
import homepage from "../../../app/client/index.html"

import type { Renderer, BunNextConfig } from "../types"

export function createBunRenderer(config: BunNextConfig): Renderer {
  let internalServer: ReturnType<typeof Bun.serve> | null = null
  let prodHandler: ((ctx: RequestContext) => void) | null = null

  return {
    name: "bun",

    async setup(context: PluginContext, isDev: boolean) {
      if (isDev) {
        internalServer = Bun.serve({
          port: config.internalPort,
          hostname: "127.0.0.1",

          routes: {
            "/*": homepage,
          },

          development: {
            hmr: true,
            console: config.console,
          },

          fetch() {
            return new Response("Not Found", { status: 404 })
          },
        })

        context.logger.info(`Bun renderer — internal bundler on 127.0.0.1:${config.internalPort}`)
      } else {
        prodHandler = createProductionHandler(config)
        context.logger.info("Bun renderer — static file serving enabled")
      }
    },

    async handleRequest(ctx: RequestContext, isDev: boolean) {
      if (isDev) {
        await proxyToInternal(ctx, config)
      } else if (prodHandler) {
        prodHandler(ctx)
      }
    },

    async stop(context: PluginContext) {
      if (internalServer) {
        context.logger.info("Stopping Bun renderer internal server...")
        internalServer.stop()
        internalServer = null
      }
    },

    getInfo(isDev: boolean) {
      return isDev
        ? `Bun HMR (same port via internal proxy :${config.internalPort})`
        : "Bun static build"
    },
  }
}

async function proxyToInternal(ctx: RequestContext, config: BunNextConfig): Promise<void> {
  try {
    let search = ""
    try {
      const url = new URL(ctx.request.url)
      search = url.search
    } catch {}

    const targetUrl = `http://127.0.0.1:${config.internalPort}${ctx.path}${search}`

    const response = await fetch(targetUrl, {
      method: ctx.method,
      headers: ctx.headers,
      body: ctx.method !== "GET" && ctx.method !== "HEAD" ? ctx.request.body : undefined,
    })

    ctx.handled = true
    ctx.response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  } catch {}
}

function createProductionHandler(config: BunNextConfig) {
  const baseDir = existsSync(config.outDir)
    ? config.outDir
    : existsSync("dist/client")
      ? "dist/client"
      : "client"

  if (!existsSync(baseDir)) {
    throw new Error(
      `BunNext (bun renderer): Build directory "${baseDir}" not found. Run "bun run build" first.`
    )
  }

  const fileMap = new Map<string, string>()
  const glob = new Bun.Glob("**/*")
  for (const relativePath of glob.scanSync({ cwd: baseDir, onlyFiles: true, dot: true })) {
    const urlPath = "/" + relativePath.replaceAll("\\", "/")
    fileMap.set(urlPath, join(baseDir, relativePath))
  }

  const indexPath = join(baseDir, "index.html")
  const indexFile = existsSync(indexPath) ? Bun.file(indexPath) : null
  const fileCache = new Map<string, ReturnType<typeof Bun.file>>()
  const STATIC_MAX_AGE = 31536000
  const HASHED_EXT = /\.[0-9a-f]{8,}\.\w+$/

  return (ctx: RequestContext) => {
    let pathname = ctx.path
    if (pathname === "/" || pathname === "") pathname = "/index.html"
    if (pathname.includes("%")) {
      try { pathname = decodeURIComponent(pathname) } catch {}
    }

    const absolutePath = fileMap.get(pathname)
    if (absolutePath) {
      let file = fileCache.get(pathname)
      if (!file) {
        file = Bun.file(absolutePath)
        fileCache.set(pathname, file)
      }
      const headers: Record<string, string> = {}
      if (HASHED_EXT.test(pathname)) {
        headers["Cache-Control"] = `public, max-age=${STATIC_MAX_AGE}, immutable`
      }
      ctx.handled = true
      ctx.response = new Response(file, { headers })
      return
    }

    if (indexFile) {
      ctx.handled = true
      ctx.response = new Response(indexFile, {
        headers: { "Cache-Control": "no-cache" },
      })
    }
  }
}
