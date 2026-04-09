/**
 * FluxStack Application Server Entry Point
 *
 * Modos (via FLUXSTACK_MODE ou appConfig.mode):
 * - full-stack: Backend + Vite + LiveComponents (padrão)
 * - backend-only: Backend + LiveComponents (sem Vite)
 *
 * Frontend-only roda direto do core (core/client/standalone-entry.ts)
 *
 * 📖 Docs: ai-context/reference/plugin-security.md
 */

import { FluxStackFramework } from "@core/server"
import { vitePlugin } from "@core/plugins/built-in/vite"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { ssrPlugin } from "@core/plugins/built-in/ssr"
import "./ssr-routes" // Register SSR routes for public pages
import { liveComponentsPlugin, registerAuthProvider } from "@core/server/live"
import { appInstance } from "@server/app"
import { appConfig } from "@config"

// 🔒 Auth provider para Live Components
import { DevAuthProvider } from "./auth/DevAuthProvider"

// 🔐 Auth system (Guard + Provider, Laravel-inspired)
import { initAuth } from "@server/auth"

// Registrar provider de desenvolvimento (tokens simples para testes)
registerAuthProvider(new DevAuthProvider())
if (process.env.NODE_ENV !== 'production') console.log('🔓 DevAuthProvider registered')

// Inicializar sistema de autenticação
initAuth()

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(ssrPlugin)
  .use(liveComponentsPlugin)

// Vite apenas em full-stack
if (appConfig.mode !== 'backend-only') {
  framework.use(vitePlugin)
}

framework.routes(appInstance)
await framework.listen()

export const app = framework
