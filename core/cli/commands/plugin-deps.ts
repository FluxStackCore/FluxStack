/**
 * Comando CLI para gerenciar dependências de plugins
 */

import { Command } from 'commander'
import { buildLogger } from '@core/utils/build-logger'
import { PluginDependencyManager } from '@core/plugins/dependency-manager'
import { PluginRegistry } from '@core/plugins/registry'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export function createPluginDepsCommand(): Command {
  const command = new Command('plugin:deps')
    .description('Gerenciar dependências de plugins')
    .addCommand(createInstallCommand())
    .addCommand(createListCommand())
    .addCommand(createCheckCommand())
    .addCommand(createCleanCommand())

  return command
}

function createInstallCommand(): Command {
  return new Command('install')
    .description('Instalar dependências de todos os plugins')
    .option('--dry-run', 'Mostrar o que seria instalado sem executar')
    .option('--package-manager <pm>', 'Package manager a usar (npm, yarn, pnpm, bun)', 'bun')
    .action(async (options) => {
      buildLogger.info('🔧 Instalando dependências de plugins...')
      buildLogger.info('')

      try {
        const dependencyManager = new PluginDependencyManager({
          autoInstall: !options.dryRun,
          packageManager: options.packageManager,
          logger: createConsoleLogger()
        })

        const registry = new PluginRegistry({
          logger: createConsoleLogger()
        })

        // Descobrir plugins
        const results = await registry.discoverPlugins({
          directories: ['plugins', 'core/plugins/built-in']
        })

        const successfulPlugins = results.filter(r => r.success)
        buildLogger.success(`✅ Encontrados ${successfulPlugins.length} plugins`)
        buildLogger.info('')

        // Resolver dependências
        const resolutions = []
        for (const result of successfulPlugins) {
          if (result.plugin) {
            const pluginDir = findPluginDirectory(result.plugin.name)
            if (pluginDir) {
              const resolution = await dependencyManager.resolvePluginDependencies(pluginDir)
              resolutions.push(resolution)
            }
          }
        }

        // Mostrar resumo
        let totalDeps = 0
        let totalConflicts = 0

        for (const resolution of resolutions) {
          totalDeps += resolution.dependencies.length
          totalConflicts += resolution.conflicts.length

          if (resolution.dependencies.length > 0) {
            buildLogger.info(`📦 ${resolution.plugin}:`)
            for (const dep of resolution.dependencies) {
              buildLogger.info(`  ${dep.name}@${dep.version} (${dep.type})`)
            }
            buildLogger.info('')
          }
        }

        if (totalConflicts > 0) {
          buildLogger.warn(`⚠️  ${totalConflicts} conflitos de dependências detectados`)
          buildLogger.info('')
        }

        if (options.dryRun) {
          buildLogger.info(`📋 Dry run: ${totalDeps} dependências seriam instaladas`)
        } else {
          await dependencyManager.installPluginDependencies(resolutions)
          buildLogger.success(`✅ ${totalDeps} dependências instaladas com sucesso!`)
        }

      } catch (error) {
        buildLogger.error('❌ Erro ao instalar dependências:', error)
        process.exit(1)
      }
    })
}

function createListCommand(): Command {
  return new Command('list')
    .description('Listar dependências de plugins')
    .option('--plugin <name>', 'Mostrar apenas dependências de um plugin específico')
    .action(async (options) => {
      buildLogger.info('📋 Dependências de plugins:')
      buildLogger.info('')

      try {
        const registry = new PluginRegistry({
          logger: createConsoleLogger()
        })

        const results = await registry.discoverPlugins({
          directories: ['plugins', 'core/plugins/built-in']
        })

        const dependencyManager = new PluginDependencyManager({
          autoInstall: false,
          logger: createConsoleLogger()
        })

        for (const result of results) {
          if (result.success && result.plugin) {
            if (options.plugin && result.plugin.name !== options.plugin) {
              continue
            }

            const pluginDir = findPluginDirectory(result.plugin.name)
            if (pluginDir) {
              const resolution = await dependencyManager.resolvePluginDependencies(pluginDir)

              buildLogger.info(`📦 ${resolution.plugin}`)

              if (resolution.dependencies.length === 0) {
                buildLogger.info('  Nenhuma dependência')
              } else {
                for (const dep of resolution.dependencies) {
                  const optional = dep.optional ? ' (opcional)' : ''
                  buildLogger.info(`  ${dep.name}@${dep.version} (${dep.type})${optional}`)
                }
              }

              if (resolution.conflicts.length > 0) {
                buildLogger.error(`  ⚠️  ${resolution.conflicts.length} conflitos`)
              }

              buildLogger.info('')
            }
          }
        }

      } catch (error) {
        buildLogger.error('❌ Erro ao listar dependências:', error)
        process.exit(1)
      }
    })
}

function createCheckCommand(): Command {
  return new Command('check')
    .description('Verificar conflitos de dependências')
    .action(async () => {
      buildLogger.info('🔍 Verificando conflitos de dependências...')
      buildLogger.info('')

      try {
        const registry = new PluginRegistry({
          logger: createConsoleLogger()
        })

        const results = await registry.discoverPlugins({
          directories: ['plugins', 'core/plugins/built-in']
        })

        const dependencyManager = new PluginDependencyManager({
          autoInstall: false,
          logger: createConsoleLogger()
        })

        const resolutions = []
        for (const result of results) {
          if (result.success && result.plugin) {
            const pluginDir = findPluginDirectory(result.plugin.name)
            if (pluginDir) {
              const resolution = await dependencyManager.resolvePluginDependencies(pluginDir)
              resolutions.push(resolution)
            }
          }
        }

        const allConflicts = resolutions.flatMap(r => r.conflicts)

        if (allConflicts.length === 0) {
          buildLogger.success('✅ Nenhum conflito de dependências encontrado!')
        } else {
          buildLogger.error(`❌ ${allConflicts.length} conflitos encontrados:`)
          buildLogger.info('')

          for (const conflict of allConflicts) {
            buildLogger.warn(`⚠️  ${conflict.package}:`)
            for (const version of conflict.versions) {
              buildLogger.info(`  ${version.plugin}: ${version.version}`)
            }
            if (conflict.resolution) {
              buildLogger.success(`  Resolução: ${conflict.resolution}`)
            }
            buildLogger.info('')
          }
        }

      } catch (error) {
        buildLogger.error('❌ Erro ao verificar conflitos:', error)
        process.exit(1)
      }
    })
}

function createCleanCommand(): Command {
  return new Command('clean')
    .description('Limpar dependências não utilizadas')
    .option('--dry-run', 'Mostrar o que seria removido sem executar')
    .action(async (options) => {
      buildLogger.info('🧹 Limpando dependências não utilizadas...')
      buildLogger.info('')

      if (options.dryRun) {
        buildLogger.info('📋 Dry run: mostrando dependências que seriam removidas')
      }

      // TODO: Implementar lógica de limpeza
      buildLogger.warn('⚠️  Funcionalidade ainda não implementada')
    })
}

function findPluginDirectory(pluginName: string): string | null {
  const possiblePaths = [
    `plugins/${pluginName}`,
    `core/plugins/built-in/${pluginName}`
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  return null
}

interface ConsoleLogger {
  debug: (message: unknown, ...args: unknown[]) => void
  info: (message: unknown, ...args: unknown[]) => void
  warn: (message: unknown, ...args: unknown[]) => void
  error: (message: unknown, ...args: unknown[]) => void
  child: () => ConsoleLogger
  request: (method: string, path: string, status?: number, duration?: number, ip?: string) => void
  plugin: (pluginName: string, message: string, meta?: unknown) => void
  framework: (message: string, meta?: unknown) => void
  time: (label: string) => void
  timeEnd: (label: string) => void
}

function createConsoleLogger(): ConsoleLogger {
  const logger: ConsoleLogger = {
    debug: (message: unknown, ...args: unknown[]) => {
      if (process.env.DEBUG) {
        buildLogger.info(`[DEBUG] ${message}`, ...args)
      }
    },
    info: (message: unknown, ...args: unknown[]) => {
      buildLogger.info(`[INFO] ${message}`, ...args)
    },
    warn: (message: unknown, ...args: unknown[]) => {
      buildLogger.warn(`[WARN] ${message}`, ...args)
    },
    error: (message: unknown, ...args: unknown[]) => {
      buildLogger.error(`[ERROR] ${message}`, ...args)
    },
    child: () => createConsoleLogger(),
    request: () => {},
    plugin: () => {},
    framework: () => {},
    time: () => {},
    timeEnd: () => {}
  }
  return logger
}