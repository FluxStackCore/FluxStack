/**
 * FluxStack Vite Plugin - Live Component Server Code Stripping
 *
 * Problem: Client components import server LiveComponent classes to get type inference
 * and static metadata (componentName, defaultState, publicActions). But these classes
 * extend LiveComponent from core/types/types.ts which has RUNTIME imports of server-only
 * modules (RoomEventBus, LiveRoomManager, etc.) that transitively import Node.js builtins
 * like 'fs'. Additionally, server components themselves may import 'fs', 'path', etc.
 *
 * Solution: This Vite plugin intercepts imports from `@server/live/*` and
 * `app/server/live/*` during the client build. Instead of loading the full server
 * module (with all its Node.js dependencies), it generates a lightweight client stub
 * that only exports the static metadata the client actually needs.
 *
 * The client only needs:
 * - componentName (string)
 * - defaultState (plain object)
 * - publicActions (string array)
 *
 * Everything else (the class methods, the LiveComponent base class, fs/path imports)
 * is stripped out.
 */

import { readFileSync } from 'fs'
import { resolve, isAbsolute } from 'path'
import type { Plugin } from 'vite'

/**
 * Parse a server live component file and extract static metadata.
 * Uses regex-based parsing to avoid executing the file.
 */
function extractComponentMetadata(source: string): {
  className: string
  componentName: string | null
  defaultState: string | null
  publicActions: string | null
}[] {
  const components: {
    className: string
    componentName: string | null
    defaultState: string | null
    publicActions: string | null
  }[] = []

  // Find all exported classes that extend LiveComponent
  const classRegex = /export\s+class\s+(\w+)\s+extends\s+LiveComponent/g
  let classMatch

  while ((classMatch = classRegex.exec(source)) !== null) {
    const className = classMatch[1]

    // Find the class body by counting braces from the match position
    const classStartIndex = source.indexOf('{', classMatch.index)
    if (classStartIndex === -1) continue

    let braceCount = 1
    let i = classStartIndex + 1
    while (i < source.length && braceCount > 0) {
      if (source[i] === '{') braceCount++
      else if (source[i] === '}') braceCount--
      i++
    }
    const classBody = source.substring(classStartIndex, i)

    // Extract static componentName
    const componentNameMatch = classBody.match(
      /static\s+componentName\s*=\s*['"]([^'"]+)['"]/
    )
    const componentName = componentNameMatch ? componentNameMatch[1] : null

    // Extract static defaultState - capture the full object literal
    let defaultState: string | null = null
    const defaultStateStart = classBody.match(
      /static\s+defaultState\s*=\s*/
    )
    if (defaultStateStart) {
      const stateStartIdx = defaultStateStart.index! + defaultStateStart[0].length
      // Find the start of the value
      const valueStart = classBody.indexOf('{', stateStartIdx)
      if (valueStart !== -1) {
        // Count braces to find the full object
        let bCount = 1
        let j = valueStart + 1
        while (j < classBody.length && bCount > 0) {
          if (classBody[j] === '{') bCount++
          else if (classBody[j] === '}') bCount--
          j++
        }
        defaultState = classBody.substring(valueStart, j)
      }
    }

    // Extract static publicActions
    const publicActionsMatch = classBody.match(
      /static\s+publicActions\s*=\s*(\[[^\]]*\])/
    )
    const publicActions = publicActionsMatch ? publicActionsMatch[1] : null

    components.push({
      className,
      componentName,
      defaultState,
      publicActions,
    })
  }

  return components
}

/**
 * Generate a client-safe stub module for a server live component file.
 * The stub only contains the static metadata (no server runtime dependencies).
 */
function generateClientStub(filePath: string): string {
  const source = readFileSync(filePath, 'utf-8')
  const components = extractComponentMetadata(source)

  if (components.length === 0) {
    // No LiveComponent classes found, return empty module
    return 'export {}'
  }

  const stubs: string[] = []

  for (const comp of components) {
    // Build a minimal class stub with only static metadata
    const componentName = comp.componentName || comp.className
    const defaultState = comp.defaultState || '{}'
    const publicActions = comp.publicActions || '[]'

    // Clean up defaultState: remove TypeScript type casts like `as string | null`
    // These cause syntax errors in plain JavaScript
    const cleanDefaultState = defaultState
      .replace(/\s+as\s+[^,}\n]+/g, '')

    stubs.push(`
export class ${comp.className} {
  static componentName = '${componentName}'
  static defaultState = ${cleanDefaultState}
  static publicActions = ${publicActions}
}
`)
  }

  // Also re-export any non-class exports (like type/interface exports are erased,
  // but exported constants or broadcast interfaces might exist)
  // We only need the class stubs for Live.use()

  return stubs.join('\n')
}

/**
 * Vite plugin that strips server-side code from live component imports
 * when building for the client.
 */
export function fluxstackLiveStripPlugin(): Plugin {
  let rootDir: string

  return {
    name: 'fluxstack-live-strip',
    enforce: 'pre',

    configResolved(config) {
      rootDir = config.root
    },

    resolveId(source, importer) {
      // Only process @server/live/* imports from client code
      if (!source.match(/^@server\/live\//)) return null

      // Only strip when the importer is client-side code
      if (!importer) return null

      // Check if the importer is client-side
      const isClientImporter =
        importer.includes('/app/client/') ||
        importer.includes('/core/client/')

      if (!isClientImporter) return null

      // Resolve to the actual file path but mark it as needing transformation
      const componentFile = source.replace('@server/', 'app/server/')
      const resolvedPath = resolve(rootDir, componentFile)

      // Add .ts extension if needed
      const tsPath = resolvedPath.endsWith('.ts') ? resolvedPath : resolvedPath + '.ts'

      // Return a virtual module ID to intercept the load
      return `\0fluxstack-live-strip:${tsPath}`
    },

    load(id) {
      if (!id.startsWith('\0fluxstack-live-strip:')) return null

      const filePath = id.replace('\0fluxstack-live-strip:', '')

      try {
        return generateClientStub(filePath)
      } catch (err: any) {
        this.warn(`Failed to generate client stub for ${filePath}: ${err.message}`)
        return 'export {}'
      }
    },
  }
}
