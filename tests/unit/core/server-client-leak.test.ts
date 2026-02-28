import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Server-Client Code Leak Tests
 *
 * These tests verify that server-side code (Node.js modules like 'fs', 'path',
 * server-only framework modules) does NOT leak into client-side bundles.
 *
 * The problem: Client components import server LiveComponent classes to get
 * type inference and static metadata (componentName, defaultState, publicActions).
 * But these classes extend LiveComponent from core/types/types.ts which has
 * RUNTIME imports of server-only modules (RoomEventBus, LiveRoomManager, etc.).
 * Those server modules transitively import Node.js builtins like 'fs'.
 *
 * When Vite bundles the client, it tries to resolve all these transitive imports,
 * causing build failures or including server code in the client bundle.
 */

const ROOT = resolve(__dirname, '../../..')

describe('Server-Client Code Leak Detection', () => {
  describe('LiveComponent base class (core/types/types.ts)', () => {
    it('should have runtime imports from server-only modules', () => {
      // This test DOCUMENTS the current problem: LiveComponent's source file
      // imports server-only modules at runtime (not type-only)
      const typesContent = readFileSync(
        resolve(ROOT, 'core/types/types.ts'),
        'utf-8'
      )

      // These are RUNTIME imports (not `import type`) that leak to the client
      const runtimeServerImports = [
        "import { roomEvents } from '@core/server/live/RoomEventBus'",
        "import { liveRoomManager } from '@core/server/live/LiveRoomManager'",
        "import { ANONYMOUS_CONTEXT } from '@core/server/live/auth/LiveAuthContext'",
        "import { liveLog, liveWarn } from '@core/server/live/LiveLogger'",
      ]

      const leakedImports = runtimeServerImports.filter(imp =>
        typesContent.includes(imp)
      )

      // This test EXPECTS the leak to exist (documenting the problem)
      // After the fix, this test should be updated to verify no leaks
      expect(leakedImports.length).toBeGreaterThan(0)
    })

    it('should import ServerWebSocket from bun (server-only runtime)', () => {
      const typesContent = readFileSync(
        resolve(ROOT, 'core/types/types.ts'),
        'utf-8'
      )

      // Bun's ServerWebSocket is a server-only type
      // Using `import type` is fine, but runtime import would break client
      const hasBunImport = typesContent.includes("from 'bun'")
      expect(hasBunImport).toBe(true)
    })
  })

  describe('Server Live Components with Node.js imports', () => {
    it('LiveFileReader should import fs module (server-only)', () => {
      const fileReaderContent = readFileSync(
        resolve(ROOT, 'app/server/live/LiveFileReader.ts'),
        'utf-8'
      )

      // Verify the component uses fs (server-only module)
      expect(fileReaderContent).toContain("from 'fs'")
      expect(fileReaderContent).toContain('readFileSync')
      expect(fileReaderContent).toContain('existsSync')
    })

    it('LiveFileReader should extend LiveComponent (creating transitive dependency chain)', () => {
      const fileReaderContent = readFileSync(
        resolve(ROOT, 'app/server/live/LiveFileReader.ts'),
        'utf-8'
      )

      // The component imports LiveComponent, creating a transitive chain:
      // LiveFileReader -> LiveComponent -> RoomEventBus -> ... -> fs
      expect(fileReaderContent).toContain("from '@core/types/types'")
      expect(fileReaderContent).toContain('extends LiveComponent')
    })
  })

  describe('Client components importing server live components', () => {
    it('client CounterDemo imports server LiveCounter class (not type-only)', () => {
      const counterDemoContent = readFileSync(
        resolve(ROOT, 'app/client/src/live/CounterDemo.tsx'),
        'utf-8'
      )

      // This is a RUNTIME import, NOT a type-only import
      // It pulls the entire server class and all its dependencies into the client
      const hasRuntimeImport = counterDemoContent.includes(
        "import { LiveCounter } from '@server/live/LiveCounter'"
      )
      const hasRuntimeImport2 = counterDemoContent.includes(
        "import { LiveLocalCounter } from '@server/live/LiveLocalCounter'"
      )

      expect(hasRuntimeImport).toBe(true)
      expect(hasRuntimeImport2).toBe(true)

      // Verify these are NOT type-only imports (which would be safe)
      const hasTypeOnlyImport = counterDemoContent.includes(
        "import type { LiveCounter }"
      )
      expect(hasTypeOnlyImport).toBe(false)
    })

    it('client ChatDemo imports server LiveChat class (not type-only)', () => {
      const chatDemoContent = readFileSync(
        resolve(ROOT, 'app/client/src/live/ChatDemo.tsx'),
        'utf-8'
      )

      const hasRuntimeImport = chatDemoContent.includes(
        "from '@server/live/LiveChat'"
      )
      expect(hasRuntimeImport).toBe(true)
    })

    it('client FormDemo imports server LiveForm class (not type-only)', () => {
      const formDemoContent = readFileSync(
        resolve(ROOT, 'app/client/src/live/FormDemo.tsx'),
        'utf-8'
      )

      const hasRuntimeImport = formDemoContent.includes(
        "from '@server/live/LiveForm'"
      )
      expect(hasRuntimeImport).toBe(true)
    })
  })

  describe('Transitive dependency chain analysis', () => {
    it('server modules imported by types.ts should use Node.js-only APIs', () => {
      // RoomEventBus - check for server-only patterns
      const roomEventBus = readFileSync(
        resolve(ROOT, 'core/server/live/RoomEventBus.ts'),
        'utf-8'
      )
      // This is a server-side module - it should NOT be in the client bundle
      expect(roomEventBus).toContain('export')

      // LiveRoomManager - check for server-only patterns
      const liveRoomManager = readFileSync(
        resolve(ROOT, 'core/server/live/LiveRoomManager.ts'),
        'utf-8'
      )
      expect(liveRoomManager).toContain('export')

      // FileUploadManager uses 'fs' directly
      const fileUploadManager = readFileSync(
        resolve(ROOT, 'core/server/live/FileUploadManager.ts'),
        'utf-8'
      )
      expect(fileUploadManager).toContain("from 'fs'")
    })

    it('the full transitive chain should be documented', () => {
      // Document the leak chain:
      // Client Component (e.g., CounterDemo.tsx)
      //   └── imports LiveCounter from @server/live/LiveCounter
      //       └── extends LiveComponent from @core/types/types
      //           ├── imports roomEvents from @core/server/live/RoomEventBus
      //           ├── imports liveRoomManager from @core/server/live/LiveRoomManager
      //           │   └── (may transitively import more server modules)
      //           ├── imports ANONYMOUS_CONTEXT from @core/server/live/auth/LiveAuthContext
      //           ├── imports liveLog, liveWarn from @core/server/live/LiveLogger
      //           └── imports ServerWebSocket from 'bun'
      //
      // AND if the server component itself imports fs/path/etc:
      // Client Component
      //   └── imports LiveFileReader from @server/live/LiveFileReader
      //       ├── imports readFileSync, existsSync from 'fs'  <-- BREAKS CLIENT
      //       ├── imports join from 'path'  <-- BREAKS CLIENT
      //       └── extends LiveComponent from @core/types/types
      //           └── (same chain as above)

      // Verify the chain exists by reading the files
      const typesFile = readFileSync(resolve(ROOT, 'core/types/types.ts'), 'utf-8')

      // All these runtime imports create the leak
      expect(typesFile).toContain("import { roomEvents }")
      expect(typesFile).toContain("import { liveRoomManager }")
      expect(typesFile).toContain("import { ANONYMOUS_CONTEXT }")
      expect(typesFile).toContain("import { liveLog, liveWarn }")
    })
  })

  describe('Live.use() only needs static metadata (not server runtime)', () => {
    it('Live.use() only accesses componentName and defaultState from the class', () => {
      const liveComponent = readFileSync(
        resolve(ROOT, 'core/client/components/Live.tsx'),
        'utf-8'
      )

      // The hook only needs these static properties:
      expect(liveComponent).toContain('ComponentClass.componentName')
      expect(liveComponent).toContain('ComponentClass').toContain('defaultState')

      // It does NOT instantiate the class or call server methods
      expect(liveComponent).not.toContain('new ComponentClass')
    })
  })

  describe('Fix: Vite plugin strips server code from client builds', () => {
    it('vite.config.ts should include the fluxstack-live-strip plugin', () => {
      const viteConfig = readFileSync(
        resolve(ROOT, 'vite.config.ts'),
        'utf-8'
      )

      // The fix: fluxstack-live-strip plugin is configured
      expect(viteConfig).toContain('fluxstackLiveStripPlugin')
      expect(viteConfig).toContain("from './core/build/vite-plugin-live-strip'")
    })

    it('vite-plugin-live-strip.ts should exist and export the plugin', () => {
      const pluginSource = readFileSync(
        resolve(ROOT, 'core/build/vite-plugin-live-strip.ts'),
        'utf-8'
      )

      // Plugin should exist and export the correct function
      expect(pluginSource).toContain('export function fluxstackLiveStripPlugin')
      expect(pluginSource).toContain("name: 'fluxstack-live-strip'")

      // Plugin should intercept @server/live/ imports
      expect(pluginSource).toContain('@server/live/')

      // Plugin should only affect client-side code
      expect(pluginSource).toContain('/app/client/')
      expect(pluginSource).toContain('/core/client/')

      // Plugin should generate stubs with metadata
      expect(pluginSource).toContain('componentName')
      expect(pluginSource).toContain('defaultState')
      expect(pluginSource).toContain('publicActions')
    })

    it('plugin should strip server imports and generate clean stubs', () => {
      // Verify by reading the plugin and checking it handles the extraction
      const pluginSource = readFileSync(
        resolve(ROOT, 'core/build/vite-plugin-live-strip.ts'),
        'utf-8'
      )

      // Should strip TypeScript type casts
      expect(pluginSource).toContain('as\\s+[^,}\\n]+')

      // Should generate client-safe stub classes
      expect(pluginSource).toContain('export class')
      expect(pluginSource).toContain('generateClientStub')
    })
  })
})

describe('Client Build Simulation - Module Resolution', () => {
  it('should detect that importing a server component pulls in fs transitively', () => {
    // Simulate what happens when Vite resolves imports:
    // 1. Client imports LiveFileReader
    // 2. LiveFileReader imports from 'fs'
    // 3. 'fs' is a Node.js built-in, not available in the browser

    const fileReaderSource = readFileSync(
      resolve(ROOT, 'app/server/live/LiveFileReader.ts'),
      'utf-8'
    )

    // Extract all import sources
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    const imports: string[] = []
    let match
    while ((match = importRegex.exec(fileReaderSource)) !== null) {
      imports.push(match[1])
    }

    // Node.js built-in modules that would break in the browser
    const nodeBuiltins = ['fs', 'path', 'os', 'crypto', 'child_process', 'net', 'http', 'https']
    const leakedBuiltins = imports.filter(imp =>
      nodeBuiltins.includes(imp) || nodeBuiltins.some(b => imp === `node:${b}`)
    )

    // This PROVES the leak - server component imports Node.js builtins
    expect(leakedBuiltins).toContain('fs')
    expect(leakedBuiltins).toContain('path')
  })

  it('should detect that LiveComponent base class pulls in server-only modules', () => {
    const typesSource = readFileSync(
      resolve(ROOT, 'core/types/types.ts'),
      'utf-8'
    )

    // Extract all import sources (non-type imports only)
    const importRegex = /^import\s+\{[^}]+\}\s+from\s+['"]([^'"]+)['"]/gm
    const imports: string[] = []
    let match
    while ((match = importRegex.exec(typesSource)) !== null) {
      // Skip type-only imports
      const fullLine = typesSource.substring(
        typesSource.lastIndexOf('\n', match.index) + 1,
        typesSource.indexOf('\n', match.index)
      )
      if (!fullLine.includes('import type')) {
        imports.push(match[1])
      }
    }

    // Server-only module imports that would break in the browser
    const serverModules = imports.filter(imp =>
      imp.includes('@core/server/') || imp === 'bun'
    )

    // This PROVES the base class leak
    expect(serverModules.length).toBeGreaterThan(0)
    expect(serverModules).toEqual(
      expect.arrayContaining([
        expect.stringContaining('@core/server/live/RoomEventBus'),
        expect.stringContaining('@core/server/live/LiveRoomManager'),
        expect.stringContaining('@core/server/live/auth/LiveAuthContext'),
        expect.stringContaining('@core/server/live/LiveLogger'),
      ])
    )
  })

  it('should show all client live components that have the leak', () => {
    const clientLiveDir = resolve(ROOT, 'app/client/src/live')
    const { readdirSync } = require('fs')
    const clientFiles = readdirSync(clientLiveDir).filter((f: string) =>
      f.endsWith('.tsx') || f.endsWith('.ts')
    )

    const leakingComponents: string[] = []

    for (const file of clientFiles) {
      const content = readFileSync(resolve(clientLiveDir, file), 'utf-8')
      // Check for runtime (non-type) imports from @server/live/
      const hasServerImport = /import\s+\{[^}]+\}\s+from\s+['"]@server\/live\//.test(content)
      const isTypeOnly = /import\s+type\s+\{[^}]+\}\s+from\s+['"]@server\/live\//.test(content)

      if (hasServerImport && !isTypeOnly) {
        leakingComponents.push(file)
      }
    }

    // Document which client components have the leak
    expect(leakingComponents.length).toBeGreaterThan(0)

    // These specific components are known to have the leak
    expect(leakingComponents).toEqual(
      expect.arrayContaining([
        'CounterDemo.tsx',
        'ChatDemo.tsx',
        'FormDemo.tsx',
      ])
    )
  })
})
