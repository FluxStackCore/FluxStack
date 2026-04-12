/**
 * Vite Renderer
 *
 * Uses Vite dev server for development and serves pre-built
 * static files in production. Extracted from the built-in vite plugin.
 */

import type { PluginContext, RequestContext } from "@fluxstack/plugin-kit"
import { clientConfig } from "@config"
import { pluginsConfig } from "@config"
import { join } from "path"
import { existsSync } from "fs"

import type { Renderer, BunNextConfig } from "../types"

/** One year in seconds — standard for hashed static assets */
const STATIC_MAX_AGE = 31536000
const HASHED_EXT = /\.[0-9a-f]{8,}\.\w+$/

export function createViteRenderer(config: BunNextConfig): Renderer {
  let prodFallback: ((c: { request?: Request }) => Response | ReturnType<typeof Bun.file> | undefined) | null = null

  return {
    name: "vite",

    async setup(context: PluginContext, isDev: boolean) {
      if (!isDev) {
        context.logger.info("Vite renderer — production static file serving")
        prodFallback = createStaticFallback()
        ;(context.app as Record<string, Function>).all("*", prodFallback)
      } else {
        const { setupViteDev } = await import("@core/plugins/built-in/vite/vite-dev")
        await setupViteDev(context)
        context.logger.info("Vite renderer — dev server active")
      }
    },

    async handleRequest(ctx: RequestContext, isDev: boolean) {
      if (!isDev) return // Production is handled by the catch-all registered in setup

      // Dev mode: proxy to Vite dev server
      await proxyToVite(ctx)
    },

    async stop(context: PluginContext) {
      context.logger.info("Vite renderer stopped")
    },

    getInfo(isDev: boolean) {
      const { host, port } = clientConfig.vite
      return isDev
        ? `Vite HMR on ${host}:${port}`
        : "Vite static build"
    },
  }
}

async function proxyToVite(ctx: RequestContext): Promise<void> {
  const { host, port } = clientConfig.vite

  try {
    let url: URL
    try {
      url = new URL(ctx.request.url)
    } catch {
      const reqHost = ctx.request.headers.get("host") || "localhost"
      const protocol = ctx.request.headers.get("x-forwarded-proto") || "http"
      url = new URL(ctx.request.url, `${protocol}://${reqHost}`)
    }

    const response = await fetch(`http://${host}:${port}${ctx.path}${url.search}`, {
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
  } catch (error) {
    if ((clientConfig.vite as any).enableLogging) {
      console.warn(`Vite proxy error: ${error}`)
    }
  }
}

function collectFiles(dir: string): Map<string, string> {
  if (!existsSync(dir)) {
    throw new Error(`Static file directory "${dir}" does not exist. Run the client build first.`)
  }

  const map = new Map<string, string>()
  const glob = new Bun.Glob("**/*")
  for (const relativePath of glob.scanSync({ cwd: dir, onlyFiles: true, dot: true })) {
    const urlPath = "/" + relativePath.replaceAll("\\", "/")
    map.set(urlPath, join(dir, relativePath))
  }
  return map
}

function createStaticFallback() {
  const baseDir = existsSync("client")
    ? "client"
    : existsSync("dist/client")
      ? "dist/client"
      : (clientConfig.build.outDir as string) ?? "dist/client"

  const fileMap = collectFiles(baseDir)
  const indexAbsolute = join(baseDir, "index.html")
  const indexExists = existsSync(indexAbsolute)
  const indexFile = indexExists ? Bun.file(indexAbsolute) : null
  const fileCache = new Map<string, ReturnType<typeof Bun.file>>()

  const gzSet = new Set<string>()
  for (const [rel] of fileMap) {
    if (rel.endsWith(".gz")) gzSet.add(rel.slice(0, -3))
  }

  return (c: { request?: Request }) => {
    const req = c.request
    if (!req) return

    const rawUrl = req.url
    let pathname: string
    const qIdx = rawUrl.indexOf("?")
    const pathPart = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx)

    if (pathPart.charCodeAt(0) === 47) {
      pathname = pathPart
    } else {
      const protoEnd = pathPart.indexOf("://")
      if (protoEnd !== -1) {
        const slashIdx = pathPart.indexOf("/", protoEnd + 3)
        pathname = slashIdx === -1 ? "/" : pathPart.slice(slashIdx)
      } else {
        pathname = pathPart
      }
    }

    if (pathname.includes("%")) {
      try { pathname = decodeURIComponent(pathname) } catch {}
    }

    if (pathname === "/" || pathname === "") pathname = "/index.html"

    const absolutePath = fileMap.get(pathname)
    if (absolutePath) {
      const acceptEncoding = req.headers.get("accept-encoding") || ""
      if (gzSet.has(pathname) && acceptEncoding.includes("gzip")) {
        const gzPath = pathname + ".gz"
        const gzAbsolute = fileMap.get(gzPath)
        if (gzAbsolute) {
          let gzFile = fileCache.get(gzPath)
          if (!gzFile) { gzFile = Bun.file(gzAbsolute); fileCache.set(gzPath, gzFile) }
          let origFile = fileCache.get(pathname)
          if (!origFile) { origFile = Bun.file(absolutePath); fileCache.set(pathname, origFile) }

          const headers: Record<string, string> = {
            "Content-Encoding": "gzip",
            "Content-Type": origFile.type || "application/octet-stream",
            "Vary": "Accept-Encoding",
          }
          if (HASHED_EXT.test(pathname)) {
            headers["Cache-Control"] = `public, max-age=${STATIC_MAX_AGE}, immutable`
          }
          return new Response(gzFile, { headers })
        }
      }

      let file = fileCache.get(pathname)
      if (!file) { file = Bun.file(absolutePath); fileCache.set(pathname, file) }

      if (HASHED_EXT.test(pathname)) {
        return new Response(file, {
          headers: { "Cache-Control": `public, max-age=${STATIC_MAX_AGE}, immutable` },
        })
      }
      return file
    }

    if (indexFile) {
      return new Response(indexFile, {
        headers: { "Cache-Control": "no-cache" },
      })
    }
  }
}
