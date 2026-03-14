import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Server-Client Code Leak Detection Tests
 *
 * Verifies that the live-strip plugin is configured to prevent
 * server code from leaking into the client bundle.
 *
 * After migration to @fluxstack/live, the strip plugin comes from
 * the library and core/types/types.ts is a thin re-export barrel.
 */

const ROOT = resolve(__dirname, '../../..')

describe('Server-Client Code Leak Detection', () => {
  describe('core/types/types.ts re-exports from @fluxstack/live', () => {
    it('types.ts re-exports LiveComponent from @fluxstack/live', () => {
      const typesContent = readFileSync(
        resolve(ROOT, 'core/types/types.ts'),
        'utf-8'
      )

      expect(typesContent).toContain("from '@fluxstack/live'")
      expect(typesContent).toContain('LiveComponent')
    })
  })

  describe('Fix: live-strip plugin is configured', () => {
    it('vite config uses fluxstackVitePlugins which includes the strip plugin', () => {
      const viteConfig = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf-8')
      expect(viteConfig).toContain('fluxstackVitePlugins')
    })

    it('vite-plugins.ts imports liveStripPlugin from @fluxstack/live/build', () => {
      const pluginsSource = readFileSync(
        resolve(ROOT, 'core/build/vite-plugins.ts'),
        'utf-8'
      )

      expect(pluginsSource).toContain("from '@fluxstack/live/build'")
      expect(pluginsSource).toContain('liveStripPlugin')
    })
  })
})
