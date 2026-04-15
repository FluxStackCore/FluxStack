# Live Components Authentication

**Version:** 1.19.0 | **Updated:** 2026-04-14

## Quick Facts

- **`publicActions` is the foundation** - Only whitelisted methods can be called remotely
- Declarative auth via `static auth` and `static actionAuth`
- Custom `authorize()` function for any logic (DB checks, plans, feature flags)
- Role-based (OR logic) and permission-based (AND logic) access control
- `$auth.session` — generic session data (user, bot, device, service — dev defines)
- Token always sent inside WebSocket (never in URL)
- Auto re-mount when authentication changes
- `$auth` available on frontend with session data from server

## Auth Approaches

Two ways to handle auth — use either or both:

### 1. Provider + `authenticate()` (framework-managed)

Global auth for the WebSocket connection. All components share the same `$auth`.

```typescript
// Server: create provider
class JWTProvider implements LiveAuthProvider {
  readonly name = 'jwt'
  async authenticate(credentials: LiveAuthCredentials) {
    const decoded = jwt.verify(credentials.token, SECRET)
    return new AuthenticatedContext({
      id: decoded.sub,
      name: decoded.name,
      plan: decoded.plan,
      roles: decoded.roles,
      permissions: decoded.permissions,
    })
  }
}

// Server: register
liveAuthManager.register(new JWTProvider())

// Client: login
const { authenticate } = useLiveComponents()
await authenticate({ token: jwtToken })
```

### 2. Action + `$private` (component-managed)

Auth inside the component itself. No provider needed.

```typescript
// Server
export class LiveChat extends LiveComponent<
  { messages: Message[] },               // state: client reads/writes
  { loggedIn: boolean; odId: string }    // $private: invisible to client
> {
  static publicActions = ['login', 'sendMessage'] as const

  async login(payload: { email: string; password: string }) {
    const user = await db.findByEmail(payload.email)
    if (!user) return { success: false }
    this.$private.loggedIn = true
    this.$private.odId = user.id
    return { success: true, name: user.name }
  }

  async sendMessage(payload: { text: string }) {
    if (!this.$private.loggedIn) throw new Error('Not authenticated')
    // ...
  }
}

// Client
const chat = Live.use(LiveChat)
const result = await chat.login({ email, password })
```

## Server-Side: Protected Components

### Basic Protection

```typescript
export class ProtectedChat extends LiveComponent<State> {
  static componentName = 'ProtectedChat'
  static publicActions = ['sendMessage'] as const
  static defaultState = { messages: [] as string[] }

  static auth = { required: true }

  async sendMessage(payload: { text: string }) {
    const userId = this.$auth.session?.id
    return { success: true }
  }
}
```

### Role-Based Protection

```typescript
export class AdminPanel extends LiveComponent<State> {
  static componentName = 'AdminPanel'
  static publicActions = ['deleteUser'] as const
  static defaultState = { users: [] }

  // OR logic: admin OR moderator
  static auth = { required: true, roles: ['admin', 'moderator'] }

  async deleteUser(payload: { userId: string }) {
    console.log(`${this.$auth.session?.id} deleting ${payload.userId}`)
    return { success: true }
  }
}
```

### Permission-Based Protection

```typescript
export class ContentEditor extends LiveComponent<State> {
  static componentName = 'ContentEditor'
  static publicActions = ['editContent'] as const
  static defaultState = { content: '' }

  // AND logic: ALL permissions required
  static auth = { required: true, permissions: ['content.read', 'content.write'] }
}
```

### Custom `authorize()` Function

For any logic beyond roles/permissions — DB lookups, plan checks, feature flags, etc.

```typescript
export class ProDashboard extends LiveComponent<State> {
  static componentName = 'ProDashboard'
  static publicActions = ['getData'] as const

  static auth = {
    required: true,
    // Runs AFTER declarative checks (required, roles, permissions)
    authorize: async (auth) => {
      const plan = await db.getUserPlan(auth.session?.id)
      if (plan !== 'pro') {
        return { allowed: false, reason: 'Pro plan required' }
      }
      return true
    }
  }
}
```

### Per-Action Protection

```typescript
export class ModerationPanel extends LiveComponent<State> {
  static componentName = 'ModerationPanel'
  static publicActions = ['getReports', 'deleteReport', 'banUser'] as const

  static auth = { required: true }

  static actionAuth = {
    deleteReport: { permissions: ['reports.delete'] },
    banUser: { roles: ['admin', 'moderator'] },
  }

  // Action authorize receives the payload
  static actionAuth = {
    editProfile: {
      authorize: (auth, payload) => auth.session?.id === payload.userId
    },
    adminDelete: {
      roles: ['admin'],
      authorize: async (auth, payload) => {
        if (payload.itemId === 'protected') {
          return { allowed: false, reason: 'Item is protected' }
        }
        return true
      }
    },
  }
}
```

### Reusable Auth Rules

Auth configs are plain objects — compose and reuse them:

```typescript
// auth/rules.ts
export const adminOnly = { required: true, roles: ['admin'] }
export const proOnly = {
  required: true,
  authorize: async (auth) => {
    const plan = await db.getUserPlan(auth.session?.id)
    return plan === 'pro'
  }
}
export const ownerOnly = (field = 'userId') => ({
  authorize: (auth, payload) => auth.session?.id === payload?.[field]
})

// Components import and use
export class LiveAdminPanel extends LiveComponent<State> {
  static auth = adminOnly
  static actionAuth = { delete: ownerOnly('targetUserId') }
}
```

## Using `$auth` in Actions

```typescript
export class MyComponent extends LiveComponent<State> {
  async myAction() {
    // Session data (shape defined by your provider)
    const id = this.$auth.session?.id
    const name = this.$auth.session?.name
    const plan = this.$auth.session?.plan

    // Built-in helpers
    this.$auth.authenticated          // boolean
    this.$auth.hasRole('admin')       // boolean
    this.$auth.hasAnyRole(['admin', 'mod'])
    this.$auth.hasAllRoles(['user', 'verified'])
    this.$auth.hasPermission('chat.write')
    this.$auth.hasAllPermissions(['users.read', 'users.write'])
    this.$auth.hasAnyPermission(['chat.read', 'chat.write'])

    return { id }
  }
}
```

### `$auth` API

```typescript
interface LiveAuthContext {
  readonly authenticated: boolean
  readonly session?: LiveAuthSession  // dev defines the shape
  readonly user?: LiveAuthSession     // deprecated alias for session
  readonly token?: string
  readonly authenticatedAt?: number

  hasRole(role: string): boolean
  hasAnyRole(roles: string[]): boolean
  hasAllRoles(roles: string[]): boolean
  hasPermission(permission: string): boolean
  hasAnyPermission(permissions: string[]): boolean
  hasAllPermissions(permissions: string[]): boolean
}

interface LiveAuthSession {
  id: string
  roles?: string[]
  permissions?: string[]
  [key: string]: unknown  // dev adds any fields
}
```

## State Security Levels

```
this.state       → client reads AND writes (bidirectional sync)
this.$private    → client NEVER sees (server-only)
this.$auth       → set by framework, immutable, read-only
```

Use `$private` for sensitive flags (loggedIn, internal IDs). Use `state` for display data. Never trust `state` for security — the client can send `PROPERTY_UPDATE` to modify it.

## Client-Side: Authentication

### Authenticate on Connection

```tsx
<LiveComponentsProvider
  auth={{ token }}  // Sent via AUTH message inside WebSocket (never in URL)
  autoConnect={true}
>
  <App />
</LiveComponentsProvider>
```

### Dynamic Authentication

```tsx
function LoginForm() {
  const { authenticated, authenticate, $auth } = useLiveComponents()

  const handleLogin = async () => {
    const success = await authenticate({ token })
    // Components with AUTH_DENIED auto re-mount
  }

  // Session data from the server
  console.log($auth.session?.name)

  const handleLogout = () => reconnect() // reconnect without token = anonymous
}
```

### Auth in Component Proxy

```tsx
const panel = Live.use(AdminPanel)

panel.$authenticated        // boolean
panel.$auth.authenticated   // boolean
panel.$auth.session         // { id, name, roles, ... } or null

if (panel.$error?.includes('AUTH_DENIED')) {
  return <p>Access denied</p>
}
```

### Auto Re-mount on Auth Change

```
1. Live.use(AdminPanel) → AUTH_DENIED (not logged in)
2. authenticate({ token: 'admin-token' })
3. AdminPanel re-mounts automatically
```

## Auth Providers

### DevAuthProvider (Used in FluxStack App)

The FluxStack app ships with a `DevAuthProvider` for development/testing. It accepts hardcoded tokens and maps them to pre-defined users with roles and permissions. Registered in `app/server/index.ts`.

**File:** `app/server/auth/DevAuthProvider.ts`

```typescript
import type { LiveAuthProvider, LiveAuthCredentials, LiveAuthContext } from '@fluxstack/live'
import { AuthenticatedContext } from '@fluxstack/live'

const DEV_USERS: Record<string, DevUser> = {
  'admin-token': {
    id: 'admin-1',
    name: 'Admin User',
    roles: ['admin', 'user'],
    permissions: ['users.read', 'users.write', 'users.delete', 'chat.read', 'chat.write', 'chat.admin'],
  },
  'user-token': {
    id: 'user-1',
    name: 'Regular User',
    roles: ['user'],
    permissions: ['chat.read', 'chat.write'],
  },
  'mod-token': {
    id: 'mod-1',
    name: 'Moderator',
    roles: ['moderator', 'user'],
    permissions: ['chat.read', 'chat.write', 'chat.moderate'],
  },
}

export class DevAuthProvider implements LiveAuthProvider {
  readonly name = 'dev'

  async authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null> {
    const token = credentials.token as string
    if (!token) return null
    const user = DEV_USERS[token]
    if (!user) return null
    return new AuthenticatedContext({
      id: user.id,
      name: user.name,
      roles: user.roles,
      permissions: user.permissions,
    }, token)
  }
}
```

**Registration** (`app/server/index.ts`):

```typescript
import { DevAuthProvider } from "./auth/DevAuthProvider"
registerAuthProvider(new DevAuthProvider())
```

**Client usage** (authenticate with a dev token):

```tsx
const { authenticate } = useLiveComponents()
await authenticate({ token: 'admin-token' })  // admin with all permissions
await authenticate({ token: 'user-token' })   // regular user
await authenticate({ token: 'mod-token' })     // moderator
```

> **WARNING:** DevAuthProvider is for development only. Never use in production.

### Creating a Custom Provider

```typescript
import type { LiveAuthProvider, LiveAuthCredentials, LiveAuthContext } from '@fluxstack/live'
import { AuthenticatedContext } from '@fluxstack/live'

export class MyAuthProvider implements LiveAuthProvider {
  readonly name = 'my-auth'

  async authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null> {
    const token = credentials.token as string
    if (!token) return null

    const user = await validateToken(token)
    if (!user) return null

    // Everything here goes to $auth.session
    return new AuthenticatedContext({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan,
      roles: user.roles,
      permissions: user.permissions,
    }, token)
  }

  // Optional: custom action authorization
  async authorizeAction(context: LiveAuthContext, componentName: string, action: string): Promise<boolean> {
    return true
  }

  // Optional: custom room authorization
  async authorizeRoom(context: LiveAuthContext, roomId: string): Promise<boolean> {
    if (roomId.startsWith('vip-') && !context.hasRole('premium')) return false
    return true
  }
}
```

### Non-User Sessions (Bots, Devices, Services)

The session is generic — not limited to users:

```typescript
// Bot provider
return new AuthenticatedContext({
  id: 'bot-1',
  type: 'bot',
  botName: 'NotifyBot',
  allowedChannels: ['general', 'alerts'],
  roles: ['bot'],
})

// Device/IoT provider
return new AuthenticatedContext({
  id: 'sensor-42',
  type: 'device',
  model: 'TempSensor-v3',
  location: { lat: -23.5, lng: -46.6 },
  roles: ['device'],
})
```

### Registering Providers

```typescript
// app/server/index.ts
import { liveAuthManager } from '@core/server/live'
liveAuthManager.register(new MyAuthProvider())
```

## Security Layers (Action Execution Order)

1. **Blocklist** - Internal methods (destroy, setState, emit) always blocked
2. **Private methods** - `_x` or `#x` blocked
3. **publicActions** - Must be in whitelist (mandatory)
4. **actionAuth** - Declarative roles/permissions + custom `authorize()`
5. **Method exists** - Must exist on instance
6. **Object.prototype** - toString, valueOf blocked

## Auth Verification Cascade

### Mount (component):
```
1. static auth.required?      → authenticated?
2. static auth.roles?         → hasAnyRole() (OR)
3. static auth.permissions?   → hasAllPermissions() (AND)
4. static auth.authorize?     → custom function
   All pass → mount allowed
```

### Action:
```
1. actionAuth[action].roles?       → hasAnyRole() (OR)
2. actionAuth[action].permissions? → hasAllPermissions() (AND)
3. actionAuth[action].authorize?   → custom function(auth, payload)
4. provider.authorizeAction?       → if provider implements
   All pass → action allowed
```

## Configuration Types

```typescript
interface LiveComponentAuth {
  required?: boolean
  roles?: string[]
  permissions?: string[]
  authorize?: (auth: LiveAuthContext) => boolean | { allowed: boolean; reason?: string } | Promise<...>
}

interface LiveActionAuth {
  roles?: string[]
  permissions?: string[]
  authorize?: (auth: LiveAuthContext, payload: unknown) => boolean | { allowed: boolean; reason?: string } | Promise<...>
}

type LiveActionAuthMap = Record<string, LiveActionAuth>
```

## Critical Rules

**ALWAYS:**
- Define `static publicActions` (MANDATORY — without it, ALL actions are denied)
- Define `static auth` for protected components
- Use `$private` for sensitive data, never `state`
- Register auth providers before server starts
- Handle `AUTH_DENIED` errors in client UI

**NEVER:**
- Store auth flags in `state` (client can modify via PROPERTY_UPDATE)
- Trust client-side auth checks alone
- Expose tokens in error messages

## Real Examples from FluxStack App

The FluxStack app includes two real auth-protected Live Components that demonstrate the patterns described above.

### LiveProtectedChat (`app/server/live/LiveProtectedChat.ts`)

Requires authentication to mount. Uses per-action auth for admin operations.

```typescript
export class LiveProtectedChat extends LiveComponent<ProtectedChatState> {
  static componentName = 'LiveProtectedChat'
  static publicActions = ['join', 'sendMessage', 'deleteMessage', 'clearMessages', 'getAuthInfo'] as const

  // Component-level: requires authentication (any authenticated user)
  static auth: LiveComponentAuth = {
    required: true,
  }

  // Action-level: deleteMessage requires 'chat.admin' permission, clearMessages requires 'admin' role
  static actionAuth: LiveActionAuthMap = {
    deleteMessage: { permissions: ['chat.admin'] },
    clearMessages: { roles: ['admin'] },
  }

  // Uses $auth in actions to identify user and check roles
  async join(payload: { room: string }) {
    this.$room(payload.room).join()
    const userId = this.$auth.session?.id || this.userId || 'anonymous'
    const isAdmin = this.$auth.hasRole('admin')
    this.setState({ currentUser: userId, isAdmin })
    return { success: true, userId, isAdmin }
  }

  async sendMessage(payload: { text: string }) {
    const message = {
      id: Date.now(),
      userId: this.$auth.session?.id || this.userId || 'unknown',
      text: payload.text.trim(),
      timestamp: Date.now(),
      isAdmin: this.$auth.hasRole('admin'),
    }
    // ...
  }
}
```

### LiveAdminPanel (`app/server/live/LiveAdminPanel.ts`)

Requires authentication AND `admin` role to mount. Uses per-action permissions and audit trail.

```typescript
export class LiveAdminPanel extends LiveComponent<AdminPanelState> {
  static componentName = 'LiveAdminPanel'
  static publicActions = ['getAuthInfo', 'init', 'listUsers', 'addUser', 'deleteUser', 'clearAudit'] as const

  // Component-level: requires auth + admin role
  static auth: LiveComponentAuth = {
    required: true,
    roles: ['admin'],
  }

  // Action-level: deleteUser requires 'users.delete' permission
  static actionAuth: LiveActionAuthMap = {
    deleteUser: { permissions: ['users.delete'] },
    clearAudit: { roles: ['admin'] },
  }

  // Populates state with auth info on init
  async init() {
    this.setState({
      currentUser: this.$auth.session?.id || null,
      currentRoles: this.$auth.session?.roles || [],
      isAdmin: this.$auth.hasRole('admin'),
    })
    this.addAudit('LOGIN', this.$auth.session?.id || 'unknown')
    return { success: true }
  }

  // Audit trail using $auth.session
  async deleteUser(payload: { userId: string }) {
    const user = this.state.users.find(u => u.id === payload.userId)
    if (!user) throw new Error('User not found')
    this.setState({ users: this.state.users.filter(u => u.id !== payload.userId) })
    this.addAudit('DELETE_USER', this.$auth.session?.id || 'unknown', user.name)
    return { success: true }
  }
}
```

### Testing Auth with DevAuthProvider

To test these components in the browser:

```tsx
// 1. Authenticate as admin (has all permissions)
await authenticate({ token: 'admin-token' })
// LiveProtectedChat: mount allowed, all actions allowed
// LiveAdminPanel: mount allowed, all actions allowed

// 2. Authenticate as regular user
await authenticate({ token: 'user-token' })
// LiveProtectedChat: mount allowed, but deleteMessage/clearMessages denied
// LiveAdminPanel: mount DENIED (no 'admin' role)

// 3. Authenticate as moderator
await authenticate({ token: 'mod-token' })
// LiveProtectedChat: mount allowed, deleteMessage denied (no 'chat.admin'), clearMessages denied (no 'admin' role)
// LiveAdminPanel: mount DENIED (no 'admin' role)
```

## Related

- [Live Components](./live-components.md) - Base component documentation
- [Live Rooms](./live-rooms.md) - Room-based communication
