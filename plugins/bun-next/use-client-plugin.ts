/**
 * "use client" Scanner, Builder & Manifest Generator
 *
 * 1. Scans .tsx/.ts files for the "use client" directive
 * 2. Builds client components as separate chunks via Bun.build()
 * 3. Generates a manifest mapping componentId → chunk URL
 *
 * The chunks are served statically by the SSR renderer.
 */

import { resolve, relative } from "path"
import { existsSync, mkdirSync } from "fs"
import reactDedupe from "./react-dedupe-plugin"

export interface ClientManifestEntry {
  source: string
  chunkUrl: string
}

export type ClientManifest = Record<string, ClientManifestEntry>

const USE_CLIENT_RE = /^['"]use client['"]/

const CHUNKS_DIR = "dist/ssr-chunks"

/**
 * Scan a directory for .tsx/.ts files with "use client" directive.
 */
export function scanClientComponents(srcDir: string): Map<string, string> {
  const clients = new Map<string, string>()
  const projectRoot = resolve(".")
  const glob = new Bun.Glob("**/*.{tsx,ts}")

  for (const filePath of glob.scanSync({ cwd: srcDir, onlyFiles: true })) {
    const absolutePath = resolve(srcDir, filePath)
    try {
      const content = require("fs").readFileSync(absolutePath, "utf-8")
      const firstLine = content.split("\n").find((l: string) =>
        l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("/*")
      )
      if (firstLine && USE_CLIENT_RE.test(firstLine.trim())) {
        const relativePath = relative(projectRoot, absolutePath).replaceAll("\\", "/")
        const componentId = relativePath.replace(/\.(tsx?|jsx?)$/, "")
        clients.set(componentId, relativePath)
      }
    } catch {}
  }

  return clients
}

/**
 * Build client component chunks using Bun.build() with code splitting.
 * Returns a map of source path → output chunk filename.
 */
export async function buildClientChunks(
  clientComponents: Map<string, string>,
): Promise<Map<string, string>> {
  const outputMap = new Map<string, string>()

  if (clientComponents.size === 0) return outputMap

  // Also include the bootstrap as an entry point
  const bootstrapPath = resolve("app/client/src/client-bootstrap.ts")
  const entrypoints = [...clientComponents.values()].map(p => `./${p}`)
  if (existsSync(bootstrapPath)) {
    entrypoints.push("./app/client/src/client-bootstrap.ts")
  }

  const outdir = resolve(CHUNKS_DIR)
  if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true })

  const result = await Bun.build({
    entrypoints,
    outdir,
    splitting: true,
    target: "browser",
    format: "esm",
    minify: false,
    naming: "[name]-[hash].[ext]",
    plugins: [
      reactDedupe,
      {
        name: "strip-server-imports",
        setup(build) {
          // Stub server-only imports (used for types in client code)
          build.onResolve({ filter: /^@server\// }, (args) => ({
            path: args.path,
            namespace: "server-stub",
          }))
          build.onResolve({ filter: /^@(core|config)\// }, (args) => ({
            path: args.path,
            namespace: "server-stub",
          }))
          build.onResolve({ filter: /^@config$/ }, (args) => ({
            path: args.path,
            namespace: "server-stub",
          }))
          build.onLoad({ filter: /.*/, namespace: "server-stub" }, (args) => {
            // Extract component name from path: @server/live/LiveCounter → LiveCounter
            const segments = args.path.split("/")
            const lastName = segments[segments.length - 1] || "Unknown"

            // Generate a stub class with componentName + defaultState
            // This allows Live.use(LiveCounter, ...) to work correctly
            const stubClass = `class ${lastName} {
  static componentName = '${lastName}';
  static defaultState = {};
}`

            return {
              contents: [
                `export default {};`,
                stubClass,
                `export { ${lastName} };`,
                // Common utility exports
                `export const executeHook = () => {};`,
                `export const useLiveUpload = () => ({});`,
                `export const LiveComponentsProvider = ({children}) => children;`,
                `export const useLiveComponents = () => ({});`,
                `export const Live = { use: () => ({}) };`,
                `export const api = new Proxy({}, { get: () => () => ({}) });`,
              ].join("\n"),
              loader: "js",
            }
          })
        },
      },
    ],
  })

  if (!result.success) {
    console.error("Client chunk build failed:")
    for (const log of result.logs) {
      console.error(log)
    }
    return outputMap
  }

  // Map source paths to output filenames
  for (const output of result.outputs) {
    if (output.kind === "entry-point") {
      const outName = output.path.replace(/\\/g, "/").split("/").pop()!
      // Find which source this entry corresponds to
      const loader = output.loader
      // Use the output's sourcefile or match by name
      const baseName = outName.replace(/-[a-z0-9]+\.js$/, "")
      for (const [componentId, sourcePath] of clientComponents) {
        const sourceBase = sourcePath.split("/").pop()!.replace(/\.(tsx?|jsx?)$/, "")
        if (sourceBase === baseName) {
          outputMap.set(componentId, outName)
          break
        }
      }
      // Check if it's the bootstrap
      if (baseName === "client-bootstrap") {
        outputMap.set("__bootstrap__", outName)
      }
    }
  }

  return outputMap
}

/**
 * Generate manifest from built chunks.
 */
export function generateManifestFromChunks(
  clientComponents: Map<string, string>,
  chunkMap: Map<string, string>,
  chunksUrlPrefix: string,
): ClientManifest {
  const manifest: ClientManifest = {}

  for (const [componentId, sourcePath] of clientComponents) {
    const chunkFile = chunkMap.get(componentId)
    manifest[componentId] = {
      source: sourcePath,
      chunkUrl: chunkFile ? `${chunksUrlPrefix}/${chunkFile}` : "",
    }
  }

  return manifest
}

/** Singleton cache */
let cachedManifest: ClientManifest | null = null
let cachedComponents: Map<string, string> | null = null
let cachedChunkMap: Map<string, string> | null = null

/**
 * Scan, build chunks, and generate manifest.
 */
export async function buildAndGetManifest(
  srcDir: string,
  chunksUrlPrefix: string,
): Promise<{ manifest: ClientManifest; bootstrapChunk: string }> {
  cachedComponents = scanClientComponents(srcDir)
  console.log(`[use-client] Found ${cachedComponents.size} client component(s)`)

  cachedChunkMap = await buildClientChunks(cachedComponents)
  console.log(`[use-client] Built ${cachedChunkMap.size} chunk(s)`)

  cachedManifest = generateManifestFromChunks(
    cachedComponents,
    cachedChunkMap,
    chunksUrlPrefix,
  )

  const bootstrapChunk = cachedChunkMap.get("__bootstrap__") || ""

  return { manifest: cachedManifest, bootstrapChunk }
}

export function getManifest(): ClientManifest {
  return cachedManifest || {}
}

export function invalidateManifest(): void {
  cachedManifest = null
  cachedComponents = null
  cachedChunkMap = null
}
