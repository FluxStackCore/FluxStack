import type { Generator } from "./index"
import type { GeneratorContext, GeneratorOptions, Template } from "./types"
import { templateEngine } from "./template-engine"
import { buildLogger } from "@core/utils/build-logger"

/**
 * Plugin scaffolder for `bun run cli make:plugin <name>`.
 *
 * Emits project-local plugin skeletons into `plugins/<name>/`. The
 * generated code follows the CURRENT plugin model:
 *
 *   - Plugin is a plain object literal implementing `Plugin` from
 *     `@fluxstack/plugin-kit`. NOT a class.
 *   - No `plugin.json`, no auto-discovery, no `fluxstack` manifest
 *     block in `package.json`. Plugins live inside the project and
 *     are imported via relative path, then registered via
 *     `framework.use(myPlugin)` in `app/server/index.ts`.
 *   - `package.json` for a project-local plugin is optional and
 *     minimal. It is NOT an npm package — it's just a way to let
 *     the plugin pin its own dev-time dependencies if needed. Most
 *     plugins will not need one at all.
 *   - The generator does NOT auto-edit `app/server/index.ts`. After
 *     scaffolding, it prints explicit instructions for the user to
 *     import and `.use()` the new plugin themselves.
 */
export class PluginGenerator implements Generator {
    name = 'plugin'
    description = 'Generate a new FluxStack plugin'

    async generate(context: GeneratorContext, options: GeneratorOptions): Promise<void> {
        const template = this.getTemplate(options.template)

        // Derive identifier names that already include "Plugin" as a suffix,
        // WITHOUT duplicating it when the user's plugin name already ends
        // with -plugin. Examples:
        //   'my-plugin'        → pluginIdent = myPlugin
        //   'csrf-protection'  → pluginIdent = csrfProtectionPlugin
        //   'my-test-plugin'   → pluginIdent = myTestPlugin
        //
        // These are injected into the template variables via options (the
        // template engine spreads options into the variable bag before
        // processing {{placeholders}}), so the templates can use
        // {{pluginIdent}} / {{pluginIdentPascal}} directly.
        const camelName = this.toCamelCase(options.name)
        const pascalName = this.toPascalCase(options.name)
        const alreadyEndsWithPlugin = /plugin$/i.test(options.name)
        const pluginIdent = alreadyEndsWithPlugin ? camelName : `${camelName}Plugin`
        const pluginIdentPascal = alreadyEndsWithPlugin ? pascalName : `${pascalName}Plugin`

        const enrichedOptions: GeneratorOptions = {
            ...options,
            pluginIdent,
            pluginIdentPascal,
        }

        if (template.hooks?.beforeGenerate) {
            await template.hooks.beforeGenerate(context, enrichedOptions)
        }

        const files = await templateEngine.processTemplate(template, context, enrichedOptions)

        if (options.dryRun) {
            buildLogger.info(`\n📋 Would generate plugin '${options.name}':\n`)
            for (const file of files) {
                buildLogger.info(`${file.action === 'create' ? '📄' : '✏️'} ${file.path}`)
            }
            return
        }

        await templateEngine.generateFiles(files, options.dryRun)

        if (template.hooks?.afterGenerate) {
            const filePaths = files.map(f => f.path)
            await template.hooks.afterGenerate(context, enrichedOptions, filePaths)
        }

        buildLogger.success(`Generated plugin '${options.name}' with ${files.length} files`)

        const importPath = `../../plugins/${options.name}`

        buildLogger.info(`\n📝 Next steps:`)
        buildLogger.info(`   1. Implement your plugin logic in plugins/${options.name}/index.ts`)
        buildLogger.info(`   2. Configure it (optional) in plugins/${options.name}/config/index.ts`)
        buildLogger.info(``)
        buildLogger.info(`   3. Register the plugin in app/server/index.ts:`)
        buildLogger.info(``)
        buildLogger.info(`        import { ${pluginIdent} } from '${importPath}'`)
        buildLogger.info(``)
        buildLogger.info(`        framework.use(${pluginIdent})`)
        buildLogger.info(``)
        buildLogger.info(`   ⚠️  Plugins are NOT auto-discovered. They must be explicitly`)
        buildLogger.info(`      registered via framework.use() to be loaded at runtime.`)
        buildLogger.info(``)
        buildLogger.info(`   4. Run: bun run dev`)
    }

    // Local copies of the same case helpers the template engine uses
    // internally. We need them here to precompute pluginIdent /
    // pluginIdentPascal before the template engine runs, so we can
    // inject them into the variable bag via enrichedOptions.
    private toCamelCase(str: string): string {
        return str.replace(/[-_\s]+(.)?/g, (_, c: string | undefined) =>
            c ? c.toUpperCase() : '',
        )
    }

    private toPascalCase(str: string): string {
        const camel = this.toCamelCase(str)
        return camel.charAt(0).toUpperCase() + camel.slice(1)
    }

    private getTemplate(templateName?: string): Template {
        switch (templateName) {
            case 'full':
                return this.getFullTemplate()
            case 'server':
                return this.getServerOnlyTemplate()
            case 'client':
                return this.getClientOnlyTemplate()
            default:
                return this.getBasicTemplate()
        }
    }

    private getBasicTemplate(): Template {
        return {
            name: 'basic-plugin',
            description: 'Basic plugin template (plain object literal)',
            files: [
                {
                    path: 'plugins/{{name}}/config/index.ts',
                    content: `/**
 * {{pascalName}} Plugin Configuration
 * Declarative config using @fluxstack/config
 */

import { defineConfig, config } from '@fluxstack/config'

const {{camelName}}ConfigSchema = {
  // Enable/disable plugin
  enabled: config.boolean('{{constantName}}_ENABLED', true),

  // Add your configuration options here. Example:
  // apiKey: config.string('{{constantName}}_API_KEY', ''),
  // timeout: config.number('{{constantName}}_TIMEOUT', 5000),
  // debug: config.boolean('{{constantName}}_DEBUG', false),
} as const

export const {{camelName}}Config = defineConfig({{camelName}}ConfigSchema)

export type {{pascalName}}Config = typeof {{camelName}}Config
export default {{camelName}}Config
`
                },
                {
                    path: 'plugins/{{name}}/index.ts',
                    content: `import type {
  Plugin,
  PluginContext,
  RequestContext,
  ResponseContext,
  ErrorContext,
} from '@fluxstack/plugin-kit'
import { {{camelName}}Config } from './config'

/**
 * {{pascalName}} Plugin
 * {{description}}
 *
 * Plugins are plain object literals implementing the \`Plugin\`
 * interface from @fluxstack/plugin-kit. To enable this plugin,
 * import it in app/server/index.ts and pass it to framework.use():
 *
 *   import { {{pluginIdent}} } from '../../plugins/{{name}}'
 *
 *   framework.use({{pluginIdent}})
 */
export const {{pluginIdent}}: Plugin = {
  name: '{{name}}',
  version: '1.0.0',
  description: '{{description}}',

  /**
   * Setup hook — runs once during framework.start().
   * Use it to initialize resources, mount Elysia routes via
   * context.app, register client-side hooks via context.clientHooks,
   * etc.
   */
  setup: async (context: PluginContext) => {
    if (!{{camelName}}Config.enabled) {
      context.logger.info('[{{name}}] disabled by configuration')
      return
    }

    context.logger.info('[{{name}}] initialized')

    // Add your initialization logic here
  },

  /**
   * Server start hook — runs once after the HTTP server starts listening.
   */
  onServerStart: async (context: PluginContext) => {
    if (!{{camelName}}Config.enabled) return
    context.logger.debug('[{{name}}] server started')
  },

  /**
   * Request hook — runs on every incoming request.
   * Remove this if you don't need per-request behavior.
   */
  onRequest: async (_context: RequestContext) => {
    if (!{{camelName}}Config.enabled) return
    // Add request processing logic
  },

  /**
   * Response hook — runs on every outgoing response.
   * Remove this if you don't need per-response behavior.
   */
  onResponse: async (_context: ResponseContext) => {
    if (!{{camelName}}Config.enabled) return
    // Add response processing logic
  },

  /**
   * Error hook — runs when an error is thrown from a handler.
   */
  onError: async (context: ErrorContext) => {
    console.error('[{{name}}] error:', context.error.message)
  },
}

export default {{pluginIdent}}
`
                },
                {
                    path: 'plugins/{{name}}/README.md',
                    content: `# {{pascalName}} Plugin

{{description}}

## Enabling this plugin

Plugins are **not** auto-discovered. To enable this plugin, import
it and register it via \`framework.use()\` in \`app/server/index.ts\`:

\`\`\`typescript
import { {{pluginIdent}} } from '../../plugins/{{name}}'

const framework = new FluxStackFramework()
  .use({{pluginIdent}})
\`\`\`

## Configuration

This plugin uses FluxStack's declarative config system
(\`@fluxstack/config\`). Tweak defaults in
\`plugins/{{name}}/config/index.ts\`, or set environment variables:

\`\`\`bash
# Enable/disable the plugin
{{constantName}}_ENABLED=true

# Add your own environment variables here. Example:
# {{constantName}}_API_KEY=your-api-key
# {{constantName}}_TIMEOUT=5000
\`\`\`

The config is self-contained in the plugin folder, so this plugin
is fully portable — copy the folder into another FluxStack project,
register it via \`.use()\`, and it works.

## Hooks this plugin uses

- \`setup\` — initialize resources at startup
- \`onServerStart\` — runs after the HTTP server binds the port
- \`onRequest\` — runs on every incoming request (remove if unused)
- \`onResponse\` — runs on every outgoing response (remove if unused)
- \`onError\` — runs when a handler throws

See \`LLMD/reference/plugin-hooks.md\` for the full list of hooks
and their signatures.

## Development

1. Edit \`config/index.ts\` to add configuration options
2. Edit \`index.ts\` to implement your plugin logic
3. Register the plugin via \`framework.use()\` (see above)
4. Run: \`bun run dev\`

## License

MIT
`
                }
            ]
        }
    }

    private getServerOnlyTemplate(): Template {
        const basic = this.getBasicTemplate()
        return {
            ...basic,
            name: 'server-plugin',
            description: 'Plugin with server-side service code',
            files: [
                ...basic.files,
                {
                    path: 'plugins/{{name}}/server/index.ts',
                    content: `/**
 * Server-side service for {{pascalName}} plugin
 *
 * Import this from plugins/{{name}}/index.ts and wire it up inside
 * the plugin's setup hook. Keeping services as named exports (not
 * default-exported singletons) makes them easier to test.
 */

export class {{pascalName}}Service {
  async initialize(): Promise<void> {
    console.log('[{{name}}] server service initialized')
  }

  // Add your server-side methods here
}

export const {{camelName}}Service = new {{pascalName}}Service()
`
                }
            ]
        }
    }

    private getClientOnlyTemplate(): Template {
        const basic = this.getBasicTemplate()
        return {
            ...basic,
            name: 'client-plugin',
            description: 'Plugin with client-side code',
            files: [
                ...basic.files,
                {
                    path: 'plugins/{{name}}/client/index.ts',
                    content: `/**
 * Client-side code for {{pascalName}} plugin
 *
 * This runs in the browser. If you need the plugin's server-side
 * setup hook to inject a <script> tag or a fetch interceptor into
 * the client, use \`context.clientHooks.register()\` from within
 * the plugin's setup() in plugins/{{name}}/index.ts.
 */

export class {{pascalName}}Client {
  initialize(): void {
    console.log('[{{name}}] client initialized')
  }

  // Add your client-side methods here
}

export const {{camelName}}Client = new {{pascalName}}Client()
`
                }
            ]
        }
    }

    private getFullTemplate(): Template {
        const basic = this.getBasicTemplate()

        return {
            ...basic,
            name: 'full-plugin',
            description: 'Complete plugin with server + client code',
            files: [
                ...basic.files,
                {
                    path: 'plugins/{{name}}/server/index.ts',
                    content: `/**
 * Server-side service for {{pascalName}} plugin
 */

export class {{pascalName}}Service {
  async initialize(): Promise<void> {
    console.log('[{{name}}] server service initialized')
  }

  // Add your server-side methods here
}

export const {{camelName}}Service = new {{pascalName}}Service()
`
                },
                {
                    path: 'plugins/{{name}}/client/index.ts',
                    content: `/**
 * Client-side code for {{pascalName}} plugin
 */

export class {{pascalName}}Client {
  initialize(): void {
    console.log('[{{name}}] client initialized')
  }

  // Add your client-side methods here
}

export const {{camelName}}Client = new {{pascalName}}Client()
`
                },
                {
                    path: 'plugins/{{name}}/types.ts',
                    content: `/**
 * Type definitions for {{pascalName}} plugin
 */

// Config types are exported from ./config/index.ts
// Import them like:
//   import type { {{pascalName}}Config } from './config'

export interface {{pascalName}}Options {
  // Add your runtime options types here
}

export interface {{pascalName}}Event {
  // Add your event types here
}
`
                }
            ]
        }
    }
}
