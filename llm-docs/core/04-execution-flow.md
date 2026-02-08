# 04 - Execution Flow

## Server Startup

```
1. Load .env variables
2. Load config files (config/*.config.ts)
3. Initialize FluxStackFramework
4. Discover plugins (plugins/ directory)
5. Register plugins in registry
6. Resolve dependencies & calculate load order
7. Execute plugin setup hooks (in order)
8. Execute onBeforeServerStart hooks
9. Mount plugin routes
10. Execute onServerStart hooks
11. Start Elysia server (listen on port)
12. Execute onAfterServerStart hooks
13. Display startup banner
```

## Request Lifecycle

```
1. Request arrives at server
   ↓
2. CORS middleware (set headers)
   ↓
3. onRequest hooks (all plugins, in order)
   - Logging, auth, tracking
   ↓
4. onRequestValidation hooks
   - Custom validation logic
   - Can add errors to context
   ↓
5. onBeforeRoute hooks
   - Can intercept request (set ctx.handled = true)
   - Return early if intercepted
   ↓
6. Route matching (Elysia router)
   - Find matching route
   - Extract params
   ↓
7. Schema validation (Elysia)
   - Validate body, query, params
   - Return 400 if invalid
   ↓
8. Handler execution
   - Controller/handler function runs
   - Returns response data
   ↓
9. onAfterRoute hooks
   - Route was matched, params available
   ↓
10. onBeforeResponse hooks
    - Can modify headers, cookies
    ↓
11. onResponseTransform hooks
    - Can transform response body
    - Set ctx.transformed = true if modified
    ↓
12. onResponse hooks (all plugins, in order)
    - Logging, metrics, analytics
    ↓
13. Response sent to client
```

## Error Handling

```
1. Error occurs (validation, handler, etc.)
   ↓
2. onError hooks (all plugins, in order)
   - Can intercept error (set ctx.handled = true)
   - Return custom response
   ↓
3. If not handled:
   - FluxStackError → Use statusCode & message
   - Elysia errors (VALIDATION, NOT_FOUND) → Pass through
   - Other errors → 500 Internal Server Error
   ↓
4. Log error (if unexpected)
   ↓
5. Return error response
```

## Server Shutdown

```
1. Receive SIGTERM or SIGINT signal
   ↓
2. Execute onBeforeServerStop hooks (reverse order)
   - Prepare for shutdown
   ↓
3. Execute onServerStop hooks (reverse order)
   - Close connections
   - Cleanup resources
   ↓
4. Close Elysia server
   ↓
5. Exit process (code 0)
```

## Plugin Hook Execution Order

Plugins execute in **load order** (based on dependencies and priority):

```
Priority levels (highest to lowest):
1. 'highest' or number > 1000
2. 'high' or number 500-1000
3. 'normal' or number 0-499 (default)
4. 'low' or number -500 to -1
5. 'lowest' or number < -500
```

**Example**:
```typescript
// Plugin A (priority: 'highest') executes first
export const pluginA: FluxStack.Plugin = {
  name: 'auth',
  priority: 'highest',
  onRequest: async (ctx) => { /* runs 1st */ }
}

// Plugin B (priority: 'normal') executes second
export const pluginB: FluxStack.Plugin = {
  name: 'logger',
  priority: 'normal',
  onRequest: async (ctx) => { /* runs 2nd */ }
}

// Plugin C (priority: 'lowest') executes last
export const pluginC: FluxStack.Plugin = {
  name: 'metrics',
  priority: 'lowest',
  onRequest: async (ctx) => { /* runs 3rd */ }
}
```

## Request Context Flow

Context object passed through hooks:

```typescript
// Initial context (onRequest)
{
  request: Request,
  path: '/api/users',
  method: 'GET',
  headers: { ... },
  query: { ... },
  params: {},
  body: undefined,
  startTime: 1234567890,
  handled: false,
  response: undefined
}

// After auth plugin (onBeforeRoute)
{
  ...previous,
  user: { id: 1, name: 'User' } // Added by auth plugin
}

// After handler (onResponse)
{
  ...previous,
  response: Response,
  statusCode: 200,
  duration: 45 // ms
}
```

## Build Flow

```
1. Run prebuild script (scripts/prebuild.ts)
   - Generate types, manifests
   ↓
2. Execute onBeforeBuild hooks
   - Prepare assets, clean dirs
   ↓
3. Build frontend (Vite)
   - Bundle React app
   - Output to dist/public/
   ↓
4. Execute onBuildAsset hooks (for each asset)
   - Optimize images, minify CSS/JS
   ↓
5. Build backend (Bun)
   - Bundle server code
   - Output to dist/
   ↓
6. Execute onBuild hooks
   - Custom build steps
   ↓
7. Execute onBuildComplete hooks
   - Generate reports, upload to CDN
   ↓
8. Build complete
```

## Hot Reload Flow (Development)

```
1. File change detected
   ↓
2. If frontend file:
   - Vite HMR updates browser
   - No server restart
   ↓
3. If backend file:
   - Bun restarts server
   - Plugins re-initialized
   - Frontend stays connected
```

## WebSocket Flow (Live Components)

```
1. Client connects to WebSocket
   ↓
2. Send component:mount message
   ↓
3. Server creates component instance
   - Initialize state
   - Store in registry
   ↓
4. Send component:state message to client
   ↓
5. Client renders component with state
   ↓
6. User triggers action
   ↓
7. Client sends component:action message
   ↓
8. Server executes handler
   - Update state
   ↓
9. Server broadcasts component:state to all clients
   ↓
10. All clients update UI
```

## Timing Breakdown (Typical Request)

```
Total: 45ms
├─ CORS: 0.1ms
├─ onRequest hooks: 2ms
├─ Validation: 1ms
├─ onBeforeRoute hooks: 5ms (auth check)
├─ Route matching: 0.5ms
├─ Handler execution: 30ms (DB query)
├─ onResponse hooks: 6ms (logging, metrics)
└─ Response send: 0.4ms
```

## Next Steps

- **Eden Treaty**: [Eden Treaty](../features/01-eden-treaty.md)
