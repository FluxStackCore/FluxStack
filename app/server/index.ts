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

// SSR: registra o loader de asset (alinha .svg etc com as URLs do Vite) ANTES
// de qualquer import que puxe um asset client. Bun.plugin afeta imports seguintes.
import "@core/plugins/built-in/ssr/bun-asset-loader"

import { FluxStackFramework } from "@core/server"
import { vitePlugin } from "@core/plugins/built-in/vite"
import { ssrPlugin } from "@core/plugins/built-in/ssr"
import { rscPlugin } from "@core/plugins/built-in/rsc"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { liveComponentsPlugin, registerAuthProvider } from "@core/server/live"
import { appInstance } from "@server/app"
import { installAppSsrRenderer } from "@server/ssr/app-renderer"
import { appConfig } from "@config"

// 🔒 External plugins — registered explicitly via .use() so the bundler
// includes them statically. Auto-discovery via node_modules/ was removed
// in @fluxstack/plugin-kit@0.4.0 because it broke silently in production
// bundles (dist/node_modules/ does not exist). Every plugin the app
// wants to enable must be imported + `.use()`-d here.
import { csrfProtectionPlugin } from "@fluxstack/plugin-csrf-protection"

// 🔒 Auth provider para Live Components
import { DevAuthProvider } from "./auth/DevAuthProvider"

// 🔐 Auth system (Guard + Provider, Laravel-inspired)
import { initAuth } from "@server/auth"

// Registrar provider de desenvolvimento (tokens simples para testes)
registerAuthProvider(new DevAuthProvider())
if (process.env.NODE_ENV !== 'production') console.log('🔓 DevAuthProvider registered')

// Inicializar sistema de autenticação
initAuth()

// Registrar o renderer SSR do app (AppShell) antes de subir os plugins.
installAppSsrRenderer()

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)
  .use(csrfProtectionPlugin)

// Vite + SSR/RSC apenas em full-stack. Prioridades: rsc (860) > ssr (850) >
// vite (800). Cada um só age se sua flag estiver on (RSC_ENABLED / SSR_ENABLED).
if (appConfig.mode !== 'backend-only') {
  framework.use(rscPlugin)
  framework.use(ssrPlugin)
  framework.use(vitePlugin)
}

framework.routes(appInstance)
await framework.listen()

export const app = framework
