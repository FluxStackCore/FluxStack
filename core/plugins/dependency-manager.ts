/**
 * Thin shim over @fluxstack/plugin-kit's PluginDependencyManager.
 * See phase 3.1 of the plugin-kit extraction plan.
 */

export {
  PluginDependencyManager,
  type PluginDependency,
  type DependencyResolution,
  type DependencyConflict,
  type DependencyManagerConfig,
} from '@fluxstack/plugin-kit'
