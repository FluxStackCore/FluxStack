# Live Components

**Version:** @fluxstack/live 0.7.2 | **Updated:** 2026-04-14

## Quick Facts

- Server-side state management with WebSocket sync
- **Direct state access** - `this.count++` auto-syncs via reactive proxy
- **Lifecycle hooks** - `onMount()`, `onDestroy()`, `onConnect()`, `onDisconnect()`, and more (all optional)
- **HMR persistence** - `static persistent` + `this.$persistent` survives hot reloads
- **Singleton components** - `static singleton = true` for shared server-side instances
- **Mandatory `publicActions`** - Only whitelisted methods are callable from client (secure by default)
- **Helpful error messages** - Forgotten `publicActions` entries show exactly what to fix
- **Custom ID generator** - `LiveServerOptions.generateId` replaces default ID generation
- Automatic state persistence and re-hydration (with anti-replay nonces)
- Room-based event system for multi-user sync (typed `LiveRoom` support)
- Type-safe client-server communication (`FluxStackWebSocket`)
- Built-in connection management and recovery
- **Client component links** - Ctrl+Click navigation via `import type`

## LiveComponent Class Structure

Server-side component extends `LiveComponent` from `@fluxstack/live` with **static defaultState**:

```typescript
// app/server/live/LiveLocalCounter.ts
import { LiveComponent } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { CounterDemo as _Client } from '@client/src/live/CounterDemo'

export class LiveLocalCounter extends LiveComponent<typeof LiveLocalCounter.defaultState> {
  static componentName = 'LiveLocalCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const  // REQUIRED
  static defaultState = {
    count: 0,
    clicks: 0
  }

  // Declarar propriedades do estado (TypeScript)
  declare count: number
  declare clicks: number

  // Direct state access - auto-syncs with frontend
  async increment() {
    this.count++
    this.clicks++
    return { success: true, count: this.count }
  }

  async decrement() {
    this.count--
    this.clicks++
    return { success: true, count: this.count }
  }

  async reset() {
    this.count = 0
    this.clicks++
    return { success: true, count: 0 }
  }
}
```

### Key Patterns

1. **Direct state access** - `this.count++` instead of `this.state.count++`
2. **`declare` keyword** - TypeScript hint for dynamic state properties
3. **Static `defaultState`** inside the class - no external export needed
4. **Reactive Proxy** - `this.state.count++` or `this.count++` triggers sync automatically
5. **No constructor needed** - Base class handles `defaultState` merge (constructor only needed for room event subscriptions)
6. **Mandatory `publicActions`** - Components without it deny ALL remote actions (secure by default)
7. **Client link** - `import type { Demo as _Client }` enables Ctrl+Click in IDE

### With Room Events (Advanced)

```typescript
// app/server/live/LiveCounter.ts
import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const
  static defaultState = {
    count: 0,
    lastUpdatedBy: null as string | null,
    connectedUsers: 0
  }
  protected roomType = 'counter'

  // Constructor needed for room event subscriptions
  constructor(
    initialState: Partial<typeof LiveCounter.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    this.onRoomEvent<{ count: number; userId: string }>('COUNT_CHANGED', (data) => {
      this.setState({ count: data.count, lastUpdatedBy: data.userId })
    })

    this.onRoomEvent<{ connectedUsers: number }>('USER_COUNT_CHANGED', (data) => {
      this.setState({ connectedUsers: data.connectedUsers })
    })

    this.notifyUserJoined()
  }

  private notifyUserJoined() {
    const newCount = this.state.connectedUsers + 1
    this.emitRoomEventWithState('USER_COUNT_CHANGED',
      { connectedUsers: newCount },
      { connectedUsers: newCount }
    )
  }

  async increment() {
    const newCount = this.state.count + 1
    this.emitRoomEventWithState('COUNT_CHANGED',
      { count: newCount, userId: this.userId || 'anonymous' },
      { count: newCount, lastUpdatedBy: this.userId || 'anonymous' }
    )
    return { success: true, count: newCount }
  }

  async decrement() {
    const newCount = this.state.count - 1
    this.emitRoomEventWithState('COUNT_CHANGED',
      { count: newCount, userId: this.userId || 'anonymous' },
      { count: newCount, lastUpdatedBy: this.userId || 'anonymous' }
    )
    return { success: true, count: newCount }
  }

  async reset() {
    this.emitRoomEventWithState('COUNT_CHANGED',
      { count: 0, userId: this.userId || 'anonymous' },
      { count: 0, lastUpdatedBy: this.userId || 'anonymous' }
    )
    return { success: true, count: 0 }
  }

  destroy() {
    const newCount = Math.max(0, this.state.connectedUsers - 1)
    this.emitRoomEvent('USER_COUNT_CHANGED', { connectedUsers: newCount })
    super.destroy()
  }
}
```

## Lifecycle Hooks

The `@fluxstack/live` framework provides a full lifecycle hook system. All hooks are **optional** -- override only what you need. The example components in `app/server/live/` do not use all of them, but they are all available in the framework API.

```typescript
export class MyComponent extends LiveComponent<typeof MyComponent.defaultState> {
  static componentName = 'MyComponent'
  static publicActions = ['doWork'] as const
  static defaultState = { users: [] as string[], ready: false, currentRoom: '' }

  private _pollTimer?: NodeJS.Timeout

  // 1. Called when WebSocket connection is established (before onMount)
  protected onConnect() {
    console.log('WebSocket connected for this component')
  }

  // 2. Called AFTER component is fully mounted (rooms, auth, injections ready)
  // Can be async!
  protected async onMount() {
    this.$room('main').join()
    const data = await fetchInitialData(this.$auth.session?.id)
    this.state.ready = true
    this._pollTimer = setInterval(() => this.poll(), 5000)
  }

  // Called after state is restored from localStorage (rehydration)
  protected onRehydrate(previousState: typeof MyComponent.defaultState) {
    if (!previousState.ready) {
      this.state.ready = false // Re-validate stale state
    }
  }

  // Called after any state mutation (proxy or setState)
  protected onStateChange(changes: Partial<typeof MyComponent.defaultState>) {
    if ('users' in changes) {
      console.log(`User count: ${this.state.users.length}`)
    }
  }

  // Called when joining a room
  protected onRoomJoin(roomId: string) {
    this.state.currentRoom = roomId
  }

  // Called when leaving a room
  protected onRoomLeave(roomId: string) {
    if (this.state.currentRoom === roomId) this.state.currentRoom = ''
  }

  // Called before each action -- return false to cancel
  protected onAction(action: string, payload: any) {
    console.log(`[${this.id}] ${action}`, payload)
    // return false  // would cancel the action
  }

  // Called when a new client joins a singleton component
  protected onClientJoin(connectionId: string, connectionCount: number) {
    console.log(`Client ${connectionId} joined, total: ${connectionCount}`)
  }

  // Called when a client leaves a singleton component
  protected onClientLeave(connectionId: string, connectionCount: number) {
    console.log(`Client ${connectionId} left, total: ${connectionCount}`)
  }

  // Called when WebSocket drops (NOT on intentional unmount)
  protected onDisconnect() {
    console.log('Connection lost -- saving recovery data')
  }

  // Called BEFORE internal cleanup (sync only)
  protected onDestroy() {
    clearInterval(this._pollTimer)
  }

  async doWork() { /* ... */ }
  private poll() { /* ... */ }
}
```

> **Note:** The example components in `app/server/live/` are intentionally simple and do not use most lifecycle hooks. This does not mean the hooks are unavailable -- they are all part of the `@fluxstack/live` framework API and can be used in any LiveComponent subclass.

### Lifecycle Order

```
WebSocket connects
  -> onConnect()
       -> onMount()          <- async, rooms/auth ready
            -> [component active]
                 |-> onAction(action, payload)  <- before each action (return false to cancel)
                 |-> onStateChange(changes)     <- after each state mutation
                 |-> onRoomJoin(roomId)         <- when joining a room
                 |-> onRoomLeave(roomId)        <- when leaving a room
                 |-> onClientJoin(connId, count) <- singleton: new client joined
                 -> onClientLeave(connId, count) <- singleton: client left

Connection drops:
  -> onDisconnect()          <- only on unexpected disconnect
       -> onDestroy()        <- sync, before internal cleanup

Rehydration (reconnect with saved state):
  -> onConnect()
       -> onRehydrate(previousState)
            -> onMount()
```

### Rules

| Hook | Async? | When |
|------|--------|------|
| `onConnect()` | No | WebSocket established, before mount |
| `onMount()` | **Yes** | After all setup (rooms, auth, DI) |
| `onRehydrate(prevState)` | No | After state restored from localStorage |
| `onStateChange(changes)` | No | After every state mutation |
| `onRoomJoin(roomId)` | No | After `$room.join()` |
| `onRoomLeave(roomId)` | No | After `$room.leave()` |
| `onAction(action, payload)` | **Yes** | Before action execution (return `false` to cancel) |
| `onClientJoin(connId, count)` | No | Singleton: new client connected |
| `onClientLeave(connId, count)` | No | Singleton: client disconnected |
| `onDisconnect()` | No | Connection lost (NOT intentional unmount) |
| `onDestroy()` | No | Before internal cleanup |

- All hooks are optional -- override only what you need
- All hook errors are caught and logged -- they never break the system
- Constructor is still needed ONLY for `this.onRoomEvent()` subscriptions
- All hooks are in BLOCKED_ACTIONS -- clients cannot call them remotely

## Custom ID Generator

The `LiveServer` accepts a `generateId` option that replaces the default ID generation for component IDs, connection IDs, and cluster singleton IDs:

```typescript
import { LiveServer } from '@fluxstack/live'
import { nanoid } from 'nanoid'

const server = new LiveServer({
  transport: elysiaAdapter,
  generateId: () => nanoid(), // Custom ID generator
})
```

When provided, the custom generator is used via the `LiveComponentContext` -- every `LiveComponent` instance calls it during construction. If not provided, the framework uses its built-in `generateId()` (crypto-based).

## HMR Persistence

Data in `static persistent` survives Hot Module Replacement reloads via `globalThis`:

```typescript
export class LiveMigration extends LiveComponent<typeof LiveMigration.defaultState> {
  static componentName = 'LiveMigration'
  static publicActions = ['runMigration'] as const
  static defaultState = { status: 'idle', lastResult: '' }

  // Define shape and defaults for persistent data
  static persistent = {
    cache: {} as Record<string, any>,
    runCount: 0
  }

  protected onMount() {
    this.$persistent.runCount++
    console.log(`Mount #${this.$persistent.runCount}`) // Survives HMR!
  }

  async runMigration(payload: { key: string }) {
    // Check HMR-safe cache
    if (this.$persistent.cache[payload.key]) {
      return { cached: true, result: this.$persistent.cache[payload.key] }
    }

    const result = await expensiveComputation(payload.key)
    this.$persistent.cache[payload.key] = result
    this.state.lastResult = result
    return { cached: false, result }
  }
}
```

**Key facts:**
- `this.$persistent` reads from `globalThis.__fluxstack_persistent_{ComponentName}`
- Each component class has its own namespace
- Defaults come from `static persistent` -- initialized once, then persisted
- Not sent to client -- server-only
- `$persistent` is in BLOCKED_ACTIONS (can't be called from client)

## Singleton Components

When `static singleton = true`, only ONE server-side instance exists. All clients share the same state. This is a real feature of `@fluxstack/live` with cluster support via Redis.

```typescript
export class LiveDashboard extends LiveComponent<typeof LiveDashboard.defaultState> {
  static componentName = 'LiveDashboard'
  static singleton = true  // All clients share this instance
  static publicActions = ['refresh', 'addAlert'] as const
  static defaultState = {
    visitors: 0,
    alerts: [] as string[],
    lastRefresh: ''
  }

  protected async onMount() {
    this.state.visitors++
    this.state.lastRefresh = new Date().toISOString()
  }

  // Singleton-specific hooks (optional)
  protected onClientJoin(connectionId: string, connectionCount: number) {
    this.state.visitors = connectionCount
  }

  protected onClientLeave(connectionId: string, connectionCount: number) {
    this.state.visitors = connectionCount
  }

  async refresh() {
    const data = await fetchDashboardData()
    this.setState(data) // Broadcasts to ALL connected clients
    return { success: true }
  }

  async addAlert(payload: { message: string }) {
    this.state.alerts = [...this.state.alerts, payload.message]
    // All clients see the new alert instantly
    return { success: true }
  }
}
```

**How it works:**
- First client to mount creates the singleton instance
- Subsequent clients join the existing instance and receive current state
- `emit` / `setState` / `this.state.x = y` broadcast to ALL connected WebSockets
- When a client disconnects, it's removed from the singleton's connections
- When the LAST client disconnects, the singleton is destroyed
- Stats visible at `/api/live/stats` (shows singleton connection counts)
- Cluster support: coordinated across server instances via `IClusterAdapter` (Redis)

**Use cases:** Shared dashboards, global migration state, admin panels, live counters

## State Management

### Reactive State Proxy (How It Works)

State mutations auto-sync with the frontend via two layers:

**Layer 1 -- Proxy** (`this.state`): A `Proxy` wraps the internal state object. Any `set` on `this.state` compares old vs new value and, if changed, emits `STATE_DELTA` to the client automatically.

**Layer 2 -- Direct Accessors** (`this.count`): On construction, `createDirectStateAccessors()` defines a getter/setter via `Object.defineProperty` for each key in `defaultState`. The setter delegates to the proxy, so it also triggers `STATE_DELTA`.

```
this.count++              -> accessor setter -> proxy set -> STATE_DELTA
this.state.count++        -> proxy set -> STATE_DELTA
this.setState({count: 1}) -> Object.assign + single STATE_DELTA (batch)
```

### Direct State Access

State properties are accessible directly on `this`:

```typescript
// Declare properties for TypeScript
declare count: number
declare message: string

// Direct access - auto-syncs via proxy!
this.count++
this.message = 'Hello'

// Also works - same proxy underneath
this.state.count++
```

> **Performance note:** Each direct assignment emits one `STATE_DELTA`. For multiple properties at once, use `setState` (single emit).

### setState (Batch Updates)

Use `setState` for multiple properties at once (single emit):

```typescript
// Batch update - one STATE_DELTA event
this.setState({
  count: newCount,
  lastUpdatedBy: userId,
  updatedAt: new Date().toISOString()
})

// Function updater (access previous state)
this.setState(prev => ({
  count: prev.count + 1,
  lastUpdatedBy: userId
}))
```

> `setState` writes directly to `_state` (bypasses proxy) and emits a single `STATE_DELTA` with all changed keys. More efficient than N individual assignments.

### setValue (Generic Action)

Built-in action to set any state key from the client. **Must be explicitly included in `publicActions` to be callable:**

```typescript
// Server: opt-in to setValue
static publicActions = ['increment', 'setValue'] as const  // Must include 'setValue'

// Client can then call:
await component.setValue({ key: 'count', value: 42 })
```

> **Security note:** `setValue` is powerful - it allows the client to set any state key. Only add it to `publicActions` if you trust the client to modify any state field.

### $private -- Server-Only State

`$private` is a key-value store that lives **exclusively on the server**. It is NEVER synchronized with the client -- no `STATE_UPDATE`, no `STATE_DELTA`, not included in `getSerializableState()`.

Use it for sensitive data like tokens, API keys, internal IDs, or any server-side bookkeeping:

```typescript
export class Chat extends LiveComponent<typeof Chat.defaultState> {
  static componentName = 'Chat'
  static publicActions = ['connect', 'sendMessage'] as const
  static defaultState = { messages: [] as string[] }

  async connect(payload: { token: string }) {
    // Stays on server -- never sent to client
    this.$private.token = payload.token
    this.$private.apiKey = await getApiKey()

    // Only UI data goes to state (synced with client)
    this.state.messages = await fetchMessages(this.$private.token)
    return { success: true }
  }

  async sendMessage(payload: { text: string }) {
    // Use $private data for server-side logic
    await postToAPI(this.$private.apiKey, payload.text)
    this.state.messages = [...this.state.messages, payload.text]
    return { success: true }
  }
}
```

#### Typed $private (optional)

Pass a second generic to get full autocomplete and type checking:

```typescript
interface ChatPrivate {
  token: string
  apiKey: string
  retryCount: number
}

export class Chat extends LiveComponent<typeof Chat.defaultState, ChatPrivate> {
  static componentName = 'Chat'
  static publicActions = ['connect'] as const
  static defaultState = { messages: [] as string[] }

  async connect(payload: { token: string }) {
    this.$private.token = payload.token     // autocomplete
    this.$private.retryCount = 0            // must be number
    // this.$private.tokkken = 'x'          // TypeScript error (typo)
  }
}
```

The second generic defaults to `Record<string, any>`, so existing components work without changes.

**Key facts:**
- Starts as an empty `{}` -- no static default needed
- Mutations do NOT trigger any WebSocket messages
- Cleared automatically on `destroy()`
- Lost on rehydration (re-populate in your action handlers)
- Blocked from remote access (`$private` and `_privateState` are in BLOCKED_ACTIONS)
- Optional `TPrivate` generic for full type safety

### getSerializableState

Get current state for serialization (does NOT include `$private`):

```typescript
const currentState = this.getSerializableState()
```

### State Persistence

State is automatically signed and persisted on client. On reconnection, state is re-hydrated:

```typescript
// Automatic - no code needed
// Client stores signed state in localStorage
// On reconnect, sends signed state to server
// Server validates signature and restores component
```

## Room Events System

### Subscribe to Room Events

```typescript
constructor(initialState, ws, options) {
  super(initialState, ws, options)
  
  // Listen for room events
  this.onRoomEvent<{ count: number }>('COUNT_CHANGED', (data) => {
    this.setState({ count: data.count })
  })
  
  this.onRoomEvent<{ message: string }>('MESSAGE_SENT', (data) => {
    // Handle message
  })
}
```

### Emit Room Events

```typescript
// Emit event to all room members
this.emitRoomEvent('MESSAGE_SENT', { 
  message: 'Hello',
  userId: this.userId 
})

// Emit event AND update local state
this.emitRoomEventWithState('COUNT_CHANGED',
  { count: newCount },        // Event data
  { count: newCount }         // State update
)
```

### Typed Rooms ($room)

Components can use typed `LiveRoom` classes for structured room interactions:

```typescript
import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { CounterRoom } from './rooms/CounterRoom'

export class LiveSharedCounter extends LiveComponent<typeof LiveSharedCounter.defaultState> {
  static componentName = 'LiveSharedCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const
  static defaultState = {
    username: '',
    count: 0,
    lastUpdatedBy: null as string | null,
    onlineCount: 0
  }

  private counterUnsub: (() => void) | null = null

  constructor(initialState: Partial<typeof LiveSharedCounter.defaultState> = {}, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    super(initialState, ws, options)

    const room = this.$room(CounterRoom, 'global')
    room.join()

    // Load current state from room
    this.setState({
      count: room.state.count,
      lastUpdatedBy: room.state.lastUpdatedBy,
      onlineCount: room.state.onlineCount
    })

    // Listen for updates from other users
    this.counterUnsub = room.on('counter:updated', (data) => {
      this.setState({ count: data.count, lastUpdatedBy: data.updatedBy })
    })
  }

  async increment() {
    const room = this.$room(CounterRoom, 'global')
    const count = room.increment(this.state.username || 'Anonymous')
    return { success: true, count }
  }

  destroy() {
    this.counterUnsub?.()
    super.destroy()
  }
}
```

**$room API:**
- `this.$room(RoomClass, instanceId)` -- typed room handle with custom methods
- `this.$room('roomId')` -- untyped room handle (legacy)
- `this.$rooms` -- list of room IDs this component participates in

## Actions

Actions are methods callable from the client. **Only methods listed in `publicActions` can be called remotely.** Components without `publicActions` deny ALL remote actions.

```typescript
// Server-side
export class LiveForm extends LiveComponent<typeof LiveForm.defaultState> {
  static publicActions = ['submit', 'validate', 'reset', 'setValue'] as const

  static defaultState = {
    name: '',
    email: '',
    message: '',
    submitted: false,
    submittedAt: null as string | null
  }

  async submit() {
    const { name, email, message } = this.state
    
    if (!name || !email) {
      throw new Error('Nome e email sao obrigatorios')
    }
    
    this.setState({
      submitted: true,
      submittedAt: new Date().toISOString()
    })
    
    return {
      success: true,
      data: { name, email, message },
      submittedAt: this.state.submittedAt
    }
  }

  async validate() {
    const errors: Record<string, string> = {}
    
    if (!this.state.name) errors.name = 'Nome e obrigatorio'
    if (!this.state.email) errors.email = 'Email e obrigatorio'
    else if (!this.state.email.includes('@')) errors.email = 'Email invalido'
    
    return { valid: Object.keys(errors).length === 0, errors }
  }
}
```

### Action Security Features (framework)

The `@fluxstack/live` framework provides additional action security features:

- **Zod validation** -- `static actionSchemas` for automatic payload validation before action execution
- **Rate limiting** -- `static actionRateLimit` to prevent clients from spamming actions
- **Per-action auth** -- `static actionAuth` with roles/permissions per action

```typescript
static actionSchemas = {
  sendMessage: z.object({ text: z.string().max(500) }),
}

static actionRateLimit = { maxCalls: 10, windowMs: 1000, perAction: true }
```

## Authentication

Components can require authentication and define per-action permissions:

```typescript
export class LiveAdminPanel extends LiveComponent<AdminPanelState> {
  static componentName = 'LiveAdminPanel'
  static publicActions = ['getAuthInfo', 'init', 'listUsers', 'addUser', 'deleteUser', 'clearAudit'] as const

  // Component-level: requires auth + admin role
  static auth: LiveComponentAuth = {
    required: true,
    roles: ['admin'],
  }

  // Per-action: granular permissions
  static actionAuth: LiveActionAuthMap = {
    deleteUser: { permissions: ['users.delete'] },
    clearAudit: { roles: ['admin'] },
  }

  async getAuthInfo() {
    return {
      authenticated: this.$auth.authenticated,
      userId: this.$auth.session?.id,
      roles: this.$auth.session?.roles || [],
      isAdmin: this.$auth.hasRole('admin'),
    }
  }
}
```

**Auth levels:**
- `this.state` -- client reads AND writes (bidirectional)
- `this.$private` -- client NEVER sees (server-only)
- `this.$auth` -- set by framework, immutable (read-only)

## Client-Side Integration

### Provider Setup

Wrap app with LiveComponentsProvider:

```typescript
// app/client/src/App.tsx
import { LiveComponentsProvider } from '@/core/client'

function App() {
  return (
    <LiveComponentsProvider
      url="ws://localhost:3000"
      autoConnect={true}
      reconnectInterval={1000}
      debug={true}
    >
      <AppContent />
    </LiveComponentsProvider>
  )
}
```

### Using Components

```typescript
import { Live } from '@/core/client'
import { LiveCounter } from '@server/live/LiveCounter'

export function CounterDemo() {
  // Mount component with options
  const counter = Live.use(LiveCounter, {
    room: 'global-counter',
    initialState: LiveCounter.defaultState
  })

  // Access state
  const count = counter.$state.count
  
  // Check connection status
  const isConnected = counter.$connected
  
  // Check loading state
  const isLoading = counter.$loading

  // Call actions
  const handleIncrement = async () => {
    await counter.increment()
  }

  return (
    <div>
      <p>Count: {count}</p>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={handleIncrement} disabled={isLoading}>
        Increment
      </button>
    </div>
  )
}
```

### Field Binding

For form components, use `$field` helper:

```typescript
const form = Live.use(LiveForm)

// Sync on blur
<input {...form.$field('name', { syncOn: 'blur' })} />

// Sync on change with debounce
<input {...form.$field('email', { syncOn: 'change', debounce: 500 })} />

// Manual sync
await form.$sync()
```

### Client API

```typescript
// State access
counter.$state.count

// Connection status
counter.$connected

// Loading state
counter.$loading

// Call action
await counter.increment()

// Field binding (forms)
form.$field('fieldName', options)

// Manual sync
await form.$sync()
```

## Component Registry

Components are auto-discovered from `app/server/live/`:

```typescript
// app/server/live/auto-generated-components.ts (auto-generated by @fluxstack/live)
import { LiveAdminPanel } from "./LiveAdminPanel"
import { LiveCounter } from "./LiveCounter"
import { LiveForm } from "./LiveForm"
// ... etc

export const liveComponentClasses = [
  LiveAdminPanel,
  LiveCounter,
  LiveForm,
  // ...
]
```

The `LiveServer` auto-discovers components via `componentsPath` option and generates this file. For production builds, pass `components: liveComponentClasses` to avoid dynamic imports.

## WebSocket Connection Handling

### Automatic Reconnection

Client automatically reconnects on disconnect:

```typescript
<LiveComponentsProvider
  reconnectInterval={1000}  // Retry every 1 second
  autoConnect={true}
>
```

### State Re-hydration

On reconnect, components restore previous state:

1. Client stores signed state in localStorage
2. On reconnect, sends signed state to server
3. Server validates signature (HMAC-SHA256) and **anti-replay nonce**
4. Component re-hydrated with previous state
5. State expires after 24 hours (configurable)

No manual code needed - automatic. Each signed state includes a cryptographic nonce that is consumed on validation, preventing replay attacks.

## Multi-User Synchronization

### Room-Based Sync

All components in same room receive events:

```typescript
// User A increments
await counter.increment()
// Emits COUNT_CHANGED to room

// User B's component receives event
this.onRoomEvent('COUNT_CHANGED', (data) => {
  this.setState({ count: data.count })
})
// User B sees updated count
```

### User Tracking

Track connected users in room:

```typescript
constructor(initialState, ws, options) {
  super(initialState, ws, options)
  
  // Notify room of new user
  const newCount = this.state.connectedUsers + 1
  this.emitRoomEventWithState('USER_COUNT_CHANGED',
    { connectedUsers: newCount },
    { connectedUsers: newCount }
  )
}

destroy() {
  // Notify room of user leaving
  const newCount = Math.max(0, this.state.connectedUsers - 1)
  this.emitRoomEvent('USER_COUNT_CHANGED', { connectedUsers: newCount })
  super.destroy()
}
```

## Error Handling

```typescript
// Server-side - throw errors
async submit() {
  if (!this.state.email) {
    throw new Error('Email required')
  }
  // Process...
}

// Client-side - catch errors
try {
  await form.submit()
} catch (error) {
  alert(error.message)
}
```

## Performance Monitoring

Built-in performance tracking:

```typescript
// Automatic metrics collection
// - Render times
// - Action execution times
// - Error counts
// - Memory usage

// Access via registry
const health = componentRegistry.getComponentHealth(componentId)
// { status: 'healthy', metrics: {...} }
```

## Existing Components

The app includes these live components in `app/server/live/`:

| Component | Description | Features |
|-----------|-------------|----------|
| `LiveLocalCounter` | Simple counter, no room events | Direct state access, `declare` |
| `LiveCounter` | Shared counter with room events | `onRoomEvent`, `emitRoomEventWithState` |
| `LiveSharedCounter` | Shared counter using typed `CounterRoom` | `$room(CounterRoom, 'global')` |
| `LiveForm` | Reactive form with server validation | `setValue`, `validate`, `submit` |
| `LivePingPong` | Binary codec demo (msgpack) | Typed `PingRoom`, round-trip timing |
| `LiveRoomChat` | Multi-room chat with directory | `ChatRoom`, `DirectoryRoom`, password rooms |
| `LiveProtectedChat` | Auth-required chat | `static auth`, `static actionAuth`, roles |
| `LiveAdminPanel` | Admin panel with RBAC | Component + per-action auth, audit trail |
| `LiveUpload` | Chunked file upload via WebSocket | Filename validation, progress tracking |

## Component Organization

```
app/server/live/
├── LiveCounter.ts              # Shared counter with room events
├── LiveLocalCounter.ts         # Local counter (no room)
├── LiveForm.ts                 # Reactive form
├── LivePingPong.ts             # Binary codec demo
├── LiveSharedCounter.ts        # Typed room counter
├── LiveRoomChat.ts             # Multi-room chat
├── LiveProtectedChat.ts        # Auth-required chat
├── LiveAdminPanel.ts           # Admin panel with RBAC
├── LiveUpload.ts               # Chunked file upload
├── rooms/                      # Typed LiveRoom definitions
│   ├── ChatRoom.ts
│   ├── CounterRoom.ts
│   ├── DirectoryRoom.ts
│   └── PingRoom.ts
└── auto-generated-components.ts  # Auto-generated registration

app/client/src/live/
├── CounterDemo.tsx
├── FormDemo.tsx
├── RoomChatDemo.tsx
├── SharedCounterDemo.tsx
├── PingPongDemo.tsx
├── UploadDemo.tsx
└── ...
```

Each server file contains:
- `static componentName` - Component identifier
- `static publicActions` - **REQUIRED** whitelist of client-callable methods
- `static defaultState` - Initial state object
- `static logging` - Per-component console log control (optional)
- Component class extending `LiveComponent`
- Client link via `import type { Demo as _Client }`

## Advanced: Component Options

```typescript
export class MyComponent extends LiveComponent<typeof MyComponent.defaultState> {
  static $options = {
    deepDiff: true,        // Enable deep diff for plain objects (default: true)
    roomDeepDiff: true,    // Enable deep diff for room state (default: true)
    deepDiffDepth: 3,      // Max recursion depth (default: 3)
    serverOnlyRoomState: false,  // When true, client ROOM_STATE_SET is rejected
  }
}
```

## Critical Rules

**ALWAYS:**
- Define `static componentName` matching class name
- Define `static publicActions` listing ALL client-callable methods (MANDATORY)
- Define `static defaultState` inside the class
- Use `typeof ClassName.defaultState` for type parameter
- Use `declare` for each state property (TypeScript type hint)
- Use `onMount()` for async initialization (rooms, auth, data fetching)
- Use `onDestroy()` for cleanup (timers, connections) -- sync only
- Use `emitRoomEventWithState` for state changes in rooms
- Handle errors in actions (throw Error)
- Add client link: `import type { Demo as _Client } from '@client/...'`
- Use `$persistent` for data that should survive HMR reloads
- Use `static singleton = true` for shared cross-client state

**NEVER:**
- Omit `static publicActions` (component will deny ALL remote actions)
- Export separate `defaultState` constant (use static)
- Create constructor just to call super() (not needed)
- Forget `static componentName` (breaks minification)
- Override `destroy()` directly -- use `onDestroy()` instead (prefer lifecycle hooks)
- Emit room events without subscribing first
- Store non-serializable data in state
- Use reserved names for state properties (id, state, ws, room, userId, $room, $rooms, $private, $persistent, broadcastToRoom, roomType)
- Include `setValue` in `publicActions` unless you trust clients to modify any state key
- Store sensitive data (tokens, API keys, secrets) in `state` -- use `$private` instead

**STATE UPDATES -- all auto-sync via Proxy:**
```typescript
// Direct access (1 prop -> 1 STATE_DELTA)
declare count: number
this.count++

// Also works (same proxy underneath)
this.state.count++

// Multiple properties -> use setState (1 STATE_DELTA for all)
this.setState({ a: 1, b: 2, c: 3 })

// Don't use setState for single property (unnecessary)
// this.setState({ count: this.count + 1 })
```

---

## Live Upload (Chunked Upload via WebSocket)

This project includes a Live Component-based upload system that streams file chunks
over the Live Components WebSocket. The client uses a chunked upload hook; the server
tracks progress and assembles the file in `uploads/`.

### Server: LiveUpload Component

```typescript
// app/server/live/LiveUpload.ts
import { LiveComponent } from '@core/types/types'

export class LiveUpload extends LiveComponent<typeof LiveUpload.defaultState> {
  static componentName = 'LiveUpload'
  static publicActions = ['startUpload', 'updateProgress', 'completeUpload', 'failUpload', 'reset'] as const
  static defaultState = {
    status: 'idle' as 'idle' | 'uploading' | 'complete' | 'error',
    progress: 0,
    fileName: '',
    fileSize: 0,
    fileType: '',
    fileUrl: '',
    bytesUploaded: 0,
    totalBytes: 0,
    error: null as string | null
  }

  async startUpload(payload: { fileName: string; fileSize: number; fileType: string }) {
    const fileName = payload.fileName

    // Validate filename length
    if (!fileName || fileName.length > 255) {
      throw new Error('Invalid file name: must be 1-255 characters')
    }

    // Block path traversal, null bytes, and control characters
    if (/[\x00-\x1f]/.test(fileName) || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('Invalid file name: contains forbidden characters')
    }

    // Block Windows reserved names
    const baseName = fileName.split('.')[0].toUpperCase()
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1', 'LPT2', 'LPT3']
    if (reserved.includes(baseName)) {
      throw new Error('Invalid file name: reserved name')
    }

    this.setState({
      status: 'uploading',
      progress: 0,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      fileUrl: '',
      bytesUploaded: 0,
      totalBytes: payload.fileSize,
      error: null
    })

    return { success: true }
  }

  // ... updateProgress, completeUpload, failUpload, reset
}
```

### Client: useLiveUpload + Widget

```typescript
// app/client/src/live/UploadDemo.tsx
import { useLiveUpload } from './useLiveUpload'
import { LiveUploadWidget } from '../components/LiveUploadWidget'

export function UploadDemo() {
  const { live } = useLiveUpload()

  return (
    <LiveUploadWidget live={live} />
  )
}
```

### Chunked Upload Flow

1. Client calls `startUpload()` (Live Component action).
2. Client streams file chunks over WebSocket with `useChunkedUpload`.
3. Server assembles file in `uploads/` and returns `/uploads/...`.
4. Client maps to `/api/uploads/...` for access.

### Error Handling

- If an action throws, the error surfaces in `live.$error` on the client.
- The widget shows `localError || state.error || $error`.

### Files Involved

**Server**
- `app/server/live/LiveUpload.ts`
- `core/server/live/FileUploadManager.ts` (chunk handling + file assembly)
- `core/server/live/websocket-plugin.ts` (upload message routing)

**Client**
- `core/client/hooks/useChunkedUpload.ts` (streaming chunks)
- `core/client/hooks/useLiveUpload.ts` (Live Component wrapper)
- `app/client/src/components/LiveUploadWidget.tsx` (UI)

## Related

- [Live Auth](./live-auth.md) - Authentication for Live Components
- [Live Logging](./live-logging.md) - Per-component logging control
- [Live Rooms](./live-rooms.md) - Multi-room real-time communication
- [Live Upload](./live-upload.md) - Chunked file upload
- [Live Binary Delta](./live-binary-delta.md) - High-frequency binary state sync
- [Project Structure](../patterns/project-structure.md)
- [Type Safety Patterns](../patterns/type-safety.md)
- [WebSocket Plugin](../core/plugin-system.md)
