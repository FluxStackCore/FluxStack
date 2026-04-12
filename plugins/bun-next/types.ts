import type { PluginContext, RequestContext } from "@fluxstack/plugin-kit"

export type RendererType = "bun" | "vite"

export interface BunNextConfig {
  /** Which renderer to use: 'bun' (native) or 'vite' (classic) */
  renderer: RendererType
  /** Internal port for dev bundler (bun renderer) */
  internalPort: number
  /** Output directory for production builds */
  outDir: string
  /** Enable browser console → terminal echo (bun renderer) */
  console: boolean
  /** Paths to exclude from frontend serving */
  excludePaths: string[]
}

export interface Renderer {
  name: string
  setup(context: PluginContext, isDev: boolean): Promise<void>
  handleRequest(ctx: RequestContext, isDev: boolean): Promise<void>
  stop(context: PluginContext): Promise<void>
  getInfo(isDev: boolean): string
}

export const defaultConfig: BunNextConfig = {
  renderer: "bun",
  internalPort: 51800,
  outDir: "dist/client",
  console: true,
  excludePaths: ["/api", "/swagger", "/ws"],
}
