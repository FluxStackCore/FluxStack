/**
 * File Regeneration Utilities
 *
 * Provides functions to regenerate critical application files that might be
 * accidentally deleted by developers.
 */

import { join } from "path"
import { existsSync } from "fs"

const BACKEND_ONLY_TEMPLATE = `/**
 * Backend Standalone Entry Point
 *
 * This is a minimal wrapper for starting the backend in standalone mode.
 * The core logic is protected in @core/server/backend-entry.ts
 *
 * You can customize the configuration here if needed.
 */

import { startBackend, createBackendConfig } from "@core/server/backend-entry"
import { apiRoutes } from "./routes"
import { serverConfig } from "@config"

// Create backend configuration from declarative config
const backendConfig = createBackendConfig(serverConfig)

// Start backend in standalone mode
startBackend(apiRoutes, backendConfig)
`

/**
 * Check if backend-only.ts exists, regenerate if missing
 */
export async function ensureBackendEntry(projectRoot: string = process.cwd()): Promise<boolean> {
  const backendOnlyPath = join(projectRoot, "app/server/backend-only.ts")

  if (!existsSync(backendOnlyPath)) {
    console.log("⚠️  backend-only.ts not found, regenerating...")

    try {
      await Bun.write(backendOnlyPath, BACKEND_ONLY_TEMPLATE)
      console.log("✅ backend-only.ts regenerated successfully")
      return true
    } catch (error) {
      console.error("❌ Failed to regenerate backend-only.ts:", error)
      return false
    }
  }

  return true
}

/**
 * Regenerate backend-only.ts file
 */
export async function regenerateBackendEntry(projectRoot: string = process.cwd()): Promise<boolean> {
  const backendOnlyPath = join(projectRoot, "app/server/backend-only.ts")

  console.log("🔄 Regenerating backend-only.ts...")

  try {
    await Bun.write(backendOnlyPath, BACKEND_ONLY_TEMPLATE)
    console.log("✅ backend-only.ts regenerated successfully")
    return true
  } catch (error) {
    console.error("❌ Failed to regenerate backend-only.ts:", error)
    return false
  }
}
