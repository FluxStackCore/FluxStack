/**
 * FluxStack BunNext Plugin
 *
 * Unified frontend plugin that lets you choose between renderers:
 * - 'bun'  — Bun native (HTML imports, built-in bundler, HMR)
 * - 'vite' — Classic Vite dev server + production static serving
 *
 * Usage:
 *   import { bunNextPlugin } from '../../plugins/bun-next'
 *
 *   framework.use(bunNextPlugin({ renderer: 'bun' }))
 *   framework.use(bunNextPlugin({ renderer: 'vite' }))
 *   framework.use(bunNextPlugin()) // defaults to 'bun'
 */

import type { Plugin, PluginContext, RequestContext } from "@fluxstack/plugin-kit"
import { FLUXSTACK_VERSION } from "@core/utils/version"
import { isDevelopment } from "@core/utils/helpers"

import type { RendererType, Renderer, BunNextConfig } from "./types"
import { defaultConfig } from "./types"
import { createBunRenderer } from "./renderers/bun"
import { createViteRenderer } from "./renderers/vite"
import { createSsrBunRenderer } from "./renderers/ssr-bun"

const PLUGIN_PRIORITY = 800
const IS_DEV = isDevelopment()

function resolveRenderer(config: BunNextConfig): Renderer {
  switch (config.renderer) {
    case "vite":
      return createViteRenderer(config)
    case "ssr-bun":
      return createSsrBunRenderer(config)
    case "bun":
    default:
      return createBunRenderer(config)
  }
}

/**
 * Create the BunNext plugin with the specified renderer.
 *
 * @param options - Partial config, defaults to { renderer: 'bun' }
 */
export function bunNextPlugin(options?: Partial<BunNextConfig>): Plugin {
  const config: BunNextConfig = { ...defaultConfig, ...options }
  let renderer: Renderer | null = null

  return {
    name: "bun-next",
    version: FLUXSTACK_VERSION,
    description: `BunNext — frontend serving with ${config.renderer} renderer`,
    author: "FluxStack Team",
    priority: PLUGIN_PRIORITY,
    category: "development",
    tags: ["bun-next", config.renderer, "hmr", "fullstack"],
    dependencies: [],

    setup: async (context: PluginContext) => {
      renderer = resolveRenderer(config)
      context.logger.info(`BunNext using "${renderer.name}" renderer`)
      await renderer.setup(context, IS_DEV)
    },

    onServerStart: async (context: PluginContext) => {
      if (renderer) {
        context.logger.info(`BunNext active — ${renderer.getInfo(IS_DEV)}`)
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

export default bunNextPlugin
export type { RendererType, BunNextConfig } from "./types"
