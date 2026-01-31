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
const backendConfig = createBackendConfig(serverConfig)

// Start backend in standalone mode
startBackend(appInstance, backendConfig)
