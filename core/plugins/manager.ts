/**
 * Thin shim over @fluxstack/plugin-kit's PluginManager + helpers.
 *
 * Historically this file was the canonical implementation (644 lines).
 * As of the plugin-kit extraction (phase 3.4), the implementation lives
 * in @fluxstack/plugin-kit. This shim exists to preserve every existing
 * `import { PluginManager } from '@core/plugins/manager'` call site in
 * the FluxStack app.
 *
 * Note: the plugin-kit's PluginManager is generic over the host-app's
 * config type (`PluginManager<TConfig>`). FluxStack consumers pass
 * `FluxStackConfig` as the generic argument when instantiating.
 */

export {
  PluginManager,
  createRequestContext,
  createResponseContext,
  createErrorContext,
  createBuildContext,
  type PluginManagerConfig,
} from '@fluxstack/plugin-kit'
