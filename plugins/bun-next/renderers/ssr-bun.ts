/**
 * SSR Bun Renderer
 *
 * Server-side renders the React app with ClientBoundary markers,
 * injects client manifest, and loads bootstrap for selective hydration.
 *
 * Flow:
 * 1. Document requests (text/html) → SSR via renderToReadableStream
 * 2. Asset requests (JS/CSS/images) → proxy to internal Bun.serve()
 * 3. Client receives server-rendered HTML + manifest + bootstrap
 * 4. Bootstrap finds [data-client] markers and hydrates each component
 */

import type { PluginContext, RequestContext } from "@fluxstack/plugin-kit"
import { join } from "path"
import { readFileSync } from "fs"

// @ts-ignore — Bun HTML import for client bundling (CSS + JS assets)
import homepage from "../../../app/client/index.html"

import type { Renderer, BunNextConfig } from "../types"
import { getClientManifest, type ClientManifest } from "../use-client-plugin"

/** Fetch the bundled CSS/JS URLs from the internal Bun.serve() */
async function discoverBundlerAssets(port: number): Promise<{ cssUrl: string; jsUrl: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { "Accept": "text/html" },
      })
      const html = await res.text()
      const cssMatch = html.match(/href="([^"]+\.css)"/)
      const jsMatch = html.match(/src="([^"]+\.js)"[^>]*data-bun-dev-server-script/)

      if (cssMatch || jsMatch) {
        return {
          cssUrl: cssMatch?.[1] || "",
          jsUrl: jsMatch?.[1] || "",
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  return { cssUrl: "", jsUrl: "" }
}

function isDocumentRequest(ctx: RequestContext): boolean {
  const accept = ctx.headers["accept"] || ""
  if (accept.includes("text/html")) {
    const path = ctx.path
    if (path.startsWith("/_bun/") || path.startsWith("/node_modules/")) return false
    const lastSegment = path.split("/").pop() || ""
    if (lastSegment.includes(".") && !lastSegment.endsWith(".html")) return false
    return true
  }
  return false
}

export function createSsrBunRenderer(config: BunNextConfig): Renderer {
  let internalServer: ReturnType<typeof Bun.serve> | null = null
  let manifest: ClientManifest = {}
  let bundlerCssUrl = ""
  let bundlerAppJs = ""

  // HTML shell template
  const htmlPath = join(process.cwd(), "app/client/index.html")
  const rawHtml = readFileSync(htmlPath, "utf-8")

  const rootMarker = '<div id="root">'
  const rootIdx = rawHtml.indexOf(rootMarker)
  const beforeRoot = rawHtml.slice(0, rootIdx + rootMarker.length)
  const afterRootRaw = rawHtml.slice(rootIdx + rootMarker.length)

  // Remove the main.tsx script — we inject bootstrap instead
  const afterRootClean = afterRootRaw.replace(
    /<script[^>]*src="[^"]*main\.tsx"[^>]*><\/script>/,
    ""
  )

  return {
    name: "ssr-bun",

    async setup(context: PluginContext, isDev: boolean) {
      // Scan for "use client" components and build manifest
      const srcDir = join(process.cwd(), "app/client/src")
      manifest = getClientManifest(srcDir, config.internalPort, isDev)

      const clientCount = Object.keys(manifest).length
      context.logger.info(`SSR renderer — found ${clientCount} client component(s)`)

      if (isDev) {
        // Internal Bun.serve() for client bundle assets
        internalServer = Bun.serve({
          port: config.internalPort,
          hostname: "127.0.0.1",
          routes: { "/*": homepage },
          development: { hmr: true, console: config.console },
          fetch() {
            return new Response("Not Found", { status: 404 })
          },
        })

        context.logger.info(`SSR renderer — internal bundler on 127.0.0.1:${config.internalPort}`)

        // Discover bundled asset URLs (CSS, HMR JS) from the internal server
        const assets = await discoverBundlerAssets(config.internalPort)
        bundlerCssUrl = assets.cssUrl
        bundlerAppJs = assets.jsUrl
        context.logger.info(`SSR renderer — CSS: ${bundlerCssUrl}, App JS: ${bundlerAppJs}`)
      }
    },

    async handleRequest(ctx: RequestContext, isDev: boolean) {
      if (isDocumentRequest(ctx)) {
        await handleSSR(ctx, isDev, config, manifest, beforeRoot, afterRootClean, bundlerCssUrl, bundlerAppJs)
      } else if (isDev) {
        await proxyToInternal(ctx, config)
      }
    },

    async stop(context: PluginContext) {
      if (internalServer) {
        context.logger.info("Stopping SSR internal bundler...")
        internalServer.stop()
        internalServer = null
      }
    },

    getInfo(isDev: boolean) {
      const clientCount = Object.keys(manifest).length
      return isDev
        ? `SSR + selective hydration (${clientCount} client components, port :${config.internalPort})`
        : `SSR + selective hydration (${clientCount} client components)`
    },
  }
}

async function handleSSR(
  ctx: RequestContext,
  isDev: boolean,
  config: BunNextConfig,
  manifest: ClientManifest,
  beforeRoot: string,
  afterRootClean: string,
  cssUrl: string,
  appJsUrl: string,
): Promise<void> {
  try {
    const { renderToReadableStream } = await import("react-dom/server")
    const { createServerElement } = await import("../../../app/client/src/ssr-entry")

    const element = createServerElement(ctx.path)
    const reactStream = await renderToReadableStream(element)

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // All assets go through the main port (3000) via proxy — no cross-origin
    let head = beforeRoot
    let tail = afterRootClean

    // Build the manifest + bootstrap script injection
    // Bootstrap JS bundle (discovered from internal Bun.serve())
    // Served via proxy: 3000 → 51800 (transparent to browser)

    // CSS from the Bun bundler (discovered at setup)
    const cssLink = cssUrl ? `<link rel="stylesheet" href="${cssUrl}">` : ""
    // Main JS bundle — loads the full React app and takes over from SSR HTML
    const appScript = appJsUrl
      ? `<script type="module" crossorigin src="${appJsUrl}"></script>`
      : ""

    const manifestScript = `<script>window.__CLIENT_MANIFEST__=${JSON.stringify(manifest)}</script>`

    ;(async () => {
      try {
        // HTML head + CSS
        await writer.write(encoder.encode(head.replace("</head>", `${cssLink}</head>`)))

        // React SSR stream
        const reader = reactStream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }

        // Closing HTML + manifest + app JS (takes over from SSR)
        await writer.write(encoder.encode(tail.replace("</body>", `${manifestScript}\n${appScript}\n</body>`)))
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
