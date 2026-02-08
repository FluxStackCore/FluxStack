# Live Components

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Server-side state management with WebSocket sync
- Automatic state persistence and re-hydration
- Room-based event system for multi-user sync
- Type-safe client-server communication
- Built-in connection management and recovery

## LiveComponent Class Structure

Server-side component extends `LiveComponent`:

```typescript
// app/server/live/LiveCounter.ts
import { LiveComponent } from '@core/types/types'

export const defaultState = {
  count: 0,
  lastUpdatedBy: null as string | null,
  connectedUsers: 0
}

export class LiveCounter extends LiveComponent<typeof defaultState> {
  static defaultState = defaultState
  protected roomType = 'counter'

  constructor(
    initialState: Partial<typeof defaultState>, 
    ws: any, 
    options?: { room?: string; userId?: string }
  ) {
    super({ ...defaultState, ...initialState }, ws, options)
    
    // Subscribe to room events
    this.onRoomEvent<{ count: number }>('COUNT_CHANGED', (data) => {
      this.setState({ count: data.count })
    })
  }

  // Actions - called from client
  async increment() {
    const newCount = this.state.count + 1
    this.emitRoomEventWithState('COUNT_CHANGED', 
      { count: newCount }, 
      { count: newCount }
    )
    return { success: true, count: newCount }
  }

  async decrement() {
    const newCount = this.state.count - 1
    this.emitRoomEventWithState('COUNT_CHANGED',
      { count: newCount },
      { count: newCount }
    )
    return { success: true, count: newCount }
  }

  destroy() {
    // Cleanup logic
    super.destroy()
  }
}
```

## Lifecycle Methods

```typescript
export class MyComponent extends LiveComponent<StateType> {
  constructor(initialState, ws, options) {
    super(initialState, ws, options)
    // Component initialization
    // Subscribe to room events here
  }

  // Called when component is destroyed
  destroy() {
    // Cleanup subscriptions, timers, etc.
    super.destroy()
  }
}
```

## State Management

### setState

Update component state and sync to client:

```typescript
this.setState({ count: newCount })
```

### getSerializableState

Get current state for serialization:

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

### Room Subscription

Components automatically join rooms specified in options:

```typescript
// Client-side
const counter = Live.use(LiveCounter, {
  room: 'global-counter'  // All instances in this room sync
})
```

## Actions

Actions are methods called from the client:

```typescript
// Server-side
export class LiveForm extends LiveComponent<FormState> {
  async submit() {
    const { name, email } = this.state
    
    if (!name || !email) {
      throw new Error('Name and email required')
    }
    
    // Process submission
    this.setState({ submitted: true })
    
    return { success: true, data: { name, email } }
  }

  async validate() {
    const errors: Record<string, string> = {}
    
    if (!this.state.name) errors.name = 'Name required'
    if (!this.state.email) errors.email = 'Email required'
    
    return { valid: Object.keys(errors).length === 0, errors }
  }
}
```

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
import { LiveCounter, defaultState } from '@server/live/LiveCounter'

export function CounterDemo() {
  // Mount component with options
  const counter = Live.use(LiveCounter, {
    room: 'global-counter',
    initialState: defaultState
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
// app/server/live/register-components.ts
import { componentRegistry } from '@core/server/live'

// Auto-discover all components in directory
await componentRegistry.autoDiscoverComponents('./app/server/live')

// Or manually register
componentRegistry.registerComponent({
  name: 'MyComponent',
  component: MyComponent,
  initialState: defaultState
}, '1.0.0')
```

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
3. Server validates signature
4. Component re-hydrated with previous state

No manual code needed - automatic.

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

## Component Organization

```
app/server/live/
├── LiveCounter.ts          # Counter component
├── LiveForm.ts             # Form component
├── LiveChat.ts             # Chat component
└── register-components.ts  # Registration
```

Each file exports:
- `defaultState` - Initial state object
- Component class extending `LiveComponent`

## Testing Components

```typescript
// tests/unit/live/LiveCounter.test.ts
import { describe, it, expect } from 'vitest'
import { LiveCounter, defaultState } from '@app/server/live/LiveCounter'

describe('LiveCounter', () => {
  it('should increment count', async () => {
    const mockWs = { send: vi.fn() }
    const counter = new LiveCounter(defaultState, mockWs)
    
    const result = await counter.increment()
    
    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    expect(counter.state.count).toBe(1)
  })
})
```

## Advanced: Dependencies

Register services for dependency injection:

```typescript
// Register service
componentRegistry.registerService('database', () => db)

// Register dependencies
componentRegistry.registerDependencies('MyComponent', [
  { name: 'database', version: '1.0.0', required: true, factory: () => db }
])

// Component receives service
export class MyComponent extends LiveComponent<State> {
  private database: any

  setDatabase(db: any) {
    this.database = db
  }
}
```

## Critical Rules

**ALWAYS:**
- Export `defaultState` from component file
- Call `super.destroy()` in destroy method
- Use `emitRoomEventWithState` for state changes in rooms
- Handle errors in actions (throw Error)
- Define state type with `typeof defaultState`

**NEVER:**
- Modify state directly (use `setState`)
- Forget to call `super()` in constructor
- Emit room events without subscribing first
- Store non-serializable data in state
- Forget to cleanup in destroy method

---

## Live Upload (Chunked Upload via WebSocket)

This project includes a Live Component-based upload system that streams file chunks
over the Live Components WebSocket. The client uses a chunked upload hook; the server
tracks progress and assembles the file in `uploads/`.

### Server: LiveUpload Component

Create server-side upload actions inside a Live Component. This example is the base
implementation used by the demos:

```typescript
// app/server/live/LiveUpload.ts
import { LiveComponent } from '@core/types/types'
import { liveUploadDefaultState, type LiveUploadState } from '@app/shared'

export const defaultState: LiveUploadState = liveUploadDefaultState

export class LiveUpload extends LiveComponent<LiveUploadState> {
  static defaultState = defaultState

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
  }

  async startUpload(payload: { fileName: string; fileSize: number; fileType: string }) {
    // Basic validation (example)
    const normalized = payload.fileName.toLowerCase()
    if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
      throw new Error('Invalid file name')
    }

    const ext = normalized.includes('.') ? normalized.split('.').pop() || '' : ''
    const blocked = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'jar']
    if (ext && blocked.includes(ext)) {
      throw new Error(`File extension not allowed: .${ext}`)
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

  async updateProgress(payload: { progress: number; bytesUploaded: number; totalBytes: number }) {
    const progress = Math.max(0, Math.min(100, payload.progress))
    this.setState({
      progress,
      bytesUploaded: payload.bytesUploaded,
      totalBytes: payload.totalBytes
    })

    return { success: true, progress }
  }

  async completeUpload(payload: { fileUrl: string }) {
    this.setState({
      status: 'complete',
      progress: 100,
      fileUrl: payload.fileUrl,
      error: null
    })

    return { success: true }
  }

  async failUpload(payload: { error: string }) {
    this.setState({
      status: 'error',
      error: payload.error || 'Upload failed'
    })

    return { success: true }
  }

  async reset() {
    this.setState({ ...defaultState })
    return { success: true }
  }
}
```

### Client: useLiveUpload + Widget

Use the client hook and UI widget to wire the upload to the Live Component:

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

- [Project Structure](../patterns/project-structure.md)
- [Type Safety Patterns](../patterns/type-safety.md)
- [WebSocket Plugin](../core/plugin-system.md)
- [Live Upload](./live-upload.md)
