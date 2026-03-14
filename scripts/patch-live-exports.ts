/**
 * Temporary postinstall patch for @fluxstack/live packages.
 *
 * The published packages (v0.3.0) include a "bun" export condition pointing to
 * ./src/index.ts, but the npm tarball only ships dist/. On Linux, Bun's bundler
 * fails to resolve the package because src/ doesn't exist.
 *
 * This script removes the "bun" condition from exports so Bun falls back to
 * the "import" condition (./dist/index.js) which works correctly.
 *
 * TODO: Remove this script after publishing @fluxstack/live >= 0.3.1
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

const packages = [
  "node_modules/@fluxstack/live/package.json",
  "node_modules/@fluxstack/live-client/package.json",
  "node_modules/@fluxstack/live-react/package.json",
  "node_modules/@fluxstack/live-elysia/package.json",
]

for (const pkgPath of packages) {
  const fullPath = join(process.cwd(), pkgPath)
  if (!existsSync(fullPath)) continue

  try {
    const pkg = JSON.parse(readFileSync(fullPath, "utf-8"))
    let patched = false

    if (pkg.exports) {
      for (const [key, value] of Object.entries(pkg.exports)) {
        if (typeof value === "object" && value !== null && "bun" in value) {
          delete (value as Record<string, unknown>).bun
          patched = true
        }
      }
    }

    if (patched) {
      writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + "\n")
      console.log(`Patched exports in ${pkgPath}`)
    }
  } catch {
    // Ignore errors - package might not be installed yet
  }
}
