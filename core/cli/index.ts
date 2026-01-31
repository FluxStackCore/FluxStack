#!/usr/bin/env bun

import { FluxStackBuilder } from "@/core/build"
import { ProjectCreator } from "@/core/templates/create-project"
import { fluxStackConfig, serverConfig, clientConfig } from "@/config"
import { cliRegistry } from "./command-registry"
import { pluginDiscovery } from "./plugin-discovery"
import { generateCommand, interactiveGenerateCommand } from "./generators/index"
import { startGroup, endGroup, logBox, logInGroup } from "@/core/utils/logger/group-logger"

const command = process.argv[2]
const args = process.argv.slice(3)

// Register built-in commands
async function registerBuiltInCommands() {
  // Register generate commands
  cliRegistry.register(generateCommand)
  cliRegistry.register(interactiveGenerateCommand)
  
  // Register plugin dependency commands
  cliRegistry.register({
    name: 'plugin:deps',
    description: 'Gerenciar dependências de plugins',
    category: 'Plugins',
    handler: async (args, options, context) => {
      if (args.length === 0) {
        console.log(`
⚡ FluxStack Plugin Dependencies Manager

Usage:
  flux plugin:deps install     Install plugin dependencies
  flux plugin:deps list        List plugin dependencies  
  flux plugin:deps check       Check for dependency conflicts
  flux plugin:deps clean       Clean unused dependencies

Examples:
  flux plugin:deps install --dry-run    # Show what would be installed
  flux plugin:deps list --plugin crypto-auth  # Show specific plugin deps
  flux plugin:deps check                # Check for conflicts
        `)
        return
      }
      
      // Handle subcommands
      const subcommand = args[0]
      const subArgs = args.slice(1)
      
      // Import dinamicamente para evitar problemas de inicialização
      const { createPluginDepsCommand } = await import('./commands/plugin-deps')
      const cmd = createPluginDepsCommand()
      
      switch (subcommand) {
        case 'install':
          const installCmd = cmd.commands.find(c => c.name() === 'install')
          if (installCmd) {
            await installCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        case 'list':
          const listCmd = cmd.commands.find(c => c.name() === 'list')
          if (listCmd) {
            await listCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        case 'check':
          const checkCmd = cmd.commands.find(c => c.name() === 'check')
          if (checkCmd) {
            await checkCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        case 'clean':
          const cleanCmd = cmd.commands.find(c => c.name() === 'clean')
          if (cleanCmd) {
            await cleanCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        default:
          console.error(`❌ Unknown subcommand: ${subcommand}`)
          console.error('Available subcommands: install, list, check, clean')
      }
    }
  })
  
  // Help command
  cliRegistry.register({
    name: 'help',
    description: 'Show help information',
    category: 'General',
    aliases: ['h', '--help', '-h'],
    arguments: [
      {
        name: 'command',
        description: 'Command to show help for',
        required: false
      }
    ],
    handler: async (args, options, context) => {
      if (args[0]) {
        const targetCommand = cliRegistry.get(args[0])
        if (targetCommand) {
          cliRegistry.showCommandHelp(targetCommand)
        } else {
          console.error(`❌ Unknown command: ${args[0]}`)
          cliRegistry.showHelp()
        }
      } else {
        cliRegistry.showHelp()
      }
    }
  })

  // Dev command
  cliRegistry.register({
    name: 'dev',
    description: 'Start full-stack development server',
    category: 'Development',
    usage: 'flux dev [options]',
    examples: [
      'flux dev                    # Start development server',
      'flux dev --port 4000        # Start on custom port'
    ],
    options: [
      {
        name: 'port',
        short: 'p',
        description: 'Port for backend server',
        type: 'number',
        default: serverConfig.server.port
      },
      {
        name: 'frontend-port',
        description: 'Port for frontend server',
        type: 'number',
        default: clientConfig.vite.port
      }
    ],
    handler: async (args, options, context) => {
      // Grouped startup messages
      startGroup({
        title: 'FluxStack Development Server',
        icon: '',
        color: 'cyan'
      })

      logInGroup(`Server: http://localhost:${options.port}`, '')
      logInGroup(`API: http://localhost:${options.port}/api`, '')
      logInGroup(`Swagger: http://localhost:${options.port}/swagger`, '')
      logInGroup('Starting with hot reload...', '')

      endGroup()
      console.log('') // Separator line
      
      const { spawn } = await import("child_process")
      const devProcess = spawn("bun", ["--watch", "app/server/index.ts"], {
        stdio: "inherit",
        cwd: process.cwd(),
        env: {
          ...process.env,
          FRONTEND_PORT: options['frontend-port'].toString(),
          BACKEND_PORT: options.port.toString()
        }
      })
      
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down gracefully...')
        devProcess.kill('SIGTERM')
        setTimeout(() => {
          devProcess.kill('SIGKILL')
          process.exit(0)
        }, 5000)
      })
      
      devProcess.on('close', (code) => {
        process.exit(code || 0)
      })
      
      // Keep the CLI running until the child process exits
      return new Promise((resolve) => {
        devProcess.on('exit', resolve)
      })
    }
  })

  // Build command
  cliRegistry.register({
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

      // Load plugins for build hooks
      const { PluginRegistry } = await import('../plugins/registry')
      const { PluginManager } = await import('../plugins/manager')
      const pluginRegistry = new PluginRegistry({ config, logger: context.logger })
      const pluginManager = new PluginManager({ config, logger: context.logger })

      try {
        await pluginManager.initialize()
        // Sync plugins to registry (same as framework does)
        const discoveredPlugins = pluginManager.getRegistry().getAll()
        for (const plugin of discoveredPlugins) {
          if (!pluginRegistry.has(plugin.name)) {
            (pluginRegistry as any).plugins.set(plugin.name, plugin)
            if (plugin.dependencies) {
              (pluginRegistry as any).dependencies.set(plugin.name, plugin.dependencies)
            }
          }
        }
        try {
          (pluginRegistry as any).updateLoadOrder()
        } catch (error) {
          const plugins = (pluginRegistry as any).plugins as Map<string, any>
          ;(pluginRegistry as any).loadOrder = Array.from(plugins.keys())
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
  })

  // Create command
  cliRegistry.register({
    name: 'create',
    description: 'Create a new FluxStack project',
    category: 'Project',
    usage: 'flux create <project-name> [template]',
    examples: [
      'flux create my-app          # Create basic project',
      'flux create my-app full     # Create full-featured project'
    ],
    arguments: [
      {
        name: 'project-name',
        description: 'Name of the project to create',
        required: true,
        type: 'string'
      },
      {
        name: 'template',
        description: 'Project template to use',
        required: false,
        type: 'string',
        default: 'basic',
        choices: ['basic', 'full']
      }
    ],
    handler: async (args, options, context) => {
      const [projectName, template] = args

      if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
        console.error("❌ Project name can only contain letters, numbers, hyphens, and underscores")
        return
      }

      try {
        const creator = new ProjectCreator({
          name: projectName,
          template: template as 'basic' | 'full' || 'basic'
        })

        await creator.create()
      } catch (error) {
        console.error("❌ Failed to create project:", error instanceof Error ? error.message : String(error))
        throw error
      }
    }
  })

  // Make:plugin command (shortcut for generate plugin)
  cliRegistry.register({
    name: 'make:plugin',
    description: 'Create a new FluxStack plugin',
    category: 'Plugins',
    usage: 'flux make:plugin <name> [options]',
    aliases: ['create:plugin'],
    examples: [
      'flux make:plugin my-plugin              # Create basic plugin',
      'flux make:plugin my-plugin --template full    # Create full plugin with server/client',
      'flux make:plugin auth --template server       # Create server-only plugin'
    ],
    arguments: [
      {
        name: 'name',
        description: 'Name of the plugin to create',
        required: true,
        type: 'string'
      }
    ],
    options: [
      {
        name: 'template',
        short: 't',
        description: 'Plugin template to use',
        type: 'string',
        choices: ['basic', 'full', 'server', 'client'],
        default: 'basic'
      },
      {
        name: 'description',
        short: 'd',
        description: 'Plugin description',
        type: 'string',
        default: 'A FluxStack plugin'
      },
      {
        name: 'force',
        short: 'f',
        description: 'Overwrite existing plugin',
        type: 'boolean',
        default: false
      }
    ],
    handler: async (args, options, context) => {
      const [name] = args

      if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
        console.error("❌ Plugin name can only contain letters, numbers, hyphens, and underscores")
        return
      }

      // Use the plugin generator
      const { generatorRegistry } = await import('./generators/index')
      const pluginGenerator = generatorRegistry.get('plugin')

      if (!pluginGenerator) {
        console.error("❌ Plugin generator not found")
        return
      }

      const generatorContext = {
        workingDir: context.workingDir,
        config: context.config,
        logger: context.logger,
        utils: context.utils
      }

      const generatorOptions = {
        name,
        template: options.template,
        force: options.force,
        dryRun: false,
        description: options.description
      }

      try {
        await pluginGenerator.generate(generatorContext, generatorOptions)
      } catch (error) {
        console.error("❌ Failed to create plugin:", error instanceof Error ? error.message : String(error))
        throw error
      }
    }
  })

  // Frontend command (frontend-only development)
  cliRegistry.register({
    name: 'frontend',
    description: 'Start frontend development server only',
    category: 'Development',
    usage: 'flux frontend [options]',
    examples: [
      'flux frontend               # Start Vite dev server on port 5173',
      'flux frontend --port 3000   # Start on custom port'
    ],
    options: [
      {
        name: 'port',
        short: 'p',
        description: 'Port for frontend server',
        type: 'number',
        default: 5173
      }
    ],
    handler: async (args, options, context) => {
      console.log("🎨 FluxStack Frontend Development")
      console.log(`🌐 Frontend: http://localhost:${options.port}`)
      console.log("📦 Starting Vite dev server...")
      console.log()

      const { spawn } = await import("child_process")
      const frontendProcess = spawn("vite", ["--config", "vite.config.ts", "--port", options.port.toString()], {
        stdio: "inherit",
        cwd: process.cwd()
      })

      process.on('SIGINT', () => {
        frontendProcess.kill('SIGINT')
        process.exit(0)
      })

      return new Promise((resolve) => {
        frontendProcess.on('exit', resolve)
      })
    }
  })

  // Backend command (backend-only development)
  cliRegistry.register({
    name: 'backend',
    description: 'Start backend development server only',
    category: 'Development',
    usage: 'flux backend [options]',
    examples: [
      'flux backend                # Start backend on port 3001',
      'flux backend --port 4000    # Start on custom port'
    ],
    options: [
      {
        name: 'port',
        short: 'p',
        description: 'Port for backend server',
        type: 'number',
        default: 3001
      }
    ],
    handler: async (args, options, context) => {
      console.log("⚡ FluxStack Backend Development")
      console.log(`🚀 API Server: http://localhost:${options.port}`)
      console.log("📦 Starting backend with hot reload...")
      console.log()

      // Ensure backend-only.ts exists
      const { ensureBackendEntry } = await import("../utils/regenerate-files")
      await ensureBackendEntry()

      // Start backend with Bun watch for hot reload
      const { spawn } = await import("child_process")
      const backendProcess = spawn("bun", ["--watch", "app/server/backend-only.ts"], {
        stdio: "inherit",
        cwd: process.cwd(),
        env: {
          ...process.env,
          BACKEND_PORT: options.port.toString()
        }
      })

      // Handle process cleanup
      process.on('SIGINT', () => {
        backendProcess.kill('SIGINT')
        process.exit(0)
      })

      return new Promise((resolve) => {
        backendProcess.on('exit', resolve)
      })
    }
  })

  // Start command (production server)
  cliRegistry.register({
    name: 'start',
    description: 'Start production server',
    category: 'Production',
    usage: 'flux start',
    examples: [
      'flux start                  # Start production server from dist/'
    ],
    handler: async (args, options, context) => {
      console.log("🚀 Starting FluxStack production server...")
      const { join } = await import("path")
      await import(join(process.cwd(), "dist", "index.js"))
    }
  })

  // Build:frontend command (shortcut)
  cliRegistry.register({
    name: 'build:frontend',
    description: 'Build frontend only (shortcut for build --frontend-only)',
    category: 'Build',
    usage: 'flux build:frontend',
    examples: [
      'flux build:frontend         # Build only frontend'
    ],
    handler: async (args, options, context) => {
      const config = fluxStackConfig
      const builder = new FluxStackBuilder(config)
      await builder.buildClient()
    }
  })

  // Build:backend command (shortcut)
  cliRegistry.register({
    name: 'build:backend',
    description: 'Build backend only (shortcut for build --backend-only)',
    category: 'Build',
    usage: 'flux build:backend',
    examples: [
      'flux build:backend          # Build only backend'
    ],
    handler: async (args, options, context) => {
      const config = fluxStackConfig
      const builder = new FluxStackBuilder(config)
      await builder.buildServer()
    }
  })

  // Build:exe command (compile to executable)
  cliRegistry.register({
    name: 'build:exe',
    description: 'Compile application to standalone executable',
    category: 'Build',
    usage: 'flux build:exe [options]',
    examples: [
      'flux build:exe                                    # Compile for current platform (auto-detected)',
      'flux build:exe --target bun-linux-x64             # Compile for specific target',
      'flux build:exe --name MyApp                       # Compile with custom name',
      'flux build:exe --windows-hide-console             # Hide console window on Windows'
    ],
    options: [
      {
        name: 'name',
        short: 'n',
        description: 'Name for the executable file',
        type: 'string',
        default: 'CLauncher'
      },
      {
        name: 'target',
        short: 't',
        description: 'Target platform (if not specified, builds all Windows targets)',
        type: 'string',
        choices: [
          'bun-windows-x64',
          'bun-windows-x64-baseline',
          'bun-linux-x64',
          'bun-linux-x64-baseline',
          'bun-linux-arm64',
          'bun-darwin-x64',
          'bun-darwin-arm64'
        ]
      },
      {
        name: 'windows-hide-console',
        description: 'Hide console window on Windows',
        type: 'boolean',
        default: false
      },
      {
        name: 'windows-icon',
        description: 'Path to .ico file for Windows executable',
        type: 'string'
      },
      {
        name: 'windows-title',
        description: 'Product name for Windows executable',
        type: 'string'
      },
      {
        name: 'windows-publisher',
        description: 'Company name for Windows executable',
        type: 'string'
      },
      {
        name: 'windows-version',
        description: 'Version string for Windows executable (e.g. 1.2.3.4)',
        type: 'string'
      },
      {
        name: 'windows-description',
        description: 'Description for Windows executable',
        type: 'string'
      },
      {
        name: 'windows-copyright',
        description: 'Copyright string for Windows executable',
        type: 'string'
      }
    ],
    handler: async (args, options, context) => {
      const config = fluxStackConfig
      const builder = new FluxStackBuilder(config)

      // Build executable options from CLI args with smart defaults
      const appName = config.app.name || 'CLauncher'
      const appVersion = config.app.version || '1.0.0'
      const currentYear = new Date().getFullYear()

      // Convert semver to Windows version format (1.0.0 -> 1.0.0.0)
      const windowsVersion = options['windows-version'] ||
        (appVersion.split('.').length === 3 ? `${appVersion}.0` : appVersion)

      // Determine targets to build based on current platform
      const getDefaultTargets = (): string[] => {
        const platform = process.platform
        const arch = process.arch

        if (platform === 'win32') {
          return ['bun-windows-x64', 'bun-windows-x64-baseline']
        } else if (platform === 'linux') {
          if (arch === 'arm64') {
            return ['bun-linux-arm64']
          }
          return ['bun-linux-x64', 'bun-linux-x64-baseline']
        } else if (platform === 'darwin') {
          if (arch === 'arm64') {
            return ['bun-darwin-arm64']
          }
          return ['bun-darwin-x64']
        }

        // Fallback to current platform
        return [`bun-${platform}-${arch}`]
      }

      const targets: string[] = options.target
        ? [options.target]
        : getDefaultTargets()

      const results: Array<{ target: string; success: boolean; outputPath?: string; error?: string }> = []

      for (const target of targets) {
        // Determine if this is a Windows target
        const isWindowsTarget = target.includes('windows')

        // Build executable options for this target
        const executableOptions: import("../types/build").BundleOptions = {
          target,
          executable: isWindowsTarget ? {
            windows: {
              hideConsole: options['windows-hide-console'],
              icon: options['windows-icon'],
              title: options['windows-title'] || appName,
              publisher: options['windows-publisher'] || appName,
              version: windowsVersion,
              description: options['windows-description'] || `${appName} Application`,
              copyright: options['windows-copyright'] || `Copyright © ${currentYear} ${appName}`
            }
          } : {}
        }

        // Generate output name with target suffix
        const baseName = options.name || appName
        const targetSuffix = target.replace('bun-', '').replace(/-/g, '_')
        const outputName = targets.length > 1 ? `${baseName}_${targetSuffix}` : baseName

        console.log(`\n🔨 Building for ${target}...`)
        const result = await builder.buildExecutable(outputName, executableOptions)

        results.push({
          target,
          success: result.success,
          outputPath: result.outputPath,
          error: result.error
        })

        if (result.success) {
          console.log(`✅ ${target}: ${result.outputPath}`)
        } else {
          console.error(`❌ ${target}: ${result.error}`)
        }
      }

      // Summary
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)

      console.log('\n' + '═'.repeat(50))
      console.log('📊 Build Summary')
      console.log('═'.repeat(50))

      if (successful.length > 0) {
        console.log(`\n✅ Successful (${successful.length}):`)
        for (const r of successful) {
          console.log(`   • ${r.target} → ${r.outputPath}`)
        }
      }

      if (failed.length > 0) {
        console.log(`\n❌ Failed (${failed.length}):`)
        for (const r of failed) {
          console.log(`   • ${r.target}: ${r.error}`)
        }
      }

      // Show Windows metadata if any Windows target was built
      const hasWindowsTarget = targets.some(t => t.includes('windows'))
      if (hasWindowsTarget && successful.length > 0) {
        console.log('\n📦 Windows executable metadata:')
        if (options['windows-hide-console']) console.log('   • Console window: hidden')
        if (options['windows-icon']) console.log(`   • Icon: ${options['windows-icon']}`)
        console.log(`   • Title: ${options['windows-title'] || appName}`)
        console.log(`   • Publisher: ${options['windows-publisher'] || appName}`)
        console.log(`   • Version: ${windowsVersion}`)
        console.log(`   • Description: ${options['windows-description'] || `${appName} Application`}`)
        console.log(`   • Copyright: ${options['windows-copyright'] || `Copyright © ${currentYear} ${appName}`}`)
      }

      if (failed.length > 0) {
        process.exit(1)
      }
    }
  })
}

// Main CLI logic
async function main() {
  // Register built-in commands
  await registerBuiltInCommands()
  
  // Discover and register plugin commands
  await pluginDiscovery.discoverAndRegisterCommands()
  
  // Handle special cases first
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    await cliRegistry.execute('help', args)
    return
  }
  
  // Check if it's a registered command (built-in or plugin)
  if (cliRegistry.has(command)) {
    const exitCode = await cliRegistry.execute(command, args)
    process.exit(exitCode)
    return
  }

  // Command not found - show error and help
  console.error(`❌ Unknown command: ${command}`)
  console.error()
  await cliRegistry.execute('help', args)
  process.exit(1)
}

// Run main CLI
main().catch(error => {
  console.error('❌ CLI Error:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})