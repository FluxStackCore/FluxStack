/**
 * FluxStack Built-in Renderers
 *
 * Three frontend renderers as FluxStack plugins:
 *
 *   import { viteRenderer, ssrRenderer, bunRenderer } from '@core/plugins/built-in/renderers'
 *
 *   framework.use(viteRenderer())     // Vite classic (HMR, dev server)
 *   framework.use(ssrRenderer())      // SSR with Bun (server-first, hydrateRoot)
 *   framework.use(bunRenderer())      // Bun client-only (no SSR, fast bundling)
 */

import type { Plugin, PluginContext, RequestContext } from "@fluxstack/plugin-kit"
import { FLUXSTACK_VERSION } from "@core/utils/version"
import { isDevelopment } from "@core/utils/helpers"

import type { Renderer, BunNextConfig } from "./types"
import { defaultConfig } from "./types"
import { createBunRenderer } from "./engines/bun"
import { createViteRenderer } from "./engines/vite"
import { createSsrBunRenderer } from "./engines/ssr-bun"

const PLUGIN_PRIORITY = 800
const IS_DEV = isDevelopment()

function createRendererPlugin(
  name: string,
  rendererFactory: (config: BunNextConfig) => Renderer,
  options?: Partial<BunNextConfig>,
): Plugin {
  const config: BunNextConfig = { ...defaultConfig, ...options }
  let renderer: Renderer | null = null

  return {
    name,
    version: FLUXSTACK_VERSION,
    description: `FluxStack ${name}`,
    author: "FluxStack Team",
    priority: PLUGIN_PRIORITY,
    category: "development",
    tags: [name, "renderer", "frontend"],
    dependencies: [],

    setup: async (context: PluginContext) => {
      renderer = rendererFactory(config)
      context.logger.info(`Using "${renderer.name}" renderer`)
      await renderer.setup(context, IS_DEV)
    },

    onServerStart: async (context: PluginContext) => {
      if (renderer) {
        context.logger.info(`${renderer.getInfo(IS_DEV)}`)
      }
    },

    onBeforeRoute: async (ctx: RequestContext) => {
      if (!renderer) return

      const shouldSkip = config.excludePaths.some(
        (prefix) => ctx.path === prefix || ctx.path.startsWith(prefix + "/")
      )
      if (shouldSkip) return

      await renderer.handleRequest(ctx, IS_DEV)
    },

    onBeforeServerStop: async (context: PluginContext) => {
      if (renderer) {
        await renderer.stop(context)
        renderer = null
      }
    },
  }
}

/** Vite renderer — classic Vite dev server with HMR + production static serving */
export function viteRenderer(options?: Partial<BunNextConfig>): Plugin {
  return createRendererPlugin("vite-renderer", createViteRenderer, { ...options, renderer: "vite" })
}

/** SSR renderer — server-first with Bun, hydrateRoot, code-split client chunks */
export function ssrRenderer(options?: Partial<BunNextConfig>): Plugin {
  return createRendererPlugin("ssr-renderer", createSsrBunRenderer, { ...options, renderer: "ssr-bun" })
}

/** Bun renderer — client-only rendering with Bun's native bundler + HMR */
export function bunRenderer(options?: Partial<BunNextConfig>): Plugin {
  return createRendererPlugin("bun-renderer", createBunRenderer, { ...options, renderer: "bun" })
}

export type { RendererType, BunNextConfig, Renderer } from "./types"
