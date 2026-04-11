/**
 * Thin shim over @fluxstack/plugin-kit's PluginExecutor.
 * See phase 3.2 of the plugin-kit extraction plan.
 */

export {
  PluginExecutor,
  calculateExecutionStats,
  type PluginExecutionPlan,
  type PluginExecutionStep,
  type PluginExecutionStats,
} from '@fluxstack/plugin-kit'
