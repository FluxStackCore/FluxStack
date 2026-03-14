# Live Room System

**Version:** 2.0.0 | **Updated:** 2025-03-11

## Quick Facts

- **Two APIs:** Typed `$room(ChatRoom, 'lobby')` and untyped `$room('room-id')` — coexist
- **Typed rooms** have lifecycle hooks, private metadata, custom methods, join rejection
- **Untyped rooms** still work for simple pub/sub (backward compatible)
- Server-side room management — client cannot join typed rooms directly
- Events propagate to all room members automatically
- HTTP API integration for external systems (webhooks, bots)
- Powered by `@fluxstack/live` package

## Overview

The Room System enables real-time communication between Live Components. There are two levels:

1. **Typed Rooms (LiveRoom)** — Class-based rooms with lifecycle hooks, private state (`meta`), custom methods, and join validation. Ideal for rooms with business logic (chat with passwords, game rooms with rules).

2. **Untyped Rooms** — String-based `$room('id')` for simple pub/sub without a room class. Ideal for notifications, presence, simple event broadcasting.

Both are **server-side first**: the server controls membership, event routing, and state.

---

## Typed Rooms (LiveRoom)

### Creating a Room Class

Room classes live in `app/server/live/rooms/` and are auto-discovered on startup.

```typescript
// app/server/live/rooms/ChatRoom.ts
import { LiveRoom } from '@fluxstack/live'
import type { RoomJoinContext, RoomLeaveContext } from '@fluxstack/live'

export interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

// Public state — synced to all room members via WebSocket
interface ChatState {
  messages: ChatMessage[]
  onlineCount: number
  isPrivate: boolean
}

// Private metadata — NEVER leaves the server
interface ChatMeta {
  password: string | null
  createdBy: string | null
}

// Typed events emitted within the room
interface ChatEvents {
  'chat:message': ChatMessage
}

export class ChatRoom extends LiveRoom<ChatState, ChatMeta, ChatEvents> {
  // Required: unique room type name (used as prefix in compound IDs)
  static roomName = 'chat'

  // Initial state templates (cloned per instance)
  static defaultState: ChatState = { messages: [], onlineCount: 0, isPrivate: false }
  static defaultMeta: ChatMeta = { password: null, createdBy: null }

  // Room options
  static $options = { maxMembers: 100 }

  // === Lifecycle Hooks ===

  onJoin(ctx: RoomJoinContext) {
    // Validate password if room is protected
    if (this.meta.password) {
      if (ctx.payload?.password !== this.meta.password) {
        return false // Reject join
      }
    }
    this.setState({ onlineCount: this.state.onlineCount + 1 })
  }

  onLeave(_ctx: RoomLeaveContext) {
    this.setState({ onlineCount: Math.max(0, this.state.onlineCount - 1) })
  }

  // === Custom Methods ===

  setPassword(password: string | null) {
    this.meta.password = password
    this.setState({ isPrivate: password !== null })
  }

  addMessage(user: string, text: string) {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user,
      text,
      timestamp: Date.now(),
    }
    this.setState({ messages: [...this.state.messages.slice(-99), msg] })
    this.emit('chat:message', msg)
    return msg
  }
}
```

### LiveRoom Base Class API

```typescript
abstract class LiveRoom<TState, TMeta, TEvents> {
  // === Static Fields (required in subclass) ===
  static roomName: string                      // Unique type name (e.g. 'chat')
  static defaultState: Record<string, any>     // Initial public state
  static defaultMeta: Record<string, any>      // Initial private metadata
  static $options?: LiveRoomOptions             // { maxMembers?, deepDiff?, deepDiffDepth? }

  // === Instance Properties ===
  readonly id: string      // Compound ID (e.g. 'chat:lobby')
  state: TState            // Public state — synced to all members
  meta: TMeta              // Private metadata — NEVER sent to clients

  // === Framework Methods ===
  setState(updates: Partial<TState>): void     // Update & broadcast state
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): number  // Emit typed event
  get memberCount(): number                     // Current member count

  // === Lifecycle Hooks (override in subclass) ===
  onJoin(ctx: RoomJoinContext): void | false    // Return false to reject
  onLeave(ctx: RoomLeaveContext): void
  onEvent(event: string, data: any, ctx: RoomEventContext): void
  onCreate(): void                              // First member joined
  onDestroy(): void | false                     // Last member left (return false to keep alive)
}
```

### Lifecycle Context Types

```typescript
interface RoomJoinContext {
  componentId: string
  userId?: string
  payload?: any         // Arbitrary data passed from room.join({ ... })
}

interface RoomLeaveContext {
  componentId: string
  userId?: string
  reason: 'leave' | 'disconnect' | 'cleanup'
}

interface RoomEventContext {
  componentId: string
  userId?: string
}
```

### Public State vs Private Meta

| | `state` | `meta` |
|---|---|---|
| **Visibility** | Synced to all room members | Server-only, never leaves |
| **Access** | `this.state.x` / `this.setState({})` | `this.meta.x` (direct mutation) |
| **Use for** | Messages, counts, flags | Passwords, secrets, internal data |
| **Broadcast** | Yes, via deep diff | Never |

### Using Typed Rooms in Components

```typescript
// app/server/live/LiveRoomChat.ts
import { ChatRoom } from './rooms/ChatRoom'

export class LiveRoomChat extends LiveComponent<typeof LiveRoomChat.defaultState> {
  static publicActions = ['joinRoom', 'sendMessage'] as const

  async joinRoom(payload: { roomId: string; password?: string }) {
    // $room(Class, instanceId) — returns typed handle with custom methods
    const room = this.$room(ChatRoom, payload.roomId)

    // Join with payload (passed to onJoin lifecycle hook)
    const result = room.join({ password: payload.password })

    // Check rejection
    if ('rejected' in result && result.rejected) {
      return { success: false, error: result.reason }
    }

    // Access room state (public)
    const messages = room.state.messages

    // Access room meta (private, server-only)
    const createdBy = room.meta.createdBy

    // Call custom methods
    room.addMessage('System', 'Welcome!')
    room.setPassword('new-password')

    // Listen for typed events
    room.on('chat:message', (msg) => {
      // Update component state to sync with frontend
      this.setState({ messages: [...this.state.messages, msg] })
    })

    // Emit typed events
    room.emit('chat:message', { id: '1', user: 'Bot', text: 'Hi', timestamp: Date.now() })

    // Framework properties
    console.log(room.id)          // 'chat:lobby'
    console.log(room.memberCount) // 5
    console.log(room.state)       // { messages: [...], onlineCount: 5, isPrivate: true }

    return { success: true }
  }
}
```

### Compound Room IDs

Typed rooms use compound IDs: `${roomName}:${instanceId}`

```
ChatRoom + 'lobby'  → 'chat:lobby'
ChatRoom + 'vip'    → 'chat:vip'
GameRoom + 'match1' → 'game:match1'
```

This allows multiple instances of the same room type. The `RoomRegistry` resolves the class from the compound ID automatically.

### Room Auto-Discovery

Room classes in `app/server/live/rooms/` are auto-discovered on startup. Any exported class that extends `LiveRoom` is registered automatically.

```
app/server/live/rooms/
  ChatRoom.ts        → registered as 'chat'
  DirectoryRoom.ts   → registered as 'directory'
  GameRoom.ts        → registered as 'game'
```

No manual registration needed. The `websocket-plugin.ts` scans the directory and passes discovered rooms to `LiveServer`.

### Join Rejection

Typed rooms can reject joins in the `onJoin` hook:

```typescript
class VIPRoom extends LiveRoom<State, Meta, Events> {
  static roomName = 'vip'

  onJoin(ctx: RoomJoinContext) {
    // Reject if no password
    if (this.meta.password && ctx.payload?.password !== this.meta.password) {
      return false
    }

    // Reject if room is full (also handled automatically by maxMembers)
    if (this.memberCount >= 10) {
      return false
    }

    // Accept (return void)
  }
}
```

On the component side:

```typescript
const room = this.$room(VIPRoom, 'exclusive')
const result = room.join({ password: '1234' })

if ('rejected' in result && result.rejected) {
  return { success: false, error: result.reason }
}
```

### Server-Only Join Enforcement

Clients cannot join typed rooms directly via WebSocket. The join MUST happen through a component action on the server. If a client attempts to send a `ROOM_JOIN` message for a typed room, it receives an error:

```
"Room requires server-side join via component action"
```

This ensures all join logic (password validation, authorization, etc.) runs on the server.

---

## Shared Room Directory Pattern

When users can create rooms dynamically, other users need to discover them. The **DirectoryRoom** pattern solves this:

```typescript
// app/server/live/rooms/DirectoryRoom.ts
import { LiveRoom } from '@fluxstack/live'

export interface DirectoryEntry {
  id: string
  name: string
  isPrivate: boolean
  createdBy: string
}

interface DirectoryState {
  rooms: DirectoryEntry[]
}

interface DirectoryEvents {
  'room:added': DirectoryEntry
  'room:removed': { id: string }
}

export class DirectoryRoom extends LiveRoom<DirectoryState, {}, DirectoryEvents> {
  static roomName = 'directory'
  static defaultState: DirectoryState = { rooms: [] }
  static defaultMeta = {}

  addRoom(entry: DirectoryEntry) {
    this.setState({
      rooms: [...this.state.rooms.filter(r => r.id !== entry.id), entry]
    })
    this.emit('room:added', entry)
  }

  removeRoom(id: string) {
    this.setState({
      rooms: this.state.rooms.filter(r => r.id !== id)
    })
    this.emit('room:removed', { id })
  }
}
```

**Usage in component:**

```typescript
export class LiveRoomChat extends LiveComponent<...> {
  constructor(initialState, ws, options) {
    super(initialState, ws, options)

    // All instances auto-join the directory
    const dir = this.$room(DirectoryRoom, 'main')
    dir.join()

    // Load existing rooms
    this.setState({ customRooms: dir.state.rooms || [] })

    // Listen for real-time updates
    dir.on('room:added', (entry) => {
      this.setState({ customRooms: [...this.state.customRooms, entry] })
    })
  }

  async createRoom(payload: { roomId: string; roomName: string; password?: string }) {
    const room = this.$room(ChatRoom, payload.roomId)
    room.join()

    if (payload.password) room.setPassword(payload.password)

    // Register in directory — all connected users see it immediately
    this.$room(DirectoryRoom, 'main').addRoom({
      id: payload.roomId,
      name: payload.roomName,
      isPrivate: !!payload.password,
      createdBy: this.state.username
    })
  }
}
```

**Flow:**

```
User A creates room     → DirectoryRoom.addRoom()
                         → emit('room:added', entry)
                         → All LiveRoomChat instances receive event
                         → Each updates customRooms in component state
                         → Each frontend sees the new room in sidebar
```

---

## Password-Protected Rooms

Complete implementation using `meta` (server-only) and `onJoin` validation:

### 1. Room Class

```typescript
// ChatMeta.password is NEVER sent to clients
interface ChatMeta {
  password: string | null
  createdBy: string | null
}

class ChatRoom extends LiveRoom<ChatState, ChatMeta, ChatEvents> {
  static defaultMeta: ChatMeta = { password: null, createdBy: null }

  setPassword(password: string | null) {
    this.meta.password = password                    // Server-only
    this.setState({ isPrivate: password !== null })  // Visible to clients
  }

  onJoin(ctx: RoomJoinContext) {
    if (this.meta.password) {
      if (ctx.payload?.password !== this.meta.password) {
        return false // Wrong password → rejected
      }
    }
    // Password correct or no password → accepted
  }
}
```

### 2. Component Action

```typescript
async joinRoom(payload: { roomId: string; password?: string }) {
  const room = this.$room(ChatRoom, payload.roomId)
  const result = room.join({ password: payload.password })
  //                        ^^^^^^^^^ passed to onJoin ctx.payload

  if ('rejected' in result && result.rejected) {
    return { success: false, error: 'Senha incorreta' }
  }
  return { success: true }
}

async createRoom(payload: { roomId: string; roomName: string; password?: string }) {
  const room = this.$room(ChatRoom, payload.roomId)
  room.join()  // Creator joins without password (first join, no password set yet)

  if (payload.password) {
    room.setPassword(payload.password)  // Now set password for future joiners
  }
  room.meta.createdBy = this.state.username
}
```

### 3. Frontend

```tsx
// Password prompt when clicking a private room
const handleJoinRoom = async (roomId: string, roomName: string, isPrivate?: boolean) => {
  if (isPrivate) {
    showPasswordModal(roomId, roomName)
    return
  }
  const result = await chat.joinRoom({ roomId, roomName })
  if (result && !result.success) {
    // Rejected — maybe password-protected, show prompt
    showPasswordModal(roomId, roomName)
  }
}

// Submit with password
const handlePasswordSubmit = async () => {
  const result = await chat.joinRoom({
    roomId: prompt.roomId,
    roomName: prompt.roomName,
    password: passwordInput
  })
  if (result && !result.success) {
    showError('Senha incorreta')
  }
}
```

---

## Untyped Rooms (Legacy)

The string-based API still works for simple pub/sub without a room class:

```typescript
// Join/leave
this.$room('notifications').join()
this.$room('notifications').leave()

// Emit/listen
this.$room('notifications').emit('alert', { msg: 'hey' })
this.$room('notifications').on('alert', (data) => {
  this.setState({ alerts: [...this.state.alerts, data] })
})

// Room state
this.$room('notifications').setState({ lastAlert: Date.now() })
const state = this.$room('notifications').state

// Default room shorthand (via options.room)
this.$room.emit('event', data)
this.$room.on('event', handler)

// List all joined rooms
const rooms = this.$rooms // ['notifications', 'chat:lobby']
```

### Typed vs Untyped Comparison

| Feature | Typed `$room(Class, id)` | Untyped `$room('id')` |
|---|---|---|
| Lifecycle hooks | onJoin, onLeave, onCreate, onDestroy | None |
| Private metadata | `meta` (server-only) | None |
| Custom methods | addMessage(), setPassword(), etc. | None |
| Join rejection | `return false` in onJoin | Not possible |
| Type safety | Full (state, events, methods) | None |
| Server-only join | Enforced | Client can join directly |
| Max members | `$options.maxMembers` | No limit |
| Auto-discovery | Yes (rooms/ directory) | N/A |
| Use case | Complex room logic | Simple pub/sub |

**Both can be used in the same component:**

```typescript
// Typed room for chat
const chat = this.$room(ChatRoom, 'lobby')
chat.addMessage('user', 'hello')

// Untyped room for presence
this.$room('presence').join()
this.$room('presence').emit('online', { user: 'John' })
```

---

## Complete Example: Chat with Password Rooms

### Server — Room Classes

```
app/server/live/rooms/
  ChatRoom.ts       — Chat room with messages, password, lifecycle
  DirectoryRoom.ts  — Shared room directory for room discovery
```

### Server — Component

```typescript
// app/server/live/LiveRoomChat.ts
import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { ChatRoom } from './rooms/ChatRoom'
import { DirectoryRoom } from './rooms/DirectoryRoom'
import type { ChatMessage } from './rooms/ChatRoom'
import type { DirectoryEntry } from './rooms/DirectoryRoom'

export class LiveRoomChat extends LiveComponent<typeof LiveRoomChat.defaultState> {
  static componentName = 'LiveRoomChat'
  static publicActions = ['createRoom', 'joinRoom', 'leaveRoom', 'switchRoom', 'sendMessage', 'setUsername'] as const
  static defaultState = {
    username: '',
    activeRoom: null as string | null,
    rooms: [] as { id: string; name: string; isPrivate: boolean }[],
    messages: {} as Record<string, ChatMessage[]>,
    customRooms: [] as DirectoryEntry[]
  }

  private roomListeners = new Map<string, (() => void)[]>()
  private directoryUnsubs: (() => void)[] = []

  constructor(initialState: Partial<typeof LiveRoomChat.defaultState>, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    super(initialState, ws, options)

    // Auto-join directory for room discovery
    const dir = this.$room(DirectoryRoom, 'main')
    dir.join()
    this.setState({ customRooms: dir.state.rooms || [] })

    const unsubAdd = dir.on('room:added', (entry: DirectoryEntry) => {
      const current = this.state.customRooms.filter(r => r.id !== entry.id)
      this.setState({ customRooms: [...current, entry] })
    })
    const unsubRemove = dir.on('room:removed', (data: { id: string }) => {
      this.setState({ customRooms: this.state.customRooms.filter(r => r.id !== data.id) })
    })
    this.directoryUnsubs = [unsubAdd, unsubRemove]
  }

  async createRoom(payload: { roomId: string; roomName: string; password?: string }) {
    const room = this.$room(ChatRoom, payload.roomId)
    const result = room.join()
    if ('rejected' in result && result.rejected) return { success: false, error: result.reason }

    if (payload.password) room.setPassword(payload.password)
    room.meta.createdBy = this.state.username || 'Anonymous'

    // Register in directory so all users see it
    this.$room(DirectoryRoom, 'main').addRoom({
      id: payload.roomId, name: payload.roomName,
      isPrivate: !!payload.password, createdBy: this.state.username || 'Anonymous'
    })

    const unsub = room.on('chat:message', (msg: ChatMessage) => {
      const msgs = this.state.messages[payload.roomId] || []
      this.setState({ messages: { ...this.state.messages, [payload.roomId]: [...msgs, msg].slice(-100) } })
    })
    this.roomListeners.set(payload.roomId, [unsub])

    this.setState({
      activeRoom: payload.roomId,
      rooms: [...this.state.rooms.filter(r => r.id !== payload.roomId), { id: payload.roomId, name: payload.roomName, isPrivate: !!payload.password }],
      messages: { ...this.state.messages, [payload.roomId]: [] }
    })
    return { success: true, roomId: payload.roomId }
  }

  async joinRoom(payload: { roomId: string; roomName?: string; password?: string }) {
    if (this.roomListeners.has(payload.roomId)) {
      this.state.activeRoom = payload.roomId
      return { success: true, roomId: payload.roomId }
    }

    const room = this.$room(ChatRoom, payload.roomId)
    const result = room.join({ password: payload.password })
    if ('rejected' in result && result.rejected) return { success: false, error: 'Senha incorreta' }

    const unsub = room.on('chat:message', (msg: ChatMessage) => {
      const msgs = this.state.messages[payload.roomId] || []
      this.setState({ messages: { ...this.state.messages, [payload.roomId]: [...msgs, msg].slice(-100) } })
    })
    this.roomListeners.set(payload.roomId, [unsub])

    this.setState({
      activeRoom: payload.roomId,
      rooms: [...this.state.rooms.filter(r => r.id !== payload.roomId), { id: payload.roomId, name: payload.roomName || payload.roomId, isPrivate: room.state.isPrivate }],
      messages: { ...this.state.messages, [payload.roomId]: room.state.messages || [] }
    })
    return { success: true, roomId: payload.roomId }
  }

  async sendMessage(payload: { text: string }) {
    const roomId = this.state.activeRoom
    if (!roomId) throw new Error('No active room')
    // Custom method on ChatRoom — emits 'chat:message' event,
    // which the handler above catches and updates component state
    const room = this.$room(ChatRoom, roomId)
    const message = room.addMessage(this.state.username || 'Anonymous', payload.text.trim())
    return { success: true, message }
  }

  destroy() {
    for (const fns of this.roomListeners.values()) fns.forEach(fn => fn())
    this.roomListeners.clear()
    this.directoryUnsubs.forEach(fn => fn())
    super.destroy()
  }
}
```

### Frontend

```tsx
// app/client/src/live/RoomChatDemo.tsx
import { Live } from '@/core/client'
import { LiveRoomChat } from '@server/live/LiveRoomChat'

export function RoomChatDemo() {
  const chat = Live.use(LiveRoomChat, {
    initialState: { ...LiveRoomChat.defaultState, username: 'User123' }
  })

  // Joined rooms from component state
  const joinedRoomIds = chat.$state.rooms.map(r => r.id)

  // Custom rooms from shared directory (visible to ALL users)
  const customRooms = chat.$state.customRooms || []

  // Combine default + custom rooms for sidebar
  const allRooms = [
    ...DEFAULT_ROOMS,
    ...customRooms.filter(r => !DEFAULT_ROOMS.some(d => d.id === r.id))
  ]

  // Join with password handling
  const handleJoinRoom = async (roomId: string, roomName: string, isPrivate?: boolean) => {
    if (joinedRoomIds.includes(roomId)) {
      await chat.switchRoom({ roomId })
      return
    }
    if (isPrivate) {
      showPasswordPrompt(roomId, roomName)
      return
    }
    const result = await chat.joinRoom({ roomId, roomName })
    if (result && !result.success) {
      showPasswordPrompt(roomId, roomName) // Might be password-protected
    }
  }

  // Create room with optional password
  const handleCreateRoom = async (name: string, password?: string) => {
    const roomId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await chat.createRoom({ roomId, roomName: name, password })
  }
}
```

---

## Event Flow Diagrams

### Message Flow (Typed Room)

```
  Frontend A              Server                Frontend B
     │                      │                      │
     │  sendMessage()       │                      │
     │─────────────────────>│                      │
     │                      │                      │
     │                      │  ChatRoom.addMessage()
     │                      │  ├─ setState(messages)     // room state updated
     │                      │  └─ emit('chat:message')   // event to all members
     │                      │                      │
     │                      │  A's on('chat:message')
     │                      │  └─ component.setState()
     │  <state update>      │                      │
     │<─────────────────────│                      │
     │                      │                      │
     │                      │  B's on('chat:message')
     │                      │  └─ component.setState()
     │                      │  <state update>      │
     │                      │─────────────────────>│
```

### Password Join Flow

```
  Frontend              Component               ChatRoom
     │                      │                      │
     │  joinRoom(password)  │                      │
     │─────────────────────>│                      │
     │                      │                      │
     │                      │  room.join({password})
     │                      │─────────────────────>│
     │                      │                      │
     │                      │             onJoin(ctx)
     │                      │             ctx.payload.password
     │                      │             vs meta.password
     │                      │                      │
     │                      │  {rejected: true}    │  (wrong password)
     │                      │<─────────────────────│
     │                      │                      │
     │  {success: false}    │                      │
     │<─────────────────────│                      │
     │                      │                      │
     │  Show error toast    │                      │
```

### Room Discovery Flow

```
  User A                DirectoryRoom           User B
     │                      │                      │
     │  createRoom()        │                      │
     │  dir.addRoom(entry)  │                      │
     │─────────────────────>│                      │
     │                      │                      │
     │                      │  emit('room:added')  │
     │                      │─────────────────────>│
     │                      │                      │
     │                      │  B's on('room:added')│
     │                      │  setState(customRooms)
     │                      │                      │
     │                      │         New room appears in B's sidebar
```

---

## HTTP API Integration

Send messages from external systems via REST API:

```bash
# Send message to room
curl -X POST http://localhost:3000/api/rooms/geral/messages \
  -H "Content-Type: application/json" \
  -d '{"user": "Webhook Bot", "text": "New deployment completed!"}'

# Emit custom event
curl -X POST http://localhost:3000/api/rooms/tech/emit \
  -H "Content-Type: application/json" \
  -d '{"event": "notification", "data": {"type": "alert"}}'

# Get room stats
curl http://localhost:3000/api/rooms/stats
```

---

## Room Manager API

Direct access for advanced use cases:

```typescript
import { liveRoomManager } from '@core/server/live/LiveRoomManager'

// Membership
liveRoomManager.joinRoom(componentId, roomId, ws, initialState, options, joinContext)
liveRoomManager.leaveRoom(componentId, roomId, leaveReason)
liveRoomManager.cleanupComponent(componentId)

// Events & State
liveRoomManager.emitToRoom(roomId, event, data, excludeComponentId)
liveRoomManager.setRoomState(roomId, updates, excludeComponentId)
liveRoomManager.getRoomState(roomId)

// Queries
liveRoomManager.isInRoom(componentId, roomId)
liveRoomManager.getComponentRooms(componentId)
liveRoomManager.getMemberCount(roomId)
liveRoomManager.getRoomInstance(roomId)  // Get LiveRoom instance (typed rooms only)
liveRoomManager.getStats()
```

---

## Best Practices

**DO:**
- Use typed rooms for rooms with business logic (auth, validation, custom methods)
- Use `meta` for sensitive data (passwords, tokens, internal flags)
- Use `onJoin` to validate/reject joins
- Register event handlers with `room.on()` in joinRoom actions
- Use the DirectoryRoom pattern when users create rooms dynamically
- Clean up listeners in `destroy()`
- Load existing room state on join: `room.state.messages`

**DON'T:**
- Store sensitive data in `state` (it's synced to all clients)
- Forget to check `result.rejected` after `room.join()`
- Update component state directly in `sendMessage` when using room events (causes duplicates)
- Rely on untyped rooms for rooms with security requirements
- Skip the DirectoryRoom when users need to discover dynamically-created rooms

**Common Pitfall — Duplicate Messages:**
```typescript
// WRONG: event handler + manual setState = duplicate
async sendMessage(payload: { text: string }) {
  const room = this.$room(ChatRoom, roomId)
  room.addMessage(user, text)  // emits 'chat:message' → handler updates state
  // DON'T also do: this.setState({ messages: [...msgs, msg] })
}

// CORRECT: let the event handler do all the work
async sendMessage(payload: { text: string }) {
  const room = this.$room(ChatRoom, roomId)
  room.addMessage(user, text)  // event handler catches it for ALL members
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `app/server/live/rooms/ChatRoom.ts` | Example typed room with password support |
| `app/server/live/rooms/DirectoryRoom.ts` | Shared room directory for discovery |
| `app/server/live/LiveRoomChat.ts` | Chat component using typed rooms |
| `app/client/src/live/RoomChatDemo.tsx` | Frontend React component |
| `core/server/live/websocket-plugin.ts` | Room auto-discovery and LiveServer setup |

### @fluxstack/live Package Files

| File | Purpose |
|------|---------|
| `packages/core/src/rooms/LiveRoom.ts` | LiveRoom base class |
| `packages/core/src/rooms/RoomRegistry.ts` | Room type → class mapping |
| `packages/core/src/rooms/LiveRoomManager.ts` | Room membership, broadcasting, lifecycle |
| `packages/core/src/component/managers/ComponentRoomProxy.ts` | `$room` proxy (typed + untyped) |
| `packages/core/src/server/LiveServer.ts` | Server-side join enforcement |

## Related

- [Live Components](./live-components.md) - Base component system
- [Live Auth](./live-auth.md) - Authentication for Live Components
- [Routes with Eden Treaty](./routes-eden.md) - HTTP API patterns
- [Type Safety](../patterns/type-safety.md) - TypeScript patterns
