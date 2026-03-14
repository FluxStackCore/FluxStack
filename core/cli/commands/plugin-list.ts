/**
 * FluxStack CLI - Plugin List Command
 * List all plugins (installed, whitelisted, discovered)
 */

import { Command } from 'commander'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { buildLogger } from '@core/utils/build-logger'

export function createPluginListCommand(): Command {
  const command = new Command('plugin:list')
    .description('List all plugins (installed, whitelisted, and discovered)')
    .option('--installed', 'Show only installed NPM plugins')
    .option('--whitelisted', 'Show only whitelisted plugins')
    .option('--json', 'Output as JSON')
    .action(async (options: { installed?: boolean; whitelisted?: boolean; json?: boolean }) => {
      try {
        const info = getPluginInfo()

        if (options.json) {
          buildLogger.info(JSON.stringify(info, null, 2))
          return
        }

        buildLogger.info('')
        buildLogger.info('🔌 FluxStack Plugin Status')
        buildLogger.info('')

        // Configuration
        buildLogger.info('⚙️  Configuration:')
        buildLogger.info(`   NPM Plugin Discovery: ${info.config.npmDiscoveryEnabled ? 'enabled' : 'disabled'}`)
        buildLogger.info(`   Project Plugin Discovery: ${info.config.projectDiscoveryEnabled ? 'enabled' : 'disabled'}`)
        buildLogger.info('')

        // Whitelisted plugins
        if (!options.installed) {
          buildLogger.info('🛡️  Whitelisted NPM Plugins:')
          if (info.whitelisted.length === 0) {
            buildLogger.info('   (none)')
          } else {
            info.whitelisted.forEach(plugin => {
              const isInstalled = info.installed.includes(plugin)
              const status = isInstalled ? '✓ installed' : '⚠ not installed'
              buildLogger.info(`   • ${plugin} ${status}`)
            })
          }
          buildLogger.info('')
        }

        // Installed NPM plugins
        if (!options.whitelisted) {
          buildLogger.info('📦 Installed NPM Plugins:')
          if (info.installed.length === 0) {
            buildLogger.info('   (none)')
          } else {
            info.installed.forEach(plugin => {
              const isWhitelisted = info.whitelisted.includes(plugin)
              let status = ''
              if (!info.config.npmDiscoveryEnabled) {
                status = '✗ discovery disabled'
              } else if (!isWhitelisted) {
                status = '✗ not whitelisted (blocked)'
              } else {
                status = '✓ whitelisted (loaded)'
              }
              buildLogger.info(`   • ${plugin} ${status}`)
            })
          }
          buildLogger.info('')
        }

        // Project plugins (from plugins/ directory)
        buildLogger.info('📁 Project Plugins (plugins/):')
        if (info.projectPlugins.length === 0) {
          buildLogger.info('   (none found)')
        } else {
          info.projectPlugins.forEach(plugin => {
            const status = info.config.projectDiscoveryEnabled
              ? '✓ auto-discovered'
              : '✗ discovery disabled'
            buildLogger.info(`   • ${plugin} ${status}`)
          })
        }
        buildLogger.info('')

        // Summary
        buildLogger.info('📊 Summary:')
        buildLogger.info(`   Total NPM plugins installed: ${info.installed.length}`)
        buildLogger.info(`   Total NPM plugins whitelisted: ${info.whitelisted.length}`)
        buildLogger.info(`   Total project plugins: ${info.projectPlugins.length}`)

        const blockedCount = info.installed.filter(p => !info.whitelisted.includes(p)).length
        if (blockedCount > 0) {
          buildLogger.warn(`   ⚠️  ${blockedCount} installed plugin(s) blocked (not whitelisted)`)
        }
        buildLogger.info('')

        // Help
        if (info.installed.length > 0 && !info.config.npmDiscoveryEnabled) {
          buildLogger.warn('💡 Tip: Enable NPM plugin discovery with:')
          buildLogger.info('   echo "PLUGINS_DISCOVER_NPM=true" >> .env')
          buildLogger.info('')
        }

        if (blockedCount > 0 && info.config.npmDiscoveryEnabled) {
          buildLogger.warn('💡 Tip: Add blocked plugins to whitelist with:')
          buildLogger.info('   bun run fluxstack plugin:add <plugin-name>')
          buildLogger.info('')
        }

      } catch (error) {
        buildLogger.error('')
        buildLogger.error('❌ Failed to list plugins:')
        buildLogger.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  return command
}

interface PluginInfo {
  config: {
    npmDiscoveryEnabled: boolean
    projectDiscoveryEnabled: boolean
  }
  whitelisted: string[]
  installed: string[]
  projectPlugins: string[]
}

/**
 * Get plugin information from package.json and .env
 */
function getPluginInfo(): PluginInfo {
  const info: PluginInfo = {
    config: {
      npmDiscoveryEnabled: false,
      projectDiscoveryEnabled: true,
    },
    whitelisted: [],
    installed: [],
    projectPlugins: [],
  }

  // Read .env for configuration
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')

    // Check NPM discovery enabled
    const npmDiscoveryMatch = envContent.match(/^PLUGINS_DISCOVER_NPM=(.*)$/m)
    if (npmDiscoveryMatch) {
      info.config.npmDiscoveryEnabled = npmDiscoveryMatch[1].toLowerCase() === 'true'
    }

    // Check project discovery enabled
    const projectDiscoveryMatch = envContent.match(/^PLUGINS_DISCOVER_PROJECT=(.*)$/m)
    if (projectDiscoveryMatch) {
      info.config.projectDiscoveryEnabled = projectDiscoveryMatch[1].toLowerCase() === 'true'
    }

    // Get whitelisted plugins
    const whitelistMatch = envContent.match(/^PLUGINS_ALLOWED=(.*)$/m)
    if (whitelistMatch) {
      info.whitelisted = whitelistMatch[1]
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
    }
  }

  // Read package.json for installed plugins
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    // Find FluxStack plugins
    const pluginPatterns = [
      /^fluxstack-plugin-/,
      /^fplugin-/,
      /^@fluxstack\/plugin-/,
      /^@fplugin\//,
    ]

    info.installed = Object.keys(allDeps).filter(name =>
      pluginPatterns.some(pattern => pattern.test(name))
    )
  }

  // Scan plugins/ directory for project plugins
  const pluginsDir = join(process.cwd(), 'plugins')
  if (existsSync(pluginsDir)) {
    const fs = require('fs')
    try {
      const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })
      info.projectPlugins = entries
        .filter((entry: { isDirectory(): boolean; name: string }) => entry.isDirectory())
        .map((entry: { isDirectory(): boolean; name: string }) => entry.name)
    } catch (error) {
      // Ignore errors reading directory
    }
  }

  return info
}
