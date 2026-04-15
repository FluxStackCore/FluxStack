# Plugin System

**Version:** 1.19.0 | **Updated:** 2026-04-14

## Quick Facts

- Plugin types/runtime: `@fluxstack/plugin-kit` (v0.4.0) — canonical source
- Local shim: `core/plugins/types.ts` re-exports with `FluxStackConfig` specialization
- Registry: `PluginRegistry` manages all plugins
- Manager: `PluginManager` handles lifecycle and execution
- Registration: **Manual only** via `.use(plugin)` — no auto-discovery
- Dependencies: Automatic resolution with topological sort

## plugin-kit@0.4.0

All plugin types and runtime classes now live in the `@fluxstack/plugin-kit`
package (extracted from the old `core/plugins/` monolith). The local file
`core/plugins/types.ts` is a thin re-export shim that specializes the generic
`Plugin<TConfig>` against `FluxStackConfig`, so existing imports from
`@core/plugins/types` keep working.

Key exports from `@fluxstack/plugin-kit`:
- **Types**: `Plugin`, `PluginContext`, `PluginHook`, `PluginPriority`, etc.
- **Runtime**: `PluginRegistry`, `PluginManager`, `PluginExecutor`,
  `PluginModuleResolver`, `PluginDiscovery`
- **Helpers**: `createPluginUtils`, `createRequestContext`,
  `createResponseContext`, `createErrorContext`, `createBuildContext`

## Plugin Interface

```typescript
// Canonical source: @fluxstack/plugin-kit
interface Plugin<TConfig = unknown> {
  // Required
  name: string
  
  // Optional metadata
  version?: string
  description?: string
  author?: string
  dependencies?: string[]        // Plugin dependencies
  priority?: number | PluginPriority
  category?: string
  tags?: string[]
  
  // Lifecycle hooks (20+ available)
  setup?: (context: PluginContext) => void | Promise<void>
  onConfigLoad?: (context: ConfigLoadContext) => void | Promise<void>
  onBeforeServerStart?: (context: PluginContext) => void | Promise<void>
  onServerStart?: (context: PluginContext) => void | Promise<void>
  onAfterServerStart?: (context: PluginContext) => void | Promise<void>
  onBeforeServerStop?: (context: PluginContext) => void | Promise<void>
  onServerStop?: (context: PluginContext) => void | Promise<void>
  
  // Request/Response hooks
  onRequest?: (context: RequestContext) => void | Promise<void>
  onBeforeRoute?: (context: RequestContext) => void | Promise<void>
  onAfterRoute?: (context: RouteContext) => void | Promise<void>
  onBeforeResponse?: (context: ResponseContext) => void | Promise<void>
  onResponse?: (context: ResponseContext) => void | Promise<void>
  onRequestValidation?: (context: ValidationContext) => void | Promise<void>
  onResponseTransform?: (context: TransformContext) => void | Promise<void>
  
  // Error handling
  onError?: (context: ErrorContext) => void | Promise<void>
  
  // Build hooks
  onBeforeBuild?: (context: BuildContext) => void | Promise<void>
  onBuild?: (context: BuildContext) => void | Promise<void>
  onBuildAsset?: (context: BuildAssetContext) => void | Promise<void>
  onBuildComplete?: (context: BuildContext) => void | Promise<void>
  onBuildError?: (context: BuildErrorContext) => void | Promise<void>
  
  // Plugin system hooks
  onPluginRegister?: (context: PluginEventContext) => void | Promise<void>
  onPluginUnregister?: (context: PluginEventContext) => void | Promise<void>
  onPluginError?: (context: PluginEventContext & { error: Error }) => void | Promise<void>
  
  // CLI commands
  commands?: CliCommand[]
}
```

## Plugin Registration

Since `@fluxstack/plugin-kit@0.4.0`, **all plugins are registered manually**
via `.use()`. Auto-discovery from `plugins/` and `node_modules/` was removed
because it broke silently in production bundles (`dist/node_modules/` does not
exist after bundling). Every plugin the app uses must be explicitly imported
and `.use()`-d in the server entry point.

### How It Works

```typescript
// app/server/index.ts
import { FluxStackFramework } from "@core/server"

// Built-in plugins (shipped with FluxStack core)
import { vitePlugin } from "@core/plugins/built-in/vite"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { liveComponentsPlugin } from "@core/server/live"

// External / NPM plugins — import + .use() explicitly
import { csrfProtectionPlugin } from "@fluxstack/plugin-csrf-protection"

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)
  .use(csrfProtectionPlugin)

// Conditional registration
if (appConfig.mode !== 'backend-only') {
  framework.use(vitePlugin)
}

framework.routes(appInstance)
await framework.listen()
```

### Registration Flow

```mermaid
graph TD
    A[Server Entry Point] --> B[import plugin]
    B --> C[framework.use plugin]
    C --> D[PluginRegistry.register]
    D --> E[Resolve dependencies]
    E --> F[Calculate load order]
    F --> G[Execute setup hooks]
```

### Plugin Categories

**Built-in Plugins** (`core/plugins/built-in/`):
- Part of framework core: vite, swagger, static, live-components, monitoring
- Imported from `@core/plugins/built-in/*`
- Registered via `.use()`

**Project Plugins** (`plugins/`):
- User-created plugins in the project directory
- Imported with relative paths or path aliases
- Registered via `.use()`

**NPM Plugins** (`node_modules/`):
- Third-party plugins installed via `bun add`
- Imported by package name (e.g., `@fluxstack/plugin-csrf-protection`)
- Registered via `.use()`
- The bundler includes them statically — no runtime filesystem scanning

### Why No Auto-Discovery

Auto-discovery was removed in plugin-kit@0.4.0 for these reasons:

1. **Production bundles break**: `dist/node_modules/` does not exist after
   bundling, so runtime scanning finds nothing in production.
2. **Implicit behavior**: Plugins activating without explicit code made
   debugging harder and created security concerns.
3. **Static analysis**: Explicit imports let bundlers tree-shake unused
   plugins and let TypeScript verify types at compile time.

## Dependency Resolution

### Dependency Declaration

```typescript
export default {
  name: 'my-plugin',
  dependencies: ['database', 'auth'],  // Requires these plugins
  setup: async (context) => {
    // Can safely use database and auth plugins
  }
}
```

### Load Order Algorithm

1. **Build Dependency Graph**: Map all plugin dependencies
2. **Topological Sort**: Order plugins so dependencies load first
3. **Circular Detection**: Throw error if circular dependency found
4. **Priority Sort**: Within dependency groups, sort by priority

**Priority Values**:
- `highest` or `100+`: Load first (core infrastructure)
- `high` or `50-99`: Load early (auth, database)
- `normal` or `0-49`: Default (most plugins)
- `low` or `-50 to -1`: Load late (monitoring)
- `lowest` or `-100 or less`: Load last (cleanup)

**Example Load Order**:
```
database (priority: 100, no deps)
  ↓
auth (priority: 50, deps: [database])
  ↓
api (priority: 0, deps: [auth])
  ↓
monitoring (priority: -50, deps: [api])
```

## Plugin Registry

### PluginRegistry Class

**Responsibilities**:
- Store all registered plugins
- Manage plugin manifests
- Calculate load order
- Validate dependencies

**Key Methods**:
```typescript
register(plugin: Plugin, manifest?: PluginManifest): Promise<void>
unregister(name: string): Promise<void>
get(name: string): Plugin | undefined
getAll(): Plugin[]
getLoadOrder(): string[]
getDependencies(pluginName: string): string[]
getDependents(pluginName: string): string[]
has(name: string): boolean
```

### Plugin Manifest

Optional `plugin.json` or `package.json` with `fluxstack` field:

```json
{
  "name": "fluxstack-plugin-auth",
  "version": "1.0.0",
  "description": "Authentication plugin",
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "jsonwebtoken": "^9.0.0"
  },
  "fluxstack": {
    "version": "1.19.0",
    "hooks": ["setup", "onRequest", "onBeforeRoute"],
    "category": "security",
    "tags": ["auth", "jwt"]
  }
}
```

## Plugin Manager

### PluginManager Class

**Responsibilities**:
- Initialize plugin system
- Execute plugin hooks
- Manage plugin contexts
- Track plugin metrics
- Handle hook errors

**Key Methods**:
```typescript
initialize(): Promise<void>
shutdown(): Promise<void>
registerPlugin(plugin: Plugin): Promise<void>
unregisterPlugin(name: string): void
executeHook(hook: PluginHook, context?: any, options?: HookExecutionOptions): Promise<PluginHookResult[]>
executePluginHook(plugin: Plugin, hook: PluginHook, context?: any): Promise<PluginHookResult>
getPluginMetrics(pluginName?: string): PluginMetrics | Map<string, PluginMetrics>
```

### Hook Execution

**Sequential Execution** (default):
```typescript
await pluginManager.executeHook('onRequest', requestContext)
// Plugins execute in load order, one at a time
```

**Parallel Execution**:
```typescript
await pluginManager.executeHook('onBuild', buildContext, { parallel: true })
// All plugins execute simultaneously
```

**Options**:
- `timeout`: Max execution time (default: 30s)
- `parallel`: Execute all plugins at once
- `stopOnError`: Stop if any plugin fails
- `retries`: Retry failed hooks (default: 0)

### Plugin Metrics

Tracked per plugin:
```typescript
{
  loadTime: number,              // Time to load plugin
  setupTime: number,             // Time to execute setup hook
  hookExecutions: Map<PluginHook, number>,  // Count per hook
  errors: number,                // Total errors
  warnings: number,              // Total warnings
  lastExecution?: Date           // Last hook execution time
}
```

## Plugin Context

Every hook receives appropriate context:

### PluginContext (Lifecycle Hooks)
```typescript
{
  config: FluxStackConfig,       // Full configuration
  logger: Logger,                // Plugin-specific logger
  app: Elysia,                   // Elysia app instance
  utils: PluginUtils,            // Utility functions
  registry: PluginRegistry       // Access other plugins
}
```

### RequestContext (Request Hooks)
```typescript
{
  request: Request,
  path: string,
  method: string,
  headers: Record<string, string>,
  query: Record<string, string>,
  params: Record<string, string>,
  body?: any,
  user?: any,
  startTime: number,
  handled?: boolean,             // Set to true to handle request
  response?: Response            // Set to return custom response
}
```

### ResponseContext (Response Hooks)
```typescript
{
  ...RequestContext,
  response: Response,
  statusCode: number,
  duration: number,
  size?: number
}
```

### ErrorContext (Error Hooks)
```typescript
{
  ...RequestContext,
  error: Error,
  duration: number,
  handled: boolean               // Set to true to handle error
}
```

## Plugin Utilities

Available in `context.utils`:

```typescript
{
  createTimer: (label: string) => { end: () => number },
  formatBytes: (bytes: number) => string,
  isProduction: () => boolean,
  isDevelopment: () => boolean,
  getEnvironment: () => string,
  createHash: (data: string) => string,
  deepMerge: (target: any, source: any) => any,
  validateSchema: (data: any, schema: any) => { valid: boolean; errors: string[] }
}
```

## Error Handling

### Hook Failures

- Caught and logged automatically
- Other plugins notified via `onPluginError` hook
- Framework continues execution (non-blocking)
- Metrics updated with error count

### Plugin Errors

```typescript
onPluginError: async (context) => {
  // context.pluginName - which plugin failed
  // context.error - the error that occurred
  // context.timestamp - when it happened
  
  // Log to monitoring service
  await monitoring.logPluginError(context)
}
```

## Dependency Management

Since all plugins are explicitly imported, their npm dependencies must be
installed in the project's `package.json` like any other dependency:

```bash
# Install a plugin and its dependencies
bun add @fluxstack/plugin-csrf-protection
```

Plugin *inter-dependencies* (one plugin depending on another plugin) are
declared via the `dependencies` array in the plugin object and resolved
automatically by the registry at startup.

## Plugin Validation

### Structure Validation

Required:
- `name` property (string)

Optional but validated:
- `version` (string)
- `dependencies` (array of strings)
- `priority` (number)

### Configuration Validation

If plugin has `configSchema`, validates config against schema:
```typescript
{
  configSchema: {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
      timeout: { type: 'number' }
    },
    required: ['apiKey']
  }
}
```

## Creating a Plugin

### Minimal Example

```typescript
// plugins/my-logger/index.ts
import type { Plugin } from '@fluxstack/plugin-kit'

export const myLoggerPlugin: Plugin = {
  name: 'my-logger',
  version: '1.0.0',

  setup: async (context) => {
    context.logger.info('My logger plugin initialized')
  },

  onRequest: async (context) => {
    console.log(`${context.method} ${context.path}`)
  },

  onServerStop: async () => {
    console.log('Flushing logs...')
  }
}
```

### Registering It

```typescript
// app/server/index.ts
import { myLoggerPlugin } from '../../plugins/my-logger'

const framework = new FluxStackFramework()
  .use(myLoggerPlugin)
  // ... other plugins
```

### Publishing as NPM Package

1. Create a package that exports a `Plugin` object
2. Depend on `@fluxstack/plugin-kit` for types
3. Consumers install the package and `.use()` it explicitly

```bash
bun add my-fluxstack-plugin
```

```typescript
import { myPlugin } from 'my-fluxstack-plugin'
framework.use(myPlugin)
```

## Best Practices

1. **Register explicitly**: Always import and `.use()` every plugin
2. **Declare inter-dependencies**: List plugin dependencies in the `dependencies` array
3. **Use Priority**: Set priority for load order control
4. **Handle Errors**: Implement error hooks for resilience
5. **Cleanup Resources**: Use `onServerStop` for cleanup
6. **Avoid Blocking**: Keep hooks fast, use async for I/O
7. **Log Appropriately**: Use `context.logger` for plugin logs
8. **Validate Input**: Check context data before use
9. **Test Isolation**: Ensure plugin works independently
10. **Use `@fluxstack/plugin-kit`**: Import types from the canonical package

## Related

- [Framework Lifecycle](./framework-lifecycle.md) - How plugins integrate
- [Plugin Hooks Reference](../reference/plugin-hooks.md) - Complete hook list
- [External Plugins](../resources/plugins-external.md) - Creating plugins
- [CLI Commands](../reference/cli-commands.md) - Plugin management commands
