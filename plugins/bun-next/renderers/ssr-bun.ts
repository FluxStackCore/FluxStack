/**
 * SSR Bun Renderer — Selective Hydration
 *
 * 1. Builds client component chunks via Bun.build() with code splitting
 * 2. Server-renders React app with ClientBoundary markers
 * 3. Injects manifest + bootstrap chunk for selective hydration
 * 4. Serves chunk files statically from dist/ssr-chunks/
 *
 * Server components → pure HTML, zero JS
 * Client components → SSR skeleton + lazy-loaded chunk JS
 */

import type { PluginContext, RequestContext } from "@fluxstack/plugin-kit"
import { join } from "path"
import { readFileSync, existsSync } from "fs"

// @ts-ignore — Minimal HTML import for CSS-only bundling (avoids server code in import chain)
import cssPage from "../../../app/client/ssr-css.html"

import type { Renderer, BunNextConfig } from "../types"
import { buildAndGetManifest, type ClientManifest } from "../use-client-plugin"

const CHUNKS_DIR = "dist/ssr-chunks"

function isDocumentRequest(ctx: RequestContext): boolean {
  const accept = ctx.headers["accept"] || ""
  if (accept.includes("text/html")) {
    const path = ctx.path
    if (path.startsWith("/_bun/") || path.startsWith("/_chunks/") || path.startsWith("/node_modules/")) return false
    const lastSegment = path.split("/").pop() || ""
    if (lastSegment.includes(".") && !lastSegment.endsWith(".html")) return false
    return true
  }
  return false
}

function isChunkRequest(path: string): boolean {
  return path.startsWith("/_chunks/")
}

function isAssetRequest(path: string): boolean {
  return path.startsWith("/_assets/")
}

/** Serve static assets from app/client/src/assets/ */
function serveAsset(ctx: RequestContext) {
  const fileName = ctx.path.replace("/_assets/", "")
  const filePath = join(process.cwd(), "app/client/src/assets", fileName)

  if (!existsSync(filePath)) return

  ctx.handled = true
  ctx.response = new Response(Bun.file(filePath), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}

/** Fetch bundled CSS URL from the internal Bun.serve() */
async function discoverCssUrl(port: number): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { "Accept": "text/html" },
      })
      const html = await res.text()
      const cssMatch = html.match(/href="([^"]+\.css)"/)
      if (cssMatch) return cssMatch[1]
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  return ""
}

export function createSsrBunRenderer(config: BunNextConfig): Renderer {
  let internalServer: ReturnType<typeof Bun.serve> | null = null
  let manifest: ClientManifest = {}
  let bootstrapChunkUrl = ""
  let cssUrl = ""

  // HTML shell template
  const htmlPath = join(process.cwd(), "app/client/index.html")
  const rawHtml = readFileSync(htmlPath, "utf-8")

  const rootMarker = '<div id="root">'
  const rootIdx = rawHtml.indexOf(rootMarker)
  const beforeRoot = rawHtml.slice(0, rootIdx + rootMarker.length)
  const afterRootRaw = rawHtml.slice(rootIdx + rootMarker.length)

  // Remove the main.tsx script — we inject bootstrap chunk instead
  const afterRootClean = afterRootRaw.replace(
    /<script[^>]*src="[^"]*main\.tsx"[^>]*><\/script>/,
    ""
  )

  // Pre-scan chunks directory for file serving
  const chunkFileCache = new Map<string, ReturnType<typeof Bun.file>>()

  return {
    name: "ssr-bun",

    async setup(context: PluginContext, isDev: boolean) {
      // 1. Build client component chunks
      const srcDir = join(process.cwd(), "app/client/src")
      const result = await buildAndGetManifest(srcDir, "/_chunks")

      manifest = result.manifest
      bootstrapChunkUrl = result.bootstrapChunk ? `/_chunks/${result.bootstrapChunk}` : ""

      const clientCount = Object.keys(manifest).length
      context.logger.info(`SSR renderer — ${clientCount} client components, ${Object.values(manifest).filter(e => e.chunkUrl).length} chunks built`)

      if (bootstrapChunkUrl) {
        context.logger.info(`SSR renderer — bootstrap: ${bootstrapChunkUrl}`)
      }

      if (isDev) {
        // Internal Bun.serve() for CSS (Tailwind) bundling
        internalServer = Bun.serve({
          port: config.internalPort,
          hostname: "127.0.0.1",
          routes: { "/*": cssPage },
          development: false, // Cache CSS in memory — no re-bundle per request
          fetch() {
            return new Response("Not Found", { status: 404 })
          },
        })

        cssUrl = await discoverCssUrl(config.internalPort)
        context.logger.info(`SSR renderer — CSS: ${cssUrl}`)
      }
    },

    async handleRequest(ctx: RequestContext, isDev: boolean) {
      // Serve static assets (SVGs, images, etc.)
      if (isAssetRequest(ctx.path)) {
        serveAsset(ctx)
        return
      }

      // Serve chunk files
      if (isChunkRequest(ctx.path)) {
        serveChunk(ctx)
        return
      }

      // SSR for document requests
      if (isDocumentRequest(ctx)) {
        await handleSSR(ctx, isDev, config, manifest, beforeRoot, afterRootClean, cssUrl, bootstrapChunkUrl)
        return
      }

      // Proxy other requests (CSS from /_bun/, etc.)
      if (isDev) {
        await proxyToInternal(ctx, config)
      }
    },

    async stop(context: PluginContext) {
      if (internalServer) {
        context.logger.info("Stopping SSR internal server...")
        internalServer.stop()
        internalServer = null
      }
    },

    getInfo(isDev: boolean) {
      const clientCount = Object.keys(manifest).length
      return `SSR + selective hydration (${clientCount} client chunks)`
    },
  }
}

/** Serve a pre-built chunk file from dist/ssr-chunks/ */
function serveChunk(ctx: RequestContext) {
  // /_chunks/CounterDemo-abc123.js → dist/ssr-chunks/CounterDemo-abc123.js
  const fileName = ctx.path.replace("/_chunks/", "")
  const filePath = join(process.cwd(), CHUNKS_DIR, fileName)

  if (!existsSync(filePath)) return

  let file = Bun.file(filePath)

  ctx.handled = true
  ctx.response = new Response(file, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

async function handleSSR(
  ctx: RequestContext,
  isDev: boolean,
  config: BunNextConfig,
  manifest: ClientManifest,
  beforeRoot: string,
  afterRootClean: string,
  cssUrl: string,
  bootstrapChunkUrl: string,
): Promise<void> {
  try {
    const { renderToReadableStream } = await import("react-dom/server")
    const { createServerElement } = await import("../../../app/client/src/ssr-entry")

    const element = createServerElement(ctx.path)
    const reactStream = await renderToReadableStream(element)

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // CSS link
    const cssLink = cssUrl ? `<link rel="stylesheet" href="${cssUrl}">` : ""

    // Manifest injection
    const manifestScript = `<script>window.__CLIENT_MANIFEST__=${JSON.stringify(manifest)}</script>`

    // Bootstrap chunk — loads and hydrates client components selectively
    const bootstrapScript = bootstrapChunkUrl
      ? `<script type="module" src="${bootstrapChunkUrl}"></script>`
      : ""

    ;(async () => {
      try {
        await writer.write(encoder.encode(beforeRoot.replace("</head>", `${cssLink}</head>`)))

        const reader = reactStream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }

        await writer.write(encoder.encode(
          afterRootClean.replace("</body>", `${manifestScript}\n${bootstrapScript}\n</body>`)
        ))
      } catch (err) {
        console.error("SSR stream error:", err)
      } finally {
        await writer.close()
      }
    })()

    ctx.handled = true
    ctx.response = new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (err) {
    console.error("SSR failed, falling back to client-only:", err)
    await proxyToInternal(ctx, config)
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
