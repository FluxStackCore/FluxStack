/**
 * Frontend Standalone Entry Point
 * Starts only the Vite dev server without the Elysia backend
 *
 * Usage: bun run start:frontend
 */

import { startFrontendOnly } from "@core/client/standalone"

// ℹ️ Config is optional - startFrontendOnly reads from clientConfig automatically
// You can override defaults here if needed
await startFrontendOnly()