/**
 * FluxStack Application Server Entry Point
 */

// Core
import { FluxStackFramework } from "@/core/server"
import { helpers } from "@/core/utils/env"
import { appConfig, serverConfig } from "@/config"

// Plugins
import { vitePlugin, swaggerPlugin, liveComponentsPlugin, staticFilesPlugin } from "@/core/server"
import cryptoAuthPlugin from "@/plugins/crypto-auth"
// Routes & Components
import { appInstance } from "./app"

// Server
const app = new FluxStackFramework({
  server: {
    ...serverConfig.server,
    cors: serverConfig.cors,
    middleware: []
  },
  app: {
    name: appConfig.name,
    version: appConfig.version
  },
  client: {
    port: serverConfig.server.backendPort,
    build: { sourceMaps: false, minify: false, target: 'es2020', outDir: 'dist' }
  }
})
  .use(cryptoAuthPlugin)
  .use(vitePlugin)
  .use(staticFilesPlugin)
  .use(liveComponentsPlugin)
  .routes(appInstance)
  .use(swaggerPlugin)
  .listen()

export type App = typeof app
