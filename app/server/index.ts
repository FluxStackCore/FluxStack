/**
 * FluxStack Application Server Entry Point
 *
 * 🔒 Plugin Loading Strategy (Security Model):
 *
 * 1. Built-in Plugins (core/plugins/built-in)
 *    ✅ MANUAL registration via .use()
 *    ✅ Totalmente confiáveis
 *    📝 Developer escolhe quais usar
 *
 * 2. Project Plugins (plugins/)
 *    ✅ AUTO-DISCOVERY enabled by default
 *    ✅ Seu código = confiável
 *    📝 Disable via: PLUGINS_DISCOVER_PROJECT=false
 *
 * 3. NPM Plugins (node_modules/fluxstack-plugin-*, fplugin-*, @fluxstack/plugin-*, @fplugin/*)
 *    🔒 AUTO-DISCOVERY disabled by default (SECURE)
 *    🔒 Whitelist obrigatória (PLUGINS_ALLOWED)
 *    📝 Enable via: PLUGINS_DISCOVER_NPM=true + PLUGINS_ALLOWED=plugin-name
 *
 * 📖 Security Guide: ai-context/reference/plugin-security.md
 */

// Core
import { FluxStackFramework } from "@/core/server"

// Built-in plugins (import only the ones you want to use)
import { vitePlugin } from "@/core/plugins/built-in/vite"
import { swaggerPlugin } from "@/core/plugins/built-in/swagger"
import { liveComponentsPlugin } from "@/core/server/live/websocket-plugin"
// import { monitoringPlugin } from "@/core/plugins/built-in/monitoring"  // Optional
// import { staticFilesPlugin } from "@/core/server/plugins/static-files-plugin"  // Optional

// Routes
import { appInstance } from "./app"

// Server with manual built-in plugins + auto-discovery for external plugins
const framework = new FluxStackFramework()
  .use(vitePlugin)            // ✅ Vite dev server + static prod
  .use(swaggerPlugin)         // ✅ Swagger UI documentation
  .use(liveComponentsPlugin)  // ✅ Live Components WebSocket
  .routes(appInstance)        // Application routes

// Start server (auto-discovers plugins/ and node_modules/)
await framework.listen()

export const app = framework
export type App = typeof app
