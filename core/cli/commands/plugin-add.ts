/**
 * FluxStack CLI - Plugin Add Command
 * Safely install and whitelist NPM plugins
 */

import { Command } from 'commander'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { $ } from 'bun'
import { buildLogger } from '@core/utils/build-logger'

interface PluginAddOptions {
  skipAudit?: boolean
  skipConfirmation?: boolean
}

export function createPluginAddCommand(): Command {
  const command = new Command('plugin:add')
    .description('Install and whitelist an NPM plugin securely')
    .argument('<plugin-name>', 'Name of the plugin to install (e.g., fluxstack-plugin-auth)')
    .option('--skip-audit', 'Skip npm audit check')
    .option('--skip-confirmation', 'Skip confirmation prompt')
    .action(async (pluginName: string, options: PluginAddOptions) => {
      buildLogger.info('')
      buildLogger.info('🔌 FluxStack Plugin Installer')
      buildLogger.info('')

      try {
        // 1. Validate plugin name
        if (!isValidPluginName(pluginName)) {
          buildLogger.error(`❌ Invalid plugin name: ${pluginName}`)
          buildLogger.info('')
          buildLogger.info('📝 Valid plugin names:')
          buildLogger.info('  - fluxstack-plugin-*')
          buildLogger.info('  - fplugin-*')
          buildLogger.info('  - @fluxstack/plugin-*')
          buildLogger.info('  - @fplugin/*')
          buildLogger.info('  - @org/fluxstack-plugin-*')
          buildLogger.info('  - @org/fplugin-*')
          process.exit(1)
        }

        // 2. Check if plugin already installed
        const packageJsonPath = join(process.cwd(), 'package.json')
        if (!existsSync(packageJsonPath)) {
          buildLogger.error('❌ package.json not found')
          process.exit(1)
        }

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        const isAlreadyInstalled =
          packageJson.dependencies?.[pluginName] ||
          packageJson.devDependencies?.[pluginName]

        if (isAlreadyInstalled && !options.skipConfirmation) {
          buildLogger.warn(`⚠️  Plugin ${pluginName} is already installed`)
          buildLogger.warn('   Will only update whitelist')
          buildLogger.info('')
        }

        // 3. Audit plugin (unless skipped)
        if (!options.skipAudit && !isAlreadyInstalled) {
          buildLogger.info('🔍 Auditing plugin security...')
          buildLogger.info('')

          try {
            // Get plugin info
            const info = await $`npm view ${pluginName} repository homepage version description`.text()
            buildLogger.info(info)

            // Run audit
            buildLogger.info('')
            buildLogger.info('🛡️  Running npm audit...')
            buildLogger.info('')
            const auditResult = await $`npm audit ${pluginName}`.text()
            buildLogger.info(auditResult)
          } catch (error) {
            buildLogger.warn(`⚠️  Could not audit plugin: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        // 4. Confirmation prompt (unless skipped)
        if (!options.skipConfirmation) {
          buildLogger.warn('')
          buildLogger.warn('⚠️  Security Warning:')
          buildLogger.warn('   NPM plugins can execute arbitrary code')
          buildLogger.warn('   Only install plugins from trusted sources')
          buildLogger.info('')

          const answer = prompt('Continue with installation? (yes/no): ')
          if (answer?.toLowerCase() !== 'yes' && answer?.toLowerCase() !== 'y') {
            buildLogger.error('❌ Installation cancelled')
            process.exit(0)
          }
        }

        // 5. Install plugin
        if (!isAlreadyInstalled) {
          buildLogger.info('')
          buildLogger.info(`📦 Installing ${pluginName}...`)
          buildLogger.info('')
          await $`bun add ${pluginName}`.quiet()
          buildLogger.success('✅ Plugin installed successfully')
        }

        // 6. Update .env file
        buildLogger.info('')
        buildLogger.info('🔧 Updating configuration...')
        buildLogger.info('')
        updateEnvFile(pluginName)

        // 7. Success message
        buildLogger.success('')
        buildLogger.success('✅ Plugin setup complete!')
        buildLogger.info('')
        buildLogger.info('📋 What was done:')
        if (!isAlreadyInstalled) {
          buildLogger.info(`   • Installed ${pluginName}`)
        }
        buildLogger.info('   • Enabled NPM plugin discovery (PLUGINS_DISCOVER_NPM=true)')
        buildLogger.info(`   • Added ${pluginName} to whitelist (PLUGINS_ALLOWED)`)

        buildLogger.info('')
        buildLogger.info('🚀 Next steps:')
        buildLogger.info('   1. Restart your dev server: bun run dev')
        buildLogger.info('   2. Plugin will be auto-discovered and loaded')
        buildLogger.info('   3. Check logs for plugin initialization')

      } catch (error) {
        buildLogger.error('')
        buildLogger.error('❌ Failed to install plugin:')
        buildLogger.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  return command
}

/**
 * Validate plugin name against FluxStack naming conventions
 */
function isValidPluginName(name: string): boolean {
  const patterns = [
    /^fluxstack-plugin-/,
    /^fplugin-/,
    /^@fluxstack\/plugin-/,
    /^@fplugin\//,
    /^@[\w-]+\/fluxstack-plugin-/,
    /^@[\w-]+\/fplugin-/,
  ]

  return patterns.some(pattern => pattern.test(name))
}

/**
 * Update .env file with plugin configuration
 */
function updateEnvFile(pluginName: string): void {
  const envPath = join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    buildLogger.warn('⚠️  .env file not found, creating...')
    writeFileSync(envPath, '', 'utf-8')
  }

  let envContent = readFileSync(envPath, 'utf-8')
  let updated = false

  // 1. Enable NPM plugin discovery
  if (/^PLUGINS_DISCOVER_NPM=false/m.test(envContent)) {
    envContent = envContent.replace(
      /^PLUGINS_DISCOVER_NPM=false/m,
      'PLUGINS_DISCOVER_NPM=true'
    )
    updated = true
    buildLogger.info('   • Set PLUGINS_DISCOVER_NPM=true')
  } else if (!/^PLUGINS_DISCOVER_NPM=/m.test(envContent)) {
    envContent += '\n# Plugin Discovery\nPLUGINS_DISCOVER_NPM=true\n'
    updated = true
    buildLogger.info('   • Added PLUGINS_DISCOVER_NPM=true')
  }

  // 2. Add plugin to whitelist
  const allowedPluginsRegex = /^PLUGINS_ALLOWED=(.*)$/m
  const match = envContent.match(allowedPluginsRegex)

  if (match) {
    const currentPlugins = match[1]
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)

    if (!currentPlugins.includes(pluginName)) {
      const newPlugins = [...currentPlugins, pluginName].join(',')
      envContent = envContent.replace(
        allowedPluginsRegex,
        `PLUGINS_ALLOWED=${newPlugins}`
      )
      updated = true
      buildLogger.info(`   • Added ${pluginName} to PLUGINS_ALLOWED`)
    } else {
      buildLogger.info(`   • ${pluginName} already in PLUGINS_ALLOWED`)
    }
  } else {
    envContent += `PLUGINS_ALLOWED=${pluginName}\n`
    updated = true
    buildLogger.info(`   • Created PLUGINS_ALLOWED with ${pluginName}`)
  }

  if (updated) {
    writeFileSync(envPath, envContent, 'utf-8')
  }
}
