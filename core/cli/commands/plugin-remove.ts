/**
 * FluxStack CLI - Plugin Remove Command
 * Safely remove and un-whitelist NPM plugins
 */

import { Command } from 'commander'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { $ } from 'bun'
import { buildLogger } from '@core/utils/build-logger'

interface PluginRemoveOptions {
  skipConfirmation?: boolean
  keepInstalled?: boolean
}

export function createPluginRemoveCommand(): Command {
  const command = new Command('plugin:remove')
    .description('Remove plugin from whitelist and optionally uninstall')
    .argument('<plugin-name>', 'Name of the plugin to remove (e.g., fluxstack-plugin-auth)')
    .option('--skip-confirmation', 'Skip confirmation prompt')
    .option('--keep-installed', 'Keep plugin installed, only remove from whitelist')
    .action(async (pluginName: string, options: PluginRemoveOptions) => {
      buildLogger.info('')
      buildLogger.info('🔌 FluxStack Plugin Remover')
      buildLogger.info('')

      try {
        // 1. Check if plugin is installed
        const packageJsonPath = join(process.cwd(), 'package.json')
        if (!existsSync(packageJsonPath)) {
          buildLogger.error('❌ package.json not found')
          process.exit(1)
        }

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        const isInstalled =
          packageJson.dependencies?.[pluginName] ||
          packageJson.devDependencies?.[pluginName]

        if (!isInstalled && !options.keepInstalled) {
          buildLogger.warn(`⚠️  Plugin ${pluginName} is not installed`)
          buildLogger.warn('   Will only remove from whitelist')
          buildLogger.info('')
        }

        // 2. Confirmation prompt (unless skipped)
        if (!options.skipConfirmation) {
          const action = options.keepInstalled
            ? 'remove from whitelist'
            : 'uninstall and remove from whitelist'

          const answer = prompt(`Remove ${pluginName}? This will ${action}. (yes/no): `)
          if (answer?.toLowerCase() !== 'yes' && answer?.toLowerCase() !== 'y') {
            buildLogger.error('❌ Removal cancelled')
            process.exit(0)
          }
        }

        // 3. Remove from whitelist
        buildLogger.info('')
        buildLogger.info('🔧 Updating configuration...')
        buildLogger.info('')
        const removed = removeFromWhitelist(pluginName)

        if (!removed) {
          buildLogger.warn(`⚠️  Plugin ${pluginName} was not in whitelist`)
        } else {
          buildLogger.info(`   • Removed ${pluginName} from PLUGINS_ALLOWED`)
        }

        // 4. Uninstall plugin (unless --keep-installed)
        if (!options.keepInstalled && isInstalled) {
          buildLogger.info('')
          buildLogger.info(`📦 Uninstalling ${pluginName}...`)
          buildLogger.info('')
          await $`bun remove ${pluginName}`.quiet()
          buildLogger.success('✅ Plugin uninstalled successfully')
        }

        // 5. Check if should disable NPM discovery
        checkAndDisableNpmDiscovery()

        // 6. Success message
        buildLogger.success('')
        buildLogger.success('✅ Plugin removal complete!')
        buildLogger.info('')
        buildLogger.info('📋 What was done:')
        buildLogger.info(`   • Removed ${pluginName} from whitelist (PLUGINS_ALLOWED)`)
        if (!options.keepInstalled && isInstalled) {
          buildLogger.info(`   • Uninstalled ${pluginName}`)
        }

        buildLogger.info('')
        buildLogger.info('🚀 Next steps:')
        buildLogger.info('   1. Restart your dev server: bun run dev')
        buildLogger.info('   2. Plugin will no longer be loaded')

      } catch (error) {
        buildLogger.error('')
        buildLogger.error('❌ Failed to remove plugin:')
        buildLogger.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  return command
}

/**
 * Remove plugin from whitelist in .env file
 */
function removeFromWhitelist(pluginName: string): boolean {
  const envPath = join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    return false
  }

  let envContent = readFileSync(envPath, 'utf-8')
  const allowedPluginsRegex = /^PLUGINS_ALLOWED=(.*)$/m
  const match = envContent.match(allowedPluginsRegex)

  if (!match) {
    return false
  }

  const currentPlugins = match[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  if (!currentPlugins.includes(pluginName)) {
    return false
  }

  const newPlugins = currentPlugins.filter(p => p !== pluginName)
  envContent = envContent.replace(
    allowedPluginsRegex,
    `PLUGINS_ALLOWED=${newPlugins.join(',')}`
  )

  writeFileSync(envPath, envContent, 'utf-8')
  return true
}

/**
 * Check if whitelist is empty and disable NPM discovery if so
 */
function checkAndDisableNpmDiscovery(): void {
  const envPath = join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    return
  }

  let envContent = readFileSync(envPath, 'utf-8')
  const allowedPluginsRegex = /^PLUGINS_ALLOWED=(.*)$/m
  const match = envContent.match(allowedPluginsRegex)

  if (!match) {
    return
  }

  const currentPlugins = match[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  // If whitelist is empty, disable NPM discovery
  if (currentPlugins.length === 0) {
    if (/^PLUGINS_DISCOVER_NPM=true/m.test(envContent)) {
      envContent = envContent.replace(
        /^PLUGINS_DISCOVER_NPM=true/m,
        'PLUGINS_DISCOVER_NPM=false'
      )
      writeFileSync(envPath, envContent, 'utf-8')
      buildLogger.info('   • Disabled NPM plugin discovery (whitelist empty)')
    }
  }
}
