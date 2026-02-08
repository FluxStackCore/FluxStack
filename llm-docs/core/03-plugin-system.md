# 03 - Plugin System

## Overview

Plugins extend FluxStack via lifecycle hooks. They can:

- Intercept requests/responses
- Modify build process
- Add routes/middlewares
- React to server events
- Integrate external services

## How It Works

### Plugin Discovery

1. **Auto-discovery**: Scans `plugins/` directory for plugin folders
2. **Built-in plugins**: Loaded from `core/plugins/built-in/`
3. **Manual registration**: Via `app.use(plugin)`

```typescript
// Auto-discovered from plugins/my-plugin/index.ts
// Must have: export default myPlugin

// Or manually registered
import { myPlugin } from './plugins/my-plugin'
app.use(myPlugin)
```

### Plugin Registry

Manages plugin lifecycle:

```
1. Discovery → Find all plugins
2. Registration → Add to registry
3. Dependency Resolution → Calculate load order
4. Initialization → Execute setup hooks
5. Execution → Run hooks during app lifecycle
```

### Load Order

Plugins execute in order based on:

1. **Dependencies**: Plugins with dependencies load after their deps
2. **Priority**: `highest` → `high` → `normal` → `low` → `lowest`
3. **Registration order**: If same priority, first registered runs first

```typescript
// Plugin A (no deps, highest priority) → Loads 1st
export const authPlugin: FluxStack.Plugin = {
  name: 'auth',
  priority: 'highest'
}

// Plugin B (depends on auth, normal priority) → Loads 2nd
export const adminPlugin: FluxStack.Plugin = {
  name: 'admin',
  dependencies: ['auth'],
  priority: 'normal'
}

// Plugin C (no deps, lowest priority) → Loads 3rd
export const metricsPlugin: FluxStack.Plugin = {
  name: 'metrics',
  priority: 'lowest'
}
```

### Hook Execution

Hooks execute in **load order** for each request:

```
Request arrives
  ↓
onRequest (auth) → onRequest (admin) → onRequest (metrics)
  ↓
onBeforeRoute (auth) → onBeforeRoute (admin) → onBeforeRoute (metrics)
  ↓
Route handler executes
  ↓
onResponse (auth) → onResponse (admin) → onResponse (metrics)
  ↓
Response sent
```

### Plugin Context

Each hook receives a context object:

```typescript
interface PluginContext {
  config: FluxStackConfig    // Full app config
  logger: Logger             // Structured logger
  app: Elysia               // Elysia app instance
  utils: PluginUtils        // Helper functions
}
```

**Available in context**:
- `ctx.config.server.port` - Access any config
- `ctx.logger.info()` - Log messages
- `ctx.app.use()` - Add routes/middlewares
- `ctx.utils.createTimer()` - Performance helpers

## Plugin Structure

```typescript
import type { FluxStack, PluginContext } from "@/core/plugins";

export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  description: "My plugin",
  dependencies: ["other-plugin"], // Optional
  priority: "normal", // Optional: highest|high|normal|low|lowest|number

  setup: async (ctx: PluginContext) => {},
  onServerStart: async (ctx: PluginContext) => {},
  onRequest: async (ctx: RequestContext) => {},
  onResponse: async (ctx: ResponseContext) => {},
};

export default myPlugin;
```

### Directory Structure

```
plugins/my-plugin/
├── index.ts        # Main plugin
├── package.json    # Metadata (with dependencies)
├── node_modules/   # Isolated dependencies
├── config/         # Config (optional)
├── routes/         # Routes (optional)
└── middlewares/    # Middlewares (optional)
```

**Important**: Each plugin has its own `node_modules/` folder. Dependencies are isolated per plugin, preventing version conflicts.

```bash
# Install plugin dependencies
cd plugins/my-plugin
bun install

# Plugin dependencies don't affect main app
```

## Available Hooks

### Lifecycle

**setup**: One-time initialization

```typescript
setup: async (ctx) => {
  ctx.logger.info("Plugin initialized");
  // Setup resources, register middlewares
};
```

**onServerStart**: When server starts

```typescript
onServerStart: async (ctx) => {
  // Start workers, connect to DB
};
```

**onServerStop**: When server stops

```typescript
onServerStop: async (ctx) => {
  // Close connections, cleanup
};
```

### Request/Response

**onRequest**: Start of every request

```typescript
onRequest: async (ctx) => {
  const { request, path, method, headers } = ctx;
  // Logging, auth, rate limiting
};
```

**onBeforeRoute**: Before routing (can intercept)

```typescript
onBeforeRoute: async (ctx) => {
  if (shouldIntercept(ctx.path)) {
    ctx.handled = true;
    ctx.response = new Response("Intercepted", { status: 200 });
  }
};
```

**onResponse**: After response sent

```typescript
onResponse: async (ctx) => {
  const { method, path, statusCode, duration } = ctx;
  // Logging, metrics, analytics
};
```

### Error

**onError**: When error occurs

```typescript
onError: async (ctx) => {
  const { error, path, method } = ctx;
  // Error logging, tracking (Sentry)

  if (error.constructor.name === "NotFoundError") {
    ctx.handled = true; // Intercept error
  }
};
```

### Build

**onBuild**: During build

```typescript
onBuild: async (ctx) => {
  const { target, outDir, mode } = ctx;
  // Process files, generate assets
};
```

**onBuildComplete**: After build

```typescript
onBuildComplete: async (ctx) => {
  // Generate reports, upload to CDN
};
```

## Plugin Examples

### Logger Plugin

```typescript
export const loggerPlugin: FluxStack.Plugin = {
  name: "logger",

  onRequest: async (ctx) => {
    console.log(`→ ${ctx.method} ${ctx.path}`);
  },

  onResponse: async (ctx) => {
    console.log(
      `← ${ctx.method} ${ctx.path} - ${ctx.statusCode} (${ctx.duration}ms)`,
    );
  },
};
export default loggerPlugin;
```

### Auth Plugin

```typescript
export const authPlugin: FluxStack.Plugin = {
  name: "auth",

  onBeforeRoute: async (ctx) => {
    const publicPaths = ["/api/auth/login"];
    if (publicPaths.includes(ctx.path)) return;

    const token = ctx.headers["authorization"]?.replace("Bearer ", "");
    if (!token) {
      ctx.handled = true;
      ctx.response = new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    const user = await validateToken(token);
    if (!user) {
      ctx.handled = true;
      ctx.response = new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    ctx.user = user;
  },
};
export default authPlugin;
```

### Rate Limit Plugin

```typescript
const requests = new Map<string, number[]>();

export const rateLimitPlugin: FluxStack.Plugin = {
  name: "rate-limit",

  onRequest: async (ctx) => {
    const ip = ctx.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    const ipRequests = requests.get(ip) || [];
    const recentRequests = ipRequests.filter((time) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      ctx.handled = true;
      ctx.response = new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { "Retry-After": "60" } },
      );
      return;
    }

    recentRequests.push(now);
    requests.set(ip, recentRequests);
  },
};
export default rateLimitPlugin;
```

### Metrics Plugin

```typescript
const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  averageResponseTime: 0,
};

export const metricsPlugin: FluxStack.Plugin = {
  name: "metrics",

  setup: async (ctx) => {
    ctx.app.get("/metrics", () => metrics);
  },

  onResponse: async (ctx) => {
    metrics.totalRequests++;
    if (ctx.statusCode >= 400) metrics.totalErrors++;

    const count = metrics.totalRequests;
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (count - 1) + ctx.duration) / count;
  },
};
export default metricsPlugin;
```

## Plugin with Routes

```typescript
import { Elysia } from "elysia";

const adminRoutes = new Elysia({ prefix: "/admin" })
  .get("/users", () => ({ users: getAllUsers() }))
  .get("/stats", () => ({ stats: getSystemStats() }));

export const adminPlugin: FluxStack.Plugin = {
  name: "admin",

  setup: async (ctx) => {
    ctx.app.use(adminRoutes);
    ctx.logger.info("Admin routes mounted at /admin");
  },
};
export default adminPlugin;
```

## Plugin with Config

```typescript
// plugins/cache/config/index.ts
import { defineConfig, config } from "@/core/utils/config-schema";

export const cacheConfig = defineConfig({
  enabled: config.boolean("CACHE_ENABLED", true),
  ttl: config.number("CACHE_TTL", 3600),
  driver: config.string("CACHE_DRIVER", "memory"),
} as const);

// plugins/cache/index.ts
import { cacheConfig } from "./config";

const cache = new Map();

export const cachePlugin: FluxStack.Plugin = {
  name: "cache",

  setup: async (ctx) => {
    if (!cacheConfig.enabled) return;

    ctx.app.decorate("cache", {
      get: (key: string) => {
        const item = cache.get(key);
        if (!item || Date.now() > item.expires) return null;
        return item.value;
      },
      set: (key: string, value: any, ttl = cacheConfig.ttl) => {
        cache.set(key, { value, expires: Date.now() + ttl * 1000 });
      },
    });
  },
};
export default cachePlugin;
```

## Plugin Dependencies

### Isolated node_modules

Each plugin manages its own dependencies:

```json
// plugins/my-plugin/package.json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "axios": "^1.6.0",
    "lodash": "^4.17.21"
  }
}
```

**Benefits**:
- No version conflicts between plugins
- Plugins can use different versions of same library
- Main app dependencies stay clean
- Easy to distribute plugins

**Installation**:
```bash
# Each plugin installs its own deps
cd plugins/my-plugin
bun install

cd ../another-plugin
bun install
```

### Using Plugin Dependencies

```typescript
// plugins/my-plugin/index.ts
import axios from 'axios' // From plugin's node_modules
import _ from 'lodash'    // From plugin's node_modules

export const myPlugin: FluxStack.Plugin = {
  name: 'my-plugin',
  
  setup: async (ctx) => {
    // Use plugin dependencies
    const response = await axios.get('https://api.example.com')
    const data = _.groupBy(response.data, 'category')
    ctx.logger.info('Data loaded', { count: data.length })
  }
}
```

## Best Practices

### 1. Always Export Default

```typescript
// ✅ Correct
export const myPlugin: FluxStack.Plugin = { ... }
export default myPlugin

// ❌ Wrong
export const myPlugin: FluxStack.Plugin = { ... }
```

### 2. Use Context Logger

```typescript
// ✅ Correct
setup: async (ctx) => {
  ctx.logger.info("Plugin initialized");
};

// ❌ Avoid
setup: async (ctx) => {
  console.log("Plugin initialized");
};
```

### 3. Handle Errors

```typescript
onRequest: async (ctx) => {
  try {
    await doSomething();
  } catch (error) {
    ctx.logger.error("Error in plugin", { error });
  }
};
```

### 4. Respect Priorities

```typescript
// Execute first
export const authPlugin: FluxStack.Plugin = {
  name: "auth",
  priority: "highest",
  // ...
};

// Execute last
export const loggingPlugin: FluxStack.Plugin = {
  name: "logging",
  priority: "lowest",
  // ...
};
```

### 5. Declare Dependencies

```typescript
export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  dependencies: ["auth", "database"],
  // ...
};
```

## Troubleshooting

**Plugin not discovered**: Check folder structure, `export default`, `package.json` with `"main": "index.ts"`

**Hook not executed**: Check hook name (typo?), plugin registration, execution order

**Circular dependency**: Remove circular deps or refactor plugins

## Next Steps

- **Execution Flow**: [04-execution-flow.md](04-execution-flow.md)
