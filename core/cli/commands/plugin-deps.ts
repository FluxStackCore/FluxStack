/**
 * Comando CLI para gerenciar dependências de plugins
 */

import { Command } from 'commander'
import chalk from 'chalk'
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
      console.log(chalk.blue('🔧 Instalando dependências de plugins...\n'))

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
        console.log(chalk.green(`✅ Encontrados ${successfulPlugins.length} plugins\n`))

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
            console.log(chalk.cyan(`📦 ${resolution.plugin}:`))
            for (const dep of resolution.dependencies) {
              const typeColor = dep.type === 'peerDependency' ? chalk.yellow : chalk.white
              console.log(`  ${typeColor(dep.name)}@${dep.version} (${dep.type})`)
            }
            console.log()
          }
        }

        if (totalConflicts > 0) {
          console.log(chalk.yellow(`⚠️  ${totalConflicts} conflitos de dependências detectados\n`))
        }

        if (options.dryRun) {
          console.log(chalk.blue(`📋 Dry run: ${totalDeps} dependências seriam instaladas`))
        } else {
          await dependencyManager.installPluginDependencies(resolutions)
          console.log(chalk.green(`✅ ${totalDeps} dependências instaladas com sucesso!`))
        }

      } catch (error) {
        console.error(chalk.red('❌ Erro ao instalar dependências:'), error)
        process.exit(1)
      }
    })
}

function createListCommand(): Command {
  return new Command('list')
    .description('Listar dependências de plugins')
    .option('--plugin <name>', 'Mostrar apenas dependências de um plugin específico')
    .action(async (options) => {
      console.log(chalk.blue('📋 Dependências de plugins:\n'))

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
              
              console.log(chalk.cyan(`📦 ${resolution.plugin}`))
              
              if (resolution.dependencies.length === 0) {
                console.log(chalk.gray('  Nenhuma dependência'))
              } else {
                for (const dep of resolution.dependencies) {
                  const typeColor = dep.type === 'peerDependency' ? chalk.yellow : chalk.white
                  const optional = dep.optional ? chalk.gray(' (opcional)') : ''
                  console.log(`  ${typeColor(dep.name)}@${dep.version} (${dep.type})${optional}`)
                }
              }

              if (resolution.conflicts.length > 0) {
                console.log(chalk.red(`  ⚠️  ${resolution.conflicts.length} conflitos`))
              }

              console.log()
            }
          }
        }

      } catch (error) {
        console.error(chalk.red('❌ Erro ao listar dependências:'), error)
        process.exit(1)
      }
    })
}

function createCheckCommand(): Command {
  return new Command('check')
    .description('Verificar conflitos de dependências')
    .action(async () => {
      console.log(chalk.blue('🔍 Verificando conflitos de dependências...\n'))

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
          console.log(chalk.green('✅ Nenhum conflito de dependências encontrado!'))
        } else {
          console.log(chalk.red(`❌ ${allConflicts.length} conflitos encontrados:\n`))
          
          for (const conflict of allConflicts) {
            console.log(chalk.yellow(`⚠️  ${conflict.package}:`))
            for (const version of conflict.versions) {
              console.log(`  ${version.plugin}: ${version.version}`)
            }
            if (conflict.resolution) {
              console.log(chalk.green(`  Resolução: ${conflict.resolution}`))
            }
            console.log()
          }
        }

      } catch (error) {
        console.error(chalk.red('❌ Erro ao verificar conflitos:'), error)
        process.exit(1)
      }
    })
}

function createCleanCommand(): Command {
  return new Command('clean')
    .description('Limpar dependências não utilizadas')
    .option('--dry-run', 'Mostrar o que seria removido sem executar')
    .action(async (options) => {
      console.log(chalk.blue('🧹 Limpando dependências não utilizadas...\n'))

      if (options.dryRun) {
        console.log(chalk.blue('📋 Dry run: mostrando dependências que seriam removidas'))
      }

      // TODO: Implementar lógica de limpeza
      console.log(chalk.yellow('⚠️  Funcionalidade ainda não implementada'))
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
        console.log(chalk.gray(`[DEBUG] ${message}`), ...args)
      }
    },
    info: (message: unknown, ...args: unknown[]) => {
      console.log(chalk.blue(`[INFO] ${message}`), ...args)
    },
    warn: (message: unknown, ...args: unknown[]) => {
      console.log(chalk.yellow(`[WARN] ${message}`), ...args)
    },
    error: (message: unknown, ...args: unknown[]) => {
      console.log(chalk.red(`[ERROR] ${message}`), ...args)
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