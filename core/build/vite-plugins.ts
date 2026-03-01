/**
 * FluxStack internal Vite plugins.
 *
 * Returns all framework-level Vite plugins that should be registered
 * automatically. Consumers just call `fluxstackVitePlugins()` in their
 * vite.config.ts — no need to know about individual internal plugins.
 */

import type { Plugin } from 'vite'
import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'
import checker from 'vite-plugin-checker'
import { liveStripPlugin } from '@fluxstack/live/build'
import { helpers } from '../utils/env'

export function fluxstackVitePlugins(): Plugin[] {
  return [
    liveStripPlugin({ verbose: false }),
    tsconfigPaths({
      projects: [resolve(import.meta.dirname, '..', '..', 'tsconfig.json')]
    }),
    // Only run type checker in development (saves ~5+ minutes in Docker builds)
    helpers.isDevelopment() && checker({
      typescript: true,
      overlay: true
    }),
  ].filter(Boolean) as Plugin[]
}
