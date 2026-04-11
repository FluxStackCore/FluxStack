/**
 * Thin shim over @fluxstack/plugin-kit's PluginRegistry.
 *
 * Historically this file was the canonical implementation (913 lines).
 * As of the plugin-kit extraction (phase 3.3), the implementation lives
 * in @fluxstack/plugin-kit. This shim exists to preserve every existing
 * `import { PluginRegistry } from '@core/plugins/registry'` call site
 * in the FluxStack app.
 *
 * Future PRs will migrate call sites to import directly from
 * `@fluxstack/plugin-kit` and this shim will be deleted (phase 4).
 */

export {
  PluginRegistry,
  type PluginRegistryConfig,
  type PluginRegistrySettings,
} from '@fluxstack/plugin-kit'
