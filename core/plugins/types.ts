/**
 * FluxStack plugin types — thin re-export layer over @fluxstack/plugin-kit.
 *
 * Historically this file was the canonical source. As of the plugin-kit
 * extraction (see .ai-notes/plans/2026-04-11-plugin-kit-extraction.md),
 * the canonical source is `@fluxstack/plugin-kit`. This file exists to:
 *
 * 1. Preserve every existing `import ... from '@core/plugins/types'` call
 *    site in the FluxStack app — no downstream code needs to change.
 * 2. Specialize the generic `<TConfig>` parameters against FluxStack's
 *    concrete `FluxStackConfig`, so consumers get full autocomplete
 *    against the app's real config shape.
 *
 * Future PRs will migrate individual call sites to import directly from
 * `@fluxstack/plugin-kit` and this shim will eventually be deleted.
 */

import type { FluxStackConfig } from '@config'
import type {
  Plugin as BasePlugin,
  PluginContext as BasePluginContext,
  BuildContext as BaseBuildContext,
  ConfigLoadContext as BaseConfigLoadContext,
  CliCommand as BaseCliCommand,
  CliContext as BaseCliContext,
  PluginLoadResult as BasePluginLoadResult,
  PluginRegistryState as BasePluginRegistryState,
  PluginExecutionContext as BasePluginExecutionContext,
} from '@fluxstack/plugin-kit'

// ─── Specialized generics (FluxStack passes FluxStackConfig everywhere) ───

export type Plugin = BasePlugin<FluxStackConfig>
export type PluginContext = BasePluginContext<FluxStackConfig>
export type BuildContext = BaseBuildContext<FluxStackConfig>
export type ConfigLoadContext = BaseConfigLoadContext<FluxStackConfig>
export type CliCommand = BaseCliCommand<FluxStackConfig>
export type CliContext = BaseCliContext<FluxStackConfig>
export type PluginLoadResult = BasePluginLoadResult<FluxStackConfig>
export type PluginRegistryState = BasePluginRegistryState<FluxStackConfig>
export type PluginExecutionContext = BasePluginExecutionContext<FluxStackConfig>

// ─── Straight re-exports (no generic to specialize) ───

export type {
  Logger,
  PluginHook,
  PluginPriority,
  PluginLifecycleEvent,
  HookExecutionOptions,
  PluginClientHooksAPI,
  PluginUtils,
  PluginConfigSchema,
  RequestContext,
  ResponseContext,
  ErrorContext,
  RouteContext,
  ValidationContext,
  TransformContext,
  BuildAssetContext,
  BuildErrorContext,
  PluginEventContext,
  CliArgument,
  CliOption,
  PluginManifest,
  PluginHookResult,
  PluginMetrics,
  PluginDiscoveryOptions,
  PluginInstallOptions,
  PluginValidationResult,
} from '@fluxstack/plugin-kit'

// ─── Namespace backward-compat ───
// Legacy code uses `FluxStack.Plugin` — keep that form working.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FluxStack {
  export type Plugin = BasePlugin<FluxStackConfig>
}
