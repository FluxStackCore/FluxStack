/**
 * FluxStack CLI - Build Command
 * Build the application for production
 */

import type { CLICommand } from '../command-registry'
import { FluxStackBuilder } from '@core/build'
import { fluxStackConfig } from '@config'
import {
  PluginRegistry,
  PluginManager,
  type FluxStack,
} from '@fluxstack/plugin-kit'
import type { FluxStackConfig } from '@config'
import { pluginClientHooks } from '@core/server/plugin-client-hooks'

export const buildCommand: CLICommand = {
  name: 'build',
  description: 'Build the application for production',
  category: 'Build',
  usage: 'flux build [options]',
  examples: [
    'flux build                  # Build both frontend and backend',
    'flux build --frontend-only  # Build only frontend',
    'flux build --backend-only   # Build only backend'
  ],
  options: [
    {
      name: 'frontend-only',
      description: 'Build only frontend',
      type: 'boolean'
    },
    {
      name: 'backend-only',
      description: 'Build only backend',
      type: 'boolean'
    },
    {
      name: 'production',
      description: 'Build for production (minified)',
      type: 'boolean',
      default: true
    }
  ],
  handler: async (args, options, context) => {
    const config = fluxStackConfig

    // Load plugins for build hooks. PluginRegistry + PluginManager now
    // come from @fluxstack/plugin-kit (the single source of truth).
    // Both constructors expect the plugin-related config slice explicitly
    // via `settings`, and the manager additionally requires `clientHooks`.
    const pluginRegistry = new PluginRegistry({
      logger: context.logger,
      settings: config.plugins,
    })
    const pluginManager = new PluginManager<FluxStackConfig>({
      config,
      settings: config.plugins,
      logger: context.logger,
      clientHooks: {
        register: (hookName: string, jsCode: string) =>
          pluginClientHooks.register(hookName, jsCode),
      },
    })

    try {
      await pluginManager.initialize()
      // Sync plugins to registry (same as framework does)
      const discoveredPlugins = pluginManager.getRegistry().getAll()
      const registryInternals = pluginRegistry as unknown as {
        plugins: Map<string, FluxStack.Plugin>
        dependencies: Map<string, string[]>
        loadOrder: string[]
        updateLoadOrder(): void
      }
      for (const plugin of discoveredPlugins) {
        if (!pluginRegistry.has(plugin.name)) {
          registryInternals.plugins.set(plugin.name, plugin)
          if (plugin.dependencies) {
            registryInternals.dependencies.set(plugin.name, plugin.dependencies)
          }
        }
      }
      try {
        registryInternals.updateLoadOrder()
      } catch {
        registryInternals.loadOrder = Array.from(registryInternals.plugins.keys())
      }
    } catch (error) {
      context.logger.warn('Failed to load plugins for build hooks', { error })
    }

    const builder = new FluxStackBuilder(config, pluginRegistry)

    if (options['frontend-only']) {
      await builder.buildClient()
    } else if (options['backend-only']) {
      await builder.buildServer()
    } else {
      await builder.build()
    }
  }
}
