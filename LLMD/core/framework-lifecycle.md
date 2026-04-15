# Framework Lifecycle

**Version:** 1.19.0 | **Updated:** 2026-04-14

## Quick Facts

- Framework class: `FluxStackFramework` in `core/framework/server.ts`
- Initialization: Constructor → Manual Plugin Registration (.use()) → Setup Hooks → Server Start
- Request flow: 13 hook points from request to response
- Shutdown: Graceful with reverse-order plugin cleanup
- Plugin loading: Explicit registration via `.use()` with dependency-based topological sort

## Initialization Sequence

```mermaid
sequenceDiagram
    participant App as Application
    participant FW as FluxStackFramework
    participant PR as PluginRegistry
    participant Plugins as Plugins

    App->>FW: new FluxStackFramework()
    FW->>FW: Create Elysia app
    FW->>PR: new PluginRegistry()
    FW->>FW: setupCors()
    FW->>FW: setupHeadHandler()
    FW->>FW: setupHooks()
    FW->>FW: setupErrorHandling()

    App->>FW: .use(swaggerPlugin)
    App->>FW: .use(liveComponentsPlugin)
    App->>FW: .use(csrfProtectionPlugin)
    App->>FW: .use(vitePlugin) (if full-stack mode)
    loop For each registered plugin
        FW->>PR: register(plugin)
        PR->>PR: updateLoadOrder()
    end
    loop For each plugin
        FW->>Plugins: onConfigLoad(context)
    end
    
    App->>FW: listen()
    FW->>PR: validateDependencies()
    loop For each plugin (load order)
        FW->>Plugins: setup(context)
    end
    loop For each plugin (load order)
        FW->>Plugins: onBeforeServerStart(context)
    end
    loop For each plugin (load order)
        FW->>Plugins: Mount plugin routes
    end
    loop For each plugin (load order)
        FW->>Plugins: onServerStart(context)
    end
    loop For each plugin (load order)
        FW->>Plugins: onAfterServerStart(context)
    end
    
    FW->>FW: Display startup banner
```

## Plugin Registration

All plugins are registered manually via `.use()` in `app/server/index.ts`. Auto-discovery was removed in `@fluxstack/plugin-kit@0.4.0` because it broke silently in production bundles (`dist/node_modules/` does not exist). Every plugin the app wants to enable must be explicitly imported and `.use()`-d.

**Current registration in `app/server/index.ts`:**

```typescript
import { FluxStackFramework } from "@core/server"
import { vitePlugin } from "@core/plugins/built-in/vite"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { liveComponentsPlugin } from "@core/server/live"
import { csrfProtectionPlugin } from "@fluxstack/plugin-csrf-protection"

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)
  .use(csrfProtectionPlugin)

// Vite only in full-stack mode
if (appConfig.mode !== 'backend-only') {
  framework.use(vitePlugin)
}

framework.routes(appInstance)
await framework.listen()
```

**Plugin loading phases:**

1. **Registration Phase** (during `.use()` calls):
   - Validate plugin structure
   - Store in registry
   - Build dependency graph
   - Calculate load order (topological sort)

2. **Configuration Phase** (after registration):
   - Execute `onConfigLoad` hooks in load order
   - Plugins can modify configuration

3. **Setup Phase** (during `listen()`):
   - Validate all dependencies exist
   - Execute `setup` hooks in load order
   - Execute `onBeforeServerStart` hooks
   - Mount plugin routes (if plugin has Elysia plugin)
   - Execute `onServerStart` hooks
   - Execute `onAfterServerStart` hooks

## Hook Execution Order

### Lifecycle Hooks

```
onConfigLoad → setup → onBeforeServerStart → onServerStart → onAfterServerStart
```

- **onConfigLoad**: Modify configuration before framework starts
- **setup**: Initialize plugin resources (databases, connections)
- **onBeforeServerStart**: Register routes, middleware
- **onServerStart**: Start background tasks
- **onAfterServerStart**: Post-startup tasks (logging, metrics)

### Request/Response Pipeline

```mermaid
graph TD
    A[Incoming Request] --> B[onRequest]
    B --> C[onRequestValidation]
    C --> D{Validation Failed?}
    D -->|Yes| E[Return 400 Error]
    D -->|No| F[onBeforeRoute]
    F --> G{Plugin Handled?}
    G -->|Yes| H[Return Plugin Response]
    G -->|No| I[Route Handler]
    I --> J[onAfterRoute]
    J --> K[onBeforeResponse]
    K --> L[onResponseTransform]
    L --> M[Log Request]
    M --> N[onResponse]
    N --> O[Return Response]
```

**Hook Execution Order:**

1. **onRequest**: Log request, authenticate, add context
2. **onRequestValidation**: Custom validation logic
3. **onBeforeRoute**: Handle request before routing (auth, caching)
4. **[Route Handler Executes]**
5. **onAfterRoute**: Access route params, log matched route
6. **onBeforeResponse**: Modify headers, status code
7. **onResponseTransform**: Transform response body
8. **[Automatic Request Logging]**
9. **onResponse**: Final logging, metrics collection

### Error Handling Flow

```
Error Occurs → onError (each plugin) → Plugin Handled? → Return Response or Default Error
```

- Plugins can handle errors by setting `context.handled = true`
- Vite plugin uses this for SPA fallback
- FluxStackError instances use custom status codes
- Unhandled errors return 500 with message (dev) or generic (prod)

## Request Lifecycle Details

### CORS Setup

Applied via `onRequest` hook:
- Sets `Access-Control-Allow-Origin`
- Sets `Access-Control-Allow-Methods`
- Sets `Access-Control-Allow-Headers`
- Handles OPTIONS preflight requests

### HEAD Request Handling

Global HEAD handler prevents Elysia bug:
- Returns empty body with appropriate headers
- API routes: `Content-Type: application/json`
- Static files: `Content-Type: text/html` or appropriate type

### Request Timing

- Start time stored in `onRequest`
- Duration calculated in `onAfterHandle`
- Timing key stored in response headers
- Cleanup after response sent

## Shutdown Sequence

```mermaid
sequenceDiagram
    participant Signal as SIGTERM/SIGINT
    participant FW as FluxStackFramework
    participant Plugins as Plugins

    Signal->>FW: Shutdown signal
    FW->>FW: stop()
    loop For each plugin (reverse order)
        FW->>Plugins: onBeforeServerStop(context)
    end
    loop For each plugin (reverse order)
        FW->>Plugins: onServerStop(context)
    end
    FW->>FW: Set isStarted = false
    FW->>Signal: process.exit(0)
```

**Shutdown Hooks:**

1. **onBeforeServerStop**: Prepare for shutdown (stop accepting requests)
2. **onServerStop**: Cleanup resources (close connections, save state)

**Reverse Order**: Plugins shut down in reverse of load order to respect dependencies

## Plugin Context

Every plugin receives a `PluginContext` object:

```typescript
{
  config: FluxStackConfig,      // Full framework configuration
  logger: Logger,                // Plugin-specific logger
  app: Elysia,                   // Elysia app instance
  utils: PluginUtils,            // Utility functions
  registry: PluginRegistry       // Access to other plugins
}
```

## Error Recovery

- Plugin hook failures are caught and logged
- `onPluginError` hook notified on all other plugins
- Framework continues execution (non-blocking)
- Build hooks can stop build on error

## Performance Considerations

- Hooks execute sequentially (predictable order)
- Request timing tracked with minimal overhead
- Automatic cleanup of timing data

## Related

- [Plugin System](./plugin-system.md) - Plugin architecture details
- [Plugin Hooks Reference](../reference/plugin-hooks.md) - Complete hook list
- [Build System](./build-system.md) - Build lifecycle
