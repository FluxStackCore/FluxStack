# FluxStack

Full-stack TypeScript framework built on Bun, Elysia.js, and React with end-to-end type safety via Eden Treaty.

[![npm version](https://badge.fury.io/js/create-fluxstack.svg)](https://www.npmjs.com/package/create-fluxstack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Quick Start

```bash
bunx create-fluxstack my-app
cd my-app
bun run dev
```

This starts the full-stack dev server:

| Service          | URL                          |
| ---------------- | ---------------------------- |
| Backend API      | http://localhost:3000        |
| Frontend (Vite)  | http://localhost:5173        |
| Swagger Docs     | http://localhost:3000/swagger |
| Health Check     | http://localhost:3000/api/health |

### Alternative: scaffold in current directory

```bash
mkdir my-app && cd my-app
bunx create-fluxstack .
bun run dev
```

## Tech Stack

| Component    | Technology            | Version |
| ------------ | --------------------- | ------- |
| Runtime      | [Bun](https://bun.sh) | >= 1.2  |
| Backend      | [Elysia.js](https://elysiajs.com) | 1.4     |
| Frontend     | [React](https://react.dev) | 19      |
| Build        | [Vite](https://vite.dev) | 7       |
| Styling      | [Tailwind CSS](https://tailwindcss.com) | 4       |
| Language      | [TypeScript](https://www.typescriptlang.org) | 5.8     |
| API Client   | [Eden Treaty](https://elysiajs.com/eden/overview) | 1.3     |
| Testing      | [Vitest](https://vitest.dev) | 3       |

## Project Structure

```
FluxStack/
├── core/                  # Framework internals (read-only)
│   ├── framework/         # Server/client orchestration
│   ├── server/            # Elysia plugins, middleware, live components
│   ├── client/            # Vite integration
│   ├── cli/               # CLI commands & generators
│   ├── plugins/           # Built-in plugin system
│   ├── types/             # Framework type definitions
│   └── utils/             # Logger, config schema, errors
│
├── app/                   # Application code
│   ├── server/            # Backend
│   │   ├── controllers/   # Business logic
│   │   ├── routes/        # API endpoints
│   │   ├── live/          # Live Components (WebSocket)
│   │   └── app.ts         # Elysia app instance (Eden Treaty export)
│   ├── client/            # Frontend (React + Vite)
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── live/      # Client-side Live Components
│   │       └── lib/       # Eden Treaty client
│   └── shared/            # Shared type definitions
│
├── config/                # Declarative configuration
│   ├── system/            # Config files (app, server, db, logger, etc.)
│   ├── fluxstack.config.ts
│   └── index.ts
│
├── plugins/               # Project plugins (auto-discovered)
├── tests/                 # Test suite (unit + integration)
├── LLMD/                  # LLM-optimized documentation
├── Dockerfile             # Multi-stage production build
└── package.json
```

## Features

### End-to-End Type Safety

Eden Treaty infers types from Elysia route definitions automatically. No manual DTOs.

**Define a route on the backend:**

```typescript
// app/server/routes/users.routes.ts
import { Elysia, t } from 'elysia'

export const userRoutes = new Elysia({ prefix: '/users' })
  .post('/', ({ body }) => createUser(body), {
    body: t.Object({
      name: t.String(),
      email: t.String({ format: 'email' })
    }),
    response: t.Object({
      success: t.Boolean(),
      user: t.Optional(t.Object({
        id: t.Number(),
        name: t.String(),
        email: t.String()
      }))
    })
  })
```

**Use it on the frontend with full type inference:**

```typescript
// app/client/src/lib/eden-api.ts
import { api } from './eden-api'

const { data, error } = await api.users.post({
  name: 'Ada Lovelace',       // string
  email: 'ada@example.com'    // string (email)
})

if (data?.user) {
  console.log(data.user.name) // string - fully typed
}
```

### Live Components

Real-time WebSocket components with automatic state synchronization between server and client.

```typescript
// app/server/live/LiveCounter.ts
export class LiveCounter extends LiveComponent<{ count: number }> {
  static defaultState = { count: 0 }

  async increment() {
    this.state.count++ // auto-syncs to frontend via Proxy
    return { success: true }
  }
}
```

### Room System

Multi-room real-time communication for Live Components.

```typescript
// Join a room and listen for events
this.$room('chat-room').join()
this.$room('chat-room').on('message:new', (msg) => {
  this.setState({ messages: [...this.state.messages, msg] })
})

// Emit to all other users in the room
this.$room('chat-room').emit('message:new', message)
```

Rooms are also accessible via HTTP for external integrations:

```bash
# Send a message to a room
curl -X POST http://localhost:3000/api/rooms/general/messages \
  -H "Content-Type: application/json" \
  -d '{"user": "Bot", "text": "Hello from API!"}'
```

### Declarative Configuration

Laravel-inspired config system with schema validation and type inference.

```typescript
// config/system/app.config.ts
import { defineConfig, config } from '@/core/utils/config-schema'

const appConfigSchema = {
  name: config.string('APP_NAME', 'FluxStack', true),
  port: config.number('PORT', 3000, true),
  env: config.enum('NODE_ENV', ['development', 'production', 'test'] as const, 'development', true),
  debug: config.boolean('DEBUG', false),
} as const

export const appConfig = defineConfig(appConfigSchema)
```

All environment variables are validated at boot time. See [`.env.example`](.env.example) for available options.

### Plugin System

Three-layer plugin architecture with security-first design:

| Layer          | Location          | Auto-discovered | Trusted by default |
| -------------- | ----------------- | --------------- | ------------------ |
| Built-in       | `core/plugins/`   | No (manual)     | Yes                |
| Project        | `plugins/`        | Yes             | Yes                |
| NPM            | `node_modules/`   | No (opt-in)     | No (whitelist)     |

NPM plugins are blocked by default. To add one:

```bash
bun run cli plugin:add fluxstack-plugin-auth
```

This audits the package, installs it, and adds it to the whitelist.

## Scripts

```bash
# Development
bun run dev               # Full-stack with hot reload
bun run dev:frontend      # Frontend only (port 5173)
bun run dev:backend       # Backend only (port 3001)

# Build & Production
bun run build             # Production build
bun run start             # Start production server

# Testing & Quality
bun run test              # Run tests (Vitest)
bun run test:ui           # Vitest with browser UI
bun run test:coverage     # Coverage report
bun run typecheck:api     # Strict TypeScript check

# CLI & Generation
bun run cli               # CLI interface
bun run make:component    # Generate a Live Component
bun run sync-version      # Sync version across files
```

## Frontend Routes

Default routes included in the demo app (React Router v7):

| Route         | Page              |
| ------------- | ----------------- |
| `/`           | Home              |
| `/counter`    | Live Counter      |
| `/form`       | Live Form         |
| `/upload`     | Live Upload       |
| `/api-test`   | Eden Treaty Demo  |

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

Key variables:

| Variable           | Default          | Description              |
| ------------------ | ---------------- | ------------------------ |
| `PORT`             | `3000`           | Backend server port      |
| `HOST`             | `localhost`      | Server host              |
| `FRONTEND_PORT`    | `5173`           | Vite dev server port     |
| `NODE_ENV`         | `development`    | Environment              |
| `LOG_LEVEL`        | `info`           | Logging level            |
| `CORS_ORIGINS`     | `localhost:3000,localhost:5173` | Allowed CORS origins |
| `SWAGGER_ENABLED`  | `true`           | Enable Swagger UI        |
| `SWAGGER_PATH`     | `/swagger`       | Swagger UI path          |

See [`.env.example`](.env.example) for the full list.

## Docker

```bash
# Build
docker build -t fluxstack-app .

# Run
docker run -p 3000:3000 fluxstack-app
```

The Dockerfile uses a multi-stage build (dependencies -> build -> production) with `oven/bun:1.2-alpine` and runs as a non-root user.

## Requirements

- **Bun >= 1.2.0** (required runtime)

Install Bun:

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

> FluxStack requires Bun. Node.js is not supported as a runtime.

## Documentation

- [`LLMD/INDEX.md`](./LLMD/INDEX.md) - Documentation hub
- [`LLMD/core/`](./LLMD/core/) - Framework internals
- [`LLMD/resources/`](./LLMD/resources/) - Routes, controllers, plugins, Live Components
- [`LLMD/patterns/`](./LLMD/patterns/) - Best practices and anti-patterns
- [`LLMD/reference/`](./LLMD/reference/) - CLI commands, plugin hooks, troubleshooting

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please open an [issue](https://github.com/MarcosBrendonDePaula/FluxStack/issues) first to discuss larger changes.

## License

[MIT](LICENSE) - Marcos Brendon De Paula
