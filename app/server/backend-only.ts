/**
 * Backend Standalone Entry Point
 *
 * This is a minimal wrapper for starting the backend in standalone mode.
 * The core logic is protected in @/core/server/backend-entry.ts
 *
 * You can customize the configuration here if needed.
 */

import { startBackend, createBackendConfig } from "@/core/server/backend-entry"
import { appInstance } from "./app"
import { serverConfig } from "@/config"

// Create backend configuration from declarative config
// Provide fallback defaults matching the schema to satisfy strict type checking,
// since the config system's type inference marks optional fields as potentially undefined.
const backendConfig = createBackendConfig({
  server: {
    backendPort: serverConfig.server.backendPort ?? 3001,
    apiPrefix: serverConfig.server.apiPrefix ?? '/api',
    host: serverConfig.server.host ?? 'localhost',
  }
})

// Start backend in standalone mode
startBackend(appInstance, backendConfig)
