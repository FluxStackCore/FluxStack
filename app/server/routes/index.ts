import { Elysia, t } from "elysia"
import { usersRoutes } from "./users.routes"
import { roomRoutes } from "./room.routes"
import { authRoutes } from "./auth.routes"
import { pluginClientHooks } from "@core/server/plugin-client-hooks"
import { FLUXSTACK_VERSION } from "@core/utils/version"

export const apiRoutes = new Elysia({ prefix: "/api" })
  .get("/", () => ({ message: "🔥 Hot Reload funcionando! FluxStack API v1.4.0 ⚡" }), {
    response: t.Object({
      message: t.String()
    }),
    detail: {
      tags: ['Health'],
      summary: 'API Root',
      description: 'Returns a welcome message from the FluxStack API'
    }
  })
  .get("/health", () => {
    const checks = {
      status: 'ok' as 'ok' | 'degraded' | 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      version: FLUXSTACK_VERSION,
    }
    return checks
  }, {
    response: t.Object({
      status: t.String(),
      timestamp: t.String(),
      uptime: t.Number(),
      memory: t.Object({
        used: t.Number(),
        total: t.Number(),
      }),
      version: t.String(),
    }),
    detail: {
      tags: ['Health'],
      summary: 'Health Check',
      description: 'Returns the current health status of the API including uptime, memory usage, and version'
    }
  })
  // Plugin client hooks endpoint
  .get("/__plugins/client-hooks", () => pluginClientHooks.getSignedResponse(), {
    detail: {
      tags: ['Plugins'],
      summary: 'Get plugin client hooks',
      description: 'Returns JavaScript code registered by server-side plugins to be executed on the client'
    }
  })
  // Register routes
  .use(authRoutes)
  .use(usersRoutes)
  .use(roomRoutes)
