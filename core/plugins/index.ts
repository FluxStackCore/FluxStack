/**
 * Thin shim barrel over @fluxstack/plugin-kit.
 *
 * All plugin system types and runtime live in @fluxstack/plugin-kit
 * now (see .ai-notes/plans/2026-04-11-plugin-kit-extraction.md).
 * This barrel just re-exports them. The FluxStack-specialized type
 * aliases (Plugin = Plugin<FluxStackConfig>, PluginContext =
 * PluginContext<FluxStackConfig>, etc.) come from the local
 * `./types` shim so legacy `import { Plugin } from '@core/plugins'`
 * call sites stay typed against FluxStack's concrete config shape.
 */

// ─── Runtime + non-specialized types (from the lib) ──────────

export {
  PluginRegistry,
  PluginDiscovery,
  PluginManager,
  PluginModuleResolver,
  PluginExecutor,
  calculateExecutionStats,
  createPluginUtils,
  createRequestContext,
  createResponseContext,
  createErrorContext,
  createBuildContext,
  PluginError,
} from '@fluxstack/plugin-kit'

export type {
  FluxStack,
  PluginHook,
  PluginPriority,
  PluginManifest,
  PluginHookResult,
  PluginMetrics,
  PluginDiscoveryOptions,
  PluginInstallOptions,
  PluginValidationResult,
  HookExecutionOptions,
  PluginLifecycleEvent,
  PluginConfigSchema,
  PluginRegistryConfig,
  PluginRegistrySettings,
  PluginDiscoveryConfig,
  PluginManagerConfig,
  ModuleResolverConfig,
  PluginExecutionPlan,
  PluginExecutionStep,
  PluginExecutionStats,
} from '@fluxstack/plugin-kit'

// ─── FluxStack-specialized type aliases (from the local shim) ───

export type {
  Plugin,
  PluginContext,
  RequestContext,
  ResponseContext,
  ErrorContext,
  RouteContext,
  ValidationContext,
  TransformContext,
  BuildContext,
  BuildAssetContext,
  BuildErrorContext,
  ConfigLoadContext,
  PluginEventContext,
  CliArgument,
  CliOption,
  CliCommand,
  CliContext,
  PluginLoadResult,
  PluginRegistryState,
  PluginExecutionContext,
  PluginClientHooksAPI,
  PluginUtils,
  Logger,
} from './types'
