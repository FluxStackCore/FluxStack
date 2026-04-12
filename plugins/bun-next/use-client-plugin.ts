/**
 * "use client" Scanner & Manifest Generator
 *
 * Scans .tsx/.ts files for the "use client" directive at the top.
 * Generates a manifest mapping component IDs to their chunk URLs.
 *
 * In dev: URLs point to the internal Bun.serve() bundler
 * In prod: URLs point to pre-built hashed chunks
 */

import { resolve, relative } from "path"

export interface ClientManifestEntry {
  /** Source file path relative to project root */
  source: string
  /** URL to load the client chunk from */
  chunkUrl: string
}

export type ClientManifest = Record<string, ClientManifestEntry>

const USE_CLIENT_RE = /^['"]use client['"]/

/**
 * Scan a directory for .tsx/.ts files with "use client" directive.
 * Returns a Map of componentId → source path.
 */
export function scanClientComponents(srcDir: string): Map<string, string> {
  const clients = new Map<string, string>()
  const projectRoot = resolve(".")
  const glob = new Bun.Glob("**/*.{tsx,ts}")

  for (const filePath of glob.scanSync({ cwd: srcDir, onlyFiles: true })) {
    const absolutePath = resolve(srcDir, filePath)
    try {
      const content = require("fs").readFileSync(absolutePath, "utf-8")
      const firstLine = content.split("\n").find((l: string) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("/*"))
      if (firstLine && USE_CLIENT_RE.test(firstLine.trim())) {
        const relativePath = relative(projectRoot, absolutePath).replaceAll("\\", "/")
        // Component ID is the relative path without extension
        const componentId = relativePath.replace(/\.(tsx?|jsx?)$/, "")
        clients.set(componentId, relativePath)
      }
    } catch {
      // Skip unreadable files
    }
  }

  return clients
}

/**
 * Generate the client manifest for dev mode.
 * Maps componentId → chunk URL on the internal Bun.serve() bundler.
 */
export function generateDevManifest(
  clientComponents: Map<string, string>,
  internalPort: number,
): ClientManifest {
  const manifest: ClientManifest = {}

  for (const [componentId, sourcePath] of clientComponents) {
    // Strip "app/client/" prefix — Bun.serve() root is app/client/
    const chunkPath = sourcePath.replace(/^app\/client\//, "")
    manifest[componentId] = {
      source: sourcePath,
      chunkUrl: `/${chunkPath}`,
    }
  }

  return manifest
}

/**
 * Generate the client manifest for production.
 */
export function generateProdManifest(
  clientComponents: Map<string, string>,
  buildOutputDir: string,
): ClientManifest {
  const manifest: ClientManifest = {}
  for (const [componentId, sourcePath] of clientComponents) {
    const chunkPath = sourcePath.replace(/^app\/client\//, "")
    manifest[componentId] = {
      source: sourcePath,
      chunkUrl: `/${chunkPath}`,
    }
  }

  return manifest
}

/** Singleton manifest cache */
let cachedManifest: ClientManifest | null = null
let cachedComponents: Map<string, string> | null = null

/**
 * Get or create the client manifest.
 */
export function getClientManifest(srcDir: string, internalPort: number, isDev: boolean): ClientManifest {
  if (cachedManifest) return cachedManifest

  cachedComponents = scanClientComponents(srcDir)
  cachedManifest = isDev
    ? generateDevManifest(cachedComponents, internalPort)
    : generateProdManifest(cachedComponents, "dist/client")

  return cachedManifest
}

/**
 * Check if a component ID is a client component.
 */
export function isClientComponent(componentId: string): boolean {
  if (!cachedComponents) return false
  return cachedComponents.has(componentId)
}

/**
 * Reset the manifest cache (for HMR/rebuilds).
 */
export function invalidateManifest(): void {
  cachedManifest = null
  cachedComponents = null
}
