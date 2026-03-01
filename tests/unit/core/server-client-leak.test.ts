import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

/**
 * Server-Client Code Leak Detection Tests
 *
 * Documents and verifies that the server→client leak problem exists
 * (LiveComponent base class has runtime server imports) and that
 * the fix (fluxstack-live-strip plugin) is configured.
 */

const ROOT = resolve(__dirname, '../../..')

describe('Server-Client Code Leak Detection', () => {
  describe('LiveComponent base class has runtime server imports (the problem)', () => {
    it('types.ts imports server-only modules at runtime (not type-only)', () => {
      const typesContent = readFileSync(
        resolve(ROOT, 'core/types/types.ts'),
        'utf-8'
      )

      // These runtime imports would leak into the client bundle without the plugin
      const serverImports = [
        "import { roomEvents } from '@core/server/live/RoomEventBus'",
        "import { liveRoomManager } from '@core/server/live/LiveRoomManager'",
        "import { ANONYMOUS_CONTEXT } from '@core/server/live/auth/LiveAuthContext'",
        "import { liveLog, liveWarn } from '@core/server/live/LiveLogger'",
      ]

      const found = serverImports.filter(imp => typesContent.includes(imp))
      expect(found.length).toBeGreaterThan(0)
    })
  })

  describe('Client components use runtime imports from @server/live/', () => {
    it('client live components import server classes (not type-only)', () => {
      const clientLiveDir = resolve(ROOT, 'app/client/src/live')
      const clientFiles = readdirSync(clientLiveDir).filter((f: string) =>
        f.endsWith('.tsx') || f.endsWith('.ts')
      )

      const withServerImport: string[] = []

      for (const file of clientFiles) {
        const content = readFileSync(resolve(clientLiveDir, file), 'utf-8')
        if (/import\s+\{[^}]+\}\s+from\s+['"]@server\/live\//.test(content)) {
          withServerImport.push(file)
        }
      }

      // At least some client components import from @server/live/
      expect(withServerImport.length).toBeGreaterThan(0)
    })
  })

  describe('Fix: live-strip plugin is configured', () => {
    it('vite config uses fluxstackVitePlugins which includes the strip plugin', () => {
      const viteConfig = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf-8')
      expect(viteConfig).toContain('fluxstackVitePlugins')
    })

    it('vite-plugin-live-strip.ts exports the plugin', () => {
      const pluginSource = readFileSync(
        resolve(ROOT, 'core/build/vite-plugin-live-strip.ts'),
        'utf-8'
      )

      expect(pluginSource).toContain('export function fluxstackLiveStripPlugin')
      expect(pluginSource).toContain("name: 'fluxstack-live-strip'")
      expect(pluginSource).toContain('@server/live/')
    })
  })
})
