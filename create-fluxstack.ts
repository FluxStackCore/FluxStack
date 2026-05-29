#!/usr/bin/env bun

/**
 * create-fluxstack — project generator (current model: framework-in-template)
 *
 * This generator clones the FluxStack framework source into the new project
 * (the entire `core/` tree and friends) rather than installing the framework
 * as an npm dependency. That's a transitional design: the long-term direction
 * is "framework-as-dep" once @fluxstack/framework is extracted as a published
 * package — same pattern we already have for @fluxstack/live and
 * @fluxstack/plugin-kit. When that happens, this script becomes a thin
 * template generator that writes a package.json with the framework as a dep
 * and never touches the framework source.
 *
 * Until that migration happens, this script exists to keep onboarding
 * working in the current model. The content it generates (README,
 * plugins/README, example code) MUST reflect the CURRENT framework
 * architecture — not the retired auto-discovery + class-based plugin
 * model that was removed in @fluxstack/plugin-kit@0.4.0.
 *
 * Reference points for "current architecture":
 *   - Plugins are registered statically via `framework.use(pluginObject)`
 *     in `app/server/index.ts`. No file-based discovery. No `plugin.json`.
 *   - Plugin shape is a plain object literal `export const xxxPlugin: Plugin = { ... }`,
 *     NOT `class XxxPlugin implements Plugin`. See the real plugins in
 *     `core/plugins/built-in/` and `@fluxstack/plugin-csrf-protection` for
 *     living examples.
 *   - Plugin types come from `@fluxstack/plugin-kit`, the canonical source.
 *     `@core/plugins/types` still works as a shim but is not the path to
 *     teach new users.
 */

import { program } from 'commander'
import { resolve, join, basename } from 'path'
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import prompts from 'prompts'
import { FLUXSTACK_VERSION } from './core/utils/version'

/** Modo de renderização do projeto criado. */
type RenderMode = 'spa' | 'ssr'

const logo = `
⚡ ███████ ██      ██    ██ ██   ██ ███████ ████████  █████   ██████ ██   ██
   ██      ██      ██    ██  ██ ██  ██         ██    ██   ██ ██      ██  ██
   █████   ██      ██    ██   ███   ███████    ██    ███████ ██      █████
   ██      ██      ██    ██  ██ ██       ██    ██    ██   ██ ██      ██  ██
   ██      ███████  ██████  ██   ██ ███████    ██    ██   ██  ██████ ██   ██

${chalk.cyan('💫 Powered by Bun - The Divine Runtime ⚡')}
${chalk.gray(`FluxStack v${FLUXSTACK_VERSION} - Creates full-stack TypeScript apps`)}
`

program
  .name('create-fluxstack')
  .description('⚡ Create FluxStack apps with zero configuration')
  .version(FLUXSTACK_VERSION)
  .argument('[project-name]', 'Name of the project to create (use "." for current dir; omit for interactive mode)')
  .option('--no-install', 'Skip dependency installation')
  .option('--no-git', 'Skip git initialization')
  .option('--mode <mode>', 'Render mode: "spa" or "ssr" (skips the prompt)')
  .action(async (projectName, options) => {
    console.clear()
    console.log(chalk.magenta(logo))

    // ── Modo INTERATIVO: sem project-name → pergunta tudo pelo terminal ──
    // create-fluxstack .        → cria na pasta atual
    // create-fluxstack my-app   → cria em ./my-app
    // create-fluxstack          → menu interativo (pergunta nome + modo)
    let renderMode: RenderMode | undefined =
      options.mode === 'spa' || options.mode === 'ssr' ? options.mode : undefined

    if (!projectName || projectName.trim().length === 0) {
      const answers = await prompts(
        [
          {
            type: 'text',
            name: 'projectName',
            message: 'Nome do projeto (use "." para a pasta atual):',
            initial: 'my-fluxstack-app',
            validate: (v: string) => (v && v.trim().length > 0 ? true : 'Informe um nome ou "."'),
          },
          {
            type: renderMode ? null : 'select',
            name: 'mode',
            message: 'Modo de renderização:',
            choices: [
              { title: 'SPA', description: 'Client-side puro (padrão, mais simples)', value: 'spa' },
              { title: 'SSR (RSC)', description: 'Server-rendered + React Server Components + ilhas Live', value: 'ssr' },
            ],
            initial: 0,
          },
        ],
        { onCancel: () => { console.log(chalk.gray('\nCancelado.')); process.exit(0) } },
      )
      projectName = answers.projectName
      renderMode = renderMode ?? (answers.mode as RenderMode)
    } else if (!renderMode) {
      // Tem nome mas não passou --mode → pergunta só o modo.
      const { mode } = await prompts(
        {
          type: 'select',
          name: 'mode',
          message: 'Modo de renderização:',
          choices: [
            { title: 'SPA', description: 'Client-side puro (padrão, mais simples)', value: 'spa' },
            { title: 'SSR (RSC)', description: 'Server-rendered + React Server Components + ilhas Live', value: 'ssr' },
          ],
          initial: 0,
        },
        { onCancel: () => { console.log(chalk.gray('\nCancelado.')); process.exit(0) } },
      )
      renderMode = (mode as RenderMode) ?? 'spa'
    }

    renderMode = renderMode ?? 'spa'

    const currentDir = import.meta.dir

    // Normalize path: remove trailing slashes (which may indicate current dir usage like path/.)
    let normalizedName = projectName
    const hasTrailingSlash = normalizedName.endsWith('/') || normalizedName.endsWith('\\')

    if (hasTrailingSlash) {
      normalizedName = normalizedName.slice(0, -1)
    }

    // Check if it's current directory
    // - Explicit '.'
    // - Path ending with /. or \. (e.g., /path/to/dir/.)
    // - Path ending with / or \ (Bun normalizes path/. to path/)
    const isCurrentDir = normalizedName === '.' ||
                         projectName.endsWith('/.') ||
                         projectName.endsWith('\\.') ||
                         hasTrailingSlash

    const projectPath = resolve(normalizedName)
    const displayName = isCurrentDir ? 'current directory' : projectName

    // Check if directory already exists (skip for current dir)
    if (!isCurrentDir && existsSync(projectPath)) {
      console.log(chalk.red(`❌ Directory ${projectName} already exists`))
      process.exit(1)
    }

    // Check if current directory is not empty (when using '.')
    if (isCurrentDir) {
      const files = readdirSync(projectPath).filter(f => !f.startsWith('.'))
      if (files.length > 0) {
        console.log(chalk.yellow('⚠️  Current directory is not empty'))
        console.log(chalk.gray(`Found ${files.length} file(s). FluxStack will be initialized here.`))
      }
    }

    console.log(chalk.cyan(`\n🚀 Creating FluxStack project: ${chalk.bold(displayName)}`))
    console.log(chalk.gray(`📁 Location: ${projectPath}`))
    console.log(chalk.gray(`🎨 Render mode: ${chalk.bold(renderMode === 'ssr' ? 'SSR (RSC)' : 'SPA')}`))
    
    // Create project directory
    const spinner = ora('Creating project structure...').start()

    try {
      // Only create directory if not using current directory
      if (!isCurrentDir) {
        mkdirSync(projectPath, { recursive: true })
      }
      
      // Copy only essential FluxStack files (not node_modules, not test apps, etc.)
      const frameworkDir = currentDir // Use current directory (framework root)
      const filesToCopy = [
        'core',
        'app',
        'config',         // ✅ CRITICAL: Copy config folder with declarative configs
        'plugins',        // TODO: Copy when crypto-auth plugin is complete
        'LLMD',           // ✅ CRITICAL: LLM-optimized documentation for AI assistants
        'bun.lock',       // ✅ CRITICAL: Copy lockfile to maintain working versions
        'package.json',   // ✅ Copy real package.json from framework
        'tsconfig.json',
        'vite.config.ts',
        '.env.example',   // ✅ Use .env.example as template
        'CLAUDE.md',      // ✅ Project instructions for AI assistants
        'README.md'
      ]

      for (const file of filesToCopy) {
        const sourcePath = join(frameworkDir, file)
        const destPath = join(projectPath, file)

        if (existsSync(sourcePath)) {
          cpSync(sourcePath, destPath, { recursive: true })
        }
      }

      // Create empty plugins directory for user plugins
      const pluginsDir = join(projectPath, 'plugins')
      mkdirSync(pluginsDir, { recursive: true })

      // Create a README in plugins folder
      const pluginsReadme = `# Plugins

This folder is where your **custom project-local plugins** live.
External npm plugins (e.g. \`@fluxstack/plugin-csrf-protection\`) are
installed via \`bun add\` and imported from \`node_modules\` instead.

## ⚡ How plugins are loaded

FluxStack uses **explicit static registration**. Every plugin must be
imported and passed to \`framework.use()\` in \`app/server/index.ts\`:

\`\`\`typescript
// app/server/index.ts
import { FluxStackFramework } from "@core/server"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { myPlugin } from "../../plugins/my-plugin"

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(myPlugin)
\`\`\`

There is **no auto-discovery**. A plugin file sitting in this folder
is not loaded unless something explicitly imports and registers it.
This is intentional — it makes the dev and production builds behave
identically (bundlers can tree-shake and include plugin code only
when it's statically referenced) and makes the list of enabled
plugins auditable in one file.

## 📖 Full documentation

- \`LLMD/resources/plugins-external.md\` — plugin authoring guide
- \`LLMD/reference/plugin-hooks.md\` — every hook and its signature

## 🛠️ CLI scaffolding

Generate a new plugin skeleton:

\`\`\`bash
bun run cli make:plugin my-plugin                    # basic
bun run cli make:plugin my-plugin --template full    # server + client
bun run cli make:plugin my-plugin --template server  # server only
\`\`\`

After running \`make:plugin\`, the CLI will print instructions
telling you to import and \`.use()\` the new plugin in
\`app/server/index.ts\`. Do that step — the generator does not
auto-edit your server file.

## 📁 Plugin layout

\`\`\`
plugins/
└── my-plugin/
    ├── index.ts          # Plugin object (with setup + optional hooks)
    ├── config/           # Optional: per-plugin declarative config
    │   └── index.ts
    ├── server/           # Optional: server-side services
    └── client/           # Optional: client-side code
\`\`\`

A plugin's identity lives in its exported object, not in a separate
metadata file. No \`plugin.json\` is needed (or read).

## 🔌 Writing a plugin

A plugin is a **plain object** implementing the \`Plugin\` interface
from \`@fluxstack/plugin-kit\`:

\`\`\`typescript
// plugins/my-plugin/index.ts
import type { Plugin, PluginContext, RequestContext, ErrorContext } from "@fluxstack/plugin-kit"

export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Example plugin that logs requests',

  // Called once during framework.start(). Use this to initialize
  // resources, mount Elysia routes via ctx.app, register
  // client-side JS hooks via ctx.clientHooks, etc.
  setup: async (ctx: PluginContext) => {
    ctx.logger.info('[my-plugin] initialized')
  },

  // Fires before every request is routed. Read ctx.path / ctx.method
  // / ctx.headers. Set ctx.handled = true and ctx.response to
  // short-circuit the pipeline.
  onBeforeRoute: async (ctx: RequestContext) => {
    if (ctx.path.startsWith('/api/protected')) {
      const token = ctx.headers['authorization']
      if (!token) {
        ctx.handled = true
        ctx.response = new Response('Unauthorized', { status: 401 })
      }
    }
  },

  // Fires if a route handler throws.
  onError: async (ctx: ErrorContext) => {
    console.error('[my-plugin] handler failed:', ctx.error.message)
  },
}

export default myPlugin
\`\`\`

Then register it in \`app/server/index.ts\`:

\`\`\`typescript
import { myPlugin } from '../../plugins/my-plugin'

framework.use(myPlugin)
\`\`\`

## ❌ Plugin as class — DON'T

The old class-based pattern (\`export class MyPlugin implements Plugin\`)
is deprecated. All new plugins should be plain object literals. The
built-in plugins and \`@fluxstack/plugin-csrf-protection\` are all
objects, and they're the canonical reference.

## 💡 Common hook choices

| You want to... | Use this hook |
|---|---|
| Initialize shared state / mount routes | \`setup\` |
| Intercept incoming requests | \`onRequest\` or \`onBeforeRoute\` |
| Inspect or transform responses | \`onBeforeResponse\` or \`onResponse\` |
| Validate requests (auth, CSRF, etc.) | \`onRequestValidation\` |
| Handle uncaught handler errors | \`onError\` |
| Run code at server startup | \`onServerStart\` |

See \`@fluxstack/plugin-csrf-protection\` for a real-world example
that uses \`setup\` (to mount \`GET /api/__csrf\`) and
\`onRequestValidation\` (to reject mutating requests without a token).
`
      writeFileSync(join(pluginsDir, 'README.md'), pluginsReadme)
      
      // Generate .gitignore using template (instead of copying)
      const gitignoreContent = `# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
/dist
/build
/.next/
/out/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional stylelint cache
.stylelintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# FluxStack specific
uploads/
public/uploads/
.fluxstack/

# Bun
bun.lockb
`
      writeFileSync(join(projectPath, '.gitignore'), gitignoreContent)
      
      // Customize package.json with project name
      const packageJsonPath = join(projectPath, 'package.json')
      const actualProjectName = basename(projectPath)

      if (existsSync(packageJsonPath)) {
        const packageContent = readFileSync(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(packageContent)

        // Update project-specific fields
        packageJson.name = actualProjectName
        packageJson.description = `${actualProjectName} - FluxStack application`
        packageJson.version = "1.0.0"

        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
      }

      // Create .env from .env.example and set development mode + project name
      const envExamplePath = join(projectPath, '.env.example')
      const envPath = join(projectPath, '.env')
      if (existsSync(envExamplePath)) {
        let envContent = readFileSync(envExamplePath, 'utf-8')
        // Set development mode
        envContent = envContent.replace('NODE_ENV=production', 'NODE_ENV=development')
        // Customize app name to match project name
        envContent = envContent.replace('VITE_APP_NAME=FluxStack', `VITE_APP_NAME=${actualProjectName}`)
        // Render mode escolhido: liga RSC (SSR) ou mantém SPA.
        const rscLine = `\n# Render mode (escolhido na criação): RSC/SSR liga server-rendering\nRSC_ENABLED=${renderMode === 'ssr' ? 'true' : 'false'}\n`
        if (/^RSC_ENABLED=/m.test(envContent)) {
          envContent = envContent.replace(/^RSC_ENABLED=.*$/m, `RSC_ENABLED=${renderMode === 'ssr' ? 'true' : 'false'}`)
        } else {
          envContent += rscLine
        }
        writeFileSync(envPath, envContent)
      }

      // Customize README.md
      const readmePath = join(projectPath, 'README.md')
      if (existsSync(readmePath)) {
        const readmeContent = `# ${actualProjectName}

⚡ **FluxStack Application** - Modern full-stack TypeScript framework

## 🚀 Getting Started

\`\`\`bash
# Start development
bun run dev

# Build for production  
bun run build

# Start production server
bun run start
\`\`\`

## 📁 Project Structure

\`\`\`
${actualProjectName}/
├── core/          # FluxStack framework (don't modify)
├── app/           # Your application code
│   ├── server/    # Backend API routes
│   ├── client/    # Frontend React app
│   └── shared/    # Shared types and utilities
└── package.json
\`\`\`

## 🔥 Features

- **⚡ Bun Runtime** - 3x faster than Node.js
- **🔒 Full Type Safety** - Eden Treaty + TypeScript
- **🎨 Modern UI** - React 19 + Tailwind CSS v4
- **📋 Auto Documentation** - Swagger UI generated
- **🔄 Hot Reload** - Backend + Frontend
- **🔌 Plugin System** - Extensible with custom plugins

## 🔌 Adding Plugins

Plugins are registered **explicitly** via \`framework.use()\` in
\`app/server/index.ts\`. There is no auto-discovery — every plugin you
want enabled must be imported and passed to \`.use()\`. This is the
only registration path: dev mode and production bundles behave identically.

### Built-in Plugins

FluxStack ships with several built-in plugins:

\`\`\`typescript
// app/server/index.ts
import { FluxStackFramework } from "@core/server"
import { vitePlugin } from "@core/plugins/built-in/vite"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { liveComponentsPlugin } from "@core/server/live"

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)
  .use(vitePlugin)
\`\`\`

### Using an npm Plugin

Install the package, import it, and register via \`.use()\`:

\`\`\`typescript
// app/server/index.ts
import { csrfProtectionPlugin } from "@fluxstack/plugin-csrf-protection"

framework.use(csrfProtectionPlugin)
\`\`\`

### Writing Your Own Plugin

A plugin is a **plain object** implementing the \`Plugin\` interface
from \`@fluxstack/plugin-kit\`. NOT a class — just an object with hook
functions as fields.

\`\`\`typescript
// plugins/my-plugin/index.ts
import type { Plugin, PluginContext, RequestContext } from "@fluxstack/plugin-kit"

export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',

  // Runs once during framework.start() — use this to initialize
  // resources, mount Elysia routes via context.app, register client
  // hooks, etc.
  setup: async (ctx: PluginContext) => {
    ctx.logger.info('[my-plugin] initialized')
  },

  // Runs before every request is routed
  onBeforeRoute: async (ctx: RequestContext) => {
    // e.g. inspect ctx.path, reject with ctx.handled = true, etc.
  },

  // Runs if a handler throws
  onError: async (ctx) => {
    ctx.logger?.error('[my-plugin] handler failed', ctx.error)
  },
}

export default myPlugin
\`\`\`

Then register it:

\`\`\`typescript
// app/server/index.ts
import { myPlugin } from '../../plugins/my-plugin'

framework.use(myPlugin)
\`\`\`

### Available Plugin Hooks

| Hook | When it fires |
|---|---|
| \`setup\` | Once during \`framework.start()\`, before routes handle requests |
| \`onBeforeServerStart\` / \`onServerStart\` / \`onAfterServerStart\` | Server lifecycle |
| \`onRequest\` | Every incoming request, before routing |
| \`onBeforeRoute\` / \`onAfterRoute\` | Around route matching |
| \`onBeforeResponse\` / \`onResponse\` | Around response delivery |
| \`onRequestValidation\` | Request validation step (used by CSRF protection, auth guards, etc.) |
| \`onError\` | Uncaught errors in handlers |
| \`onBuild\` / \`onBuildComplete\` | Build pipeline |

See \`LLMD/reference/plugin-hooks.md\` for full hook signatures.

## 📖 Learn More

- **LLM Documentation**: Check \`LLMD/INDEX.md\` for AI-optimized docs
- **Plugin Guide**: Check \`LLMD/resources/plugins-external.md\`
- **FluxStack Docs**: Visit the [FluxStack Repository](https://github.com/MarcosBrendonDePaula/FluxStack)

---

Built with ❤️ using FluxStack
`
        writeFileSync(readmePath, readmeContent)
      }
      
      spinner.succeed('✅ Project structure created!')
      
      // Install dependencies with Bun (THE DIVINE RUNTIME)
      if (options.install) {
        const installSpinner = ora('📦 Installing dependencies with Bun...').start()
        
        try {
          const proc = Bun.spawn(['bun', 'install'], {
            cwd: projectPath,
            stdio: ['ignore', 'pipe', 'pipe']
          })
          
          await proc.exited
          
          if (proc.exitCode === 0) {
            installSpinner.succeed('✅ Dependencies installed!')
          } else {
            installSpinner.fail('❌ Failed to install dependencies')
            console.log(chalk.gray('You can install them manually with: bun install'))
          }
        } catch (error) {
          installSpinner.fail('❌ Failed to install dependencies')
          console.log(chalk.gray('You can install them manually with: bun install'))
        }
      }
      
      // Initialize git
      if (options.git) {
        const gitSpinner = ora('📝 Initializing git repository...').start()
        
        try {
          const initProc = Bun.spawn(['git', 'init'], {
            cwd: projectPath,
            stdio: ['ignore', 'pipe', 'pipe']
          })
          await initProc.exited
          
          // Create initial commit
          const addProc = Bun.spawn(['git', 'add', '.'], {
            cwd: projectPath,
            stdio: ['ignore', 'pipe', 'pipe']
          })
          await addProc.exited
          
          const commitProc = Bun.spawn(['git', 'commit', '-m', `feat: initial ${actualProjectName} with FluxStack`], {
            cwd: projectPath,
            stdio: ['ignore', 'pipe', 'pipe']
          })
          await commitProc.exited
          
          gitSpinner.succeed('✅ Git repository initialized!')
        } catch (error) {
          gitSpinner.fail('❌ Failed to initialize git')
          console.log(chalk.gray('You can initialize it manually with: git init'))
        }
      }
      
      // Success message
      console.log(chalk.green('\n🎉 Project created successfully!'))
      console.log(chalk.cyan('\nNext steps:'))
      if (!isCurrentDir) {
        console.log(chalk.white(`  cd ${projectName}`))
      }
      if (!options.install) {
        console.log(chalk.white(`  bun install`))
      }
      console.log(chalk.white(`  bun run dev`))
      console.log(chalk.magenta('\nHappy coding with the divine Bun runtime! ⚡🔥'))
      console.log(chalk.gray('\nVisit http://localhost:3000 when ready!'))
      
    } catch (error) {
      spinner.fail('❌ Failed to create project')
      console.error(error)
      process.exit(1)
    }
  })

program.parse()