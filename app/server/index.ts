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
import { rscPlugin } from "@core/plugins/built-in/rsc"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { liveComponentsPlugin, registerAuthProvider } from "@core/server/live"
import { appInstance } from "@server/app"
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

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)
  .use(csrfProtectionPlugin)

// Vite + RSC apenas em full-stack. O rscPlugin (priority 860) intercepta rotas
// de página antes do vite (800); só age se RSC_ENABLED=true. RSC é o modo SSR
// oficial (o "Caminho A"/AppShell foi descontinuado — ver .ai-notes).
if (appConfig.mode !== 'backend-only') {
  framework.use(rscPlugin)
  framework.use(vitePlugin)
}

framework.routes(appInstance)
await framework.listen()

export const app = framework
