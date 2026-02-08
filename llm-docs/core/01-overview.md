# 01 - Overview

## Architecture

```
Frontend (React + Vite)
    ↓ Eden Treaty (Type-Safe)
Backend (Elysia + Bun)
    ↓
Core Framework (Plugins, Config, Build)
```

## Directory Structure

```
FluxStack/
├── core/           # ❌ READ-ONLY framework
│   ├── framework/  # Main orchestrator
│   ├── plugins/    # Plugin system
│   ├── build/      # Build pipeline
│   └── utils/      # Logger, errors
│
├── app/            # ✅ YOUR CODE
│   ├── server/     # Backend (controllers, routes, services)
│   ├── client/     # Frontend (React components)
│   └── shared/     # Shared types
│
├── config/         # ✅ Declarative configs
└── plugins/        # ✅ External plugins
```

## Core Concepts

### 1. Core vs App Separation

**Core** (`core/`): Framework base - DO NOT MODIFY
**App** (`app/`): Your application code - MODIFY FREELY

### 2. Declarative Configuration

Configs in `config/*.config.ts` using `defineConfig()`:

```typescript
// config/app.config.ts
import { defineConfig, config } from "@/core/utils/config-schema";

export const appConfig = defineConfig({
  name: config.string("APP_NAME", "FluxStack"),
  debug: config.boolean("APP_DEBUG", false),
});
```

Benefits: Type safety, validation, defaults, inline docs

### 3. Plugin System

Extend FluxStack via lifecycle hooks:

```typescript
export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  setup: async (ctx) => {},
  onRequest: async (ctx) => {},
  onResponse: async (ctx) => {},
};
```

**Built-in plugins**: vite, swagger, static, live-components, monitoring

### 4. Eden Treaty (Type-Safe API)

Auto type-inference from backend to frontend:

**Backend**:

```typescript
export const userRoutes = new Elysia({ prefix: "/users" }).get(
  "/",
  () => ({ users: getAllUsers() }),
  {
    response: t.Object({
      users: t.Array(t.Object({ id: t.Number(), name: t.String() })),
    }),
  },
);
```

**Frontend**:

```typescript
const { data } = await api.users.get();
data.users.forEach((u) => console.log(u.id)); // ✅ Typed as number
```

No manual DTOs!

### 5. Live Components (WebSocket)

Class-based reactive components with Proxy API (Livewire-style):

**Backend**:

```typescript
export class LiveCounter extends LiveComponent<typeof defaultState> {
  async increment() {
    this.setState({ count: this.state.count + 1 });
    return { success: true };
  }
}
```

**Frontend** (Proxy-based access):

```typescript
const counter = useLiveComponent("LiveCounter", { count: 0 });

// Read state directly
console.log(counter.count);

// Write state (auto-syncs)
counter.count = 10;

// Call actions directly
await counter.increment();
```

## Lifecycle

### Startup

1. Load env vars (.env)
2. Load configs (config/\*.config.ts)
3. Initialize framework
4. Discover & register plugins
5. Execute plugin setup hooks
6. Mount plugin routes
7. Start server
8. Display banner

### Request

1. CORS headers
2. onRequest hooks
3. onRequestValidation hooks
4. onBeforeRoute hooks
5. Route matching
6. Schema validation
7. Handler execution
8. onResponse hooks
9. Response sent

### Shutdown

1. Receive SIGTERM/SIGINT
2. onBeforeServerStop hooks (reverse order)
3. onServerStop hooks (reverse order)
4. Close server

## Design Principles

1. **Convention over Configuration**: Sensible defaults
2. **Type Safety First**: Everything is typed
3. **Plugin-Based**: Easy to extend/disable/test
4. **Developer Experience**: Hot reload, colored logs, auto Swagger, CLI generators

## Stack

| Layer      | Tech        | Version  | Purpose              |
| ---------- | ----------- | -------- | -------------------- |
| Runtime    | Bun         | 1.2+     | Ultra-fast execution |
| Backend    | Elysia      | 1.4+     | API framework        |
| Frontend   | React       | 19+      | UI library           |
| Build      | Vite        | 7+       | Bundler + HMR        |
| Types      | TypeScript  | 5.8+     | Type safety          |
| API Client | Eden Treaty | 1.3+     | Type-safe HTTP       |
| Testing    | Vitest      | Latest   | Test framework       |
| WebSocket  | Bun WS      | Built-in | Native WebSocket     |

## vs Other Frameworks

| Feature     | FluxStack          | Next.js    | T3 Stack |
| ----------- | ------------------ | ---------- | -------- |
| Runtime     | Bun (3x faster)    | Node.js    | Node.js  |
| Backend     | Elysia             | API Routes | tRPC     |
| Type Safety | Eden Treaty (auto) | Manual     | tRPC     |
| Config      | Declarative        | Manual     | Manual   |
| API Docs    | Auto Swagger       | Manual     | Manual   |

## Next Steps

- **Configuration**: [02-config-system.md](02-config-system.md)
- **Plugins**: [03-plugin-system.md](03-plugin-system.md)
- **Execution Flow**: [04-execution-flow.md](04-execution-flow.md)
