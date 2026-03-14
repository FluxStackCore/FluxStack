import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for Live Component Authentication System
 *
 * Validates:
 * - LiveAuthContext (authenticated vs anonymous)
 * - LiveAuthManager (provider registration, auth, authorization)
 * - LiveComponent $auth integration
 * - ComponentRegistry auth checks on mount and action execution
 */

// Import from @fluxstack/live
import { LiveComponent, setLiveComponentContext } from '@fluxstack/live'
import type { GenericWebSocket as FluxStackWebSocket } from '@fluxstack/live'
import { AuthenticatedContext, AnonymousContext, ANONYMOUS_CONTEXT } from '@fluxstack/live'
import { LiveAuthManager } from '@fluxstack/live'
import type { LiveAuthProvider, LiveAuthCredentials, LiveAuthContext, LiveComponentAuth, LiveActionAuthMap } from '@fluxstack/live'
import { RoomEventBus } from '@fluxstack/live'
import { LiveRoomManager } from '@fluxstack/live'

// Set up DI context for LiveComponent
const testRoomEvents = new RoomEventBus()
const testRoomManager = new LiveRoomManager(testRoomEvents)
setLiveComponentContext({
  roomEvents: testRoomEvents,
  roomManager: testRoomManager,
  debugger: { enabled: false, trackStateChange: () => {}, trackAction: () => {}, trackError: () => {} } as any,
})

// ===== Test Helpers =====

function createMockWs(authContext?: LiveAuthContext): FluxStackWebSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
    data: {
      connectionId: 'test-conn',
      components: new Map(),
      subscriptions: new Set(),
      connectedAt: new Date(),
      authContext
    },
    remoteAddress: '127.0.0.1',
    readyState: 1
  } as unknown as FluxStackWebSocket
}

// ===== Test Components =====

interface ChatState {
  messages: string[]
  userCount: number
}

// Public component (no auth required)
class PublicComponent extends LiveComponent<ChatState> {
  static componentName = 'PublicComponent'
  static defaultState: ChatState = { messages: [], userCount: 0 }

  async sendMessage(payload: { text: string }) {
    return { success: true }
  }
}

// Protected component (auth required)
class ProtectedComponent extends LiveComponent<ChatState> {
  static componentName = 'ProtectedComponent'
  static defaultState: ChatState = { messages: [], userCount: 0 }

  static auth: LiveComponentAuth = {
    required: true,
  }

  async sendMessage(payload: { text: string }) {
    return { success: true, userId: this.$auth.user?.id }
  }
}

// Role-protected component
class AdminComponent extends LiveComponent<ChatState> {
  static componentName = 'AdminComponent'
  static defaultState: ChatState = { messages: [], userCount: 0 }

  static auth: LiveComponentAuth = {
    required: true,
    roles: ['admin'],
  }

  async deleteAll() {
    return { success: true }
  }
}

// Permission-protected component
class PermissionComponent extends LiveComponent<ChatState> {
  static componentName = 'PermissionComponent'
  static defaultState: ChatState = { messages: [], userCount: 0 }

  static auth: LiveComponentAuth = {
    required: true,
    permissions: ['chat.read', 'chat.write'],
  }

  async sendMessage(payload: { text: string }) {
    return { success: true }
  }
}

// Component with per-action auth
class ActionAuthComponent extends LiveComponent<ChatState> {
  static componentName = 'ActionAuthComponent'
  static defaultState: ChatState = { messages: [], userCount: 0 }

  static actionAuth: LiveActionAuthMap = {
    deleteMessage: { permissions: ['chat.admin'] },
    banUser: { roles: ['admin', 'moderator'] },
  }

  async sendMessage(payload: { text: string }) {
    return { success: true }
  }

  async deleteMessage(payload: { id: number }) {
    return { success: true }
  }

  async banUser(payload: { userId: string }) {
    return { success: true }
  }
}

// ===== Mock Auth Provider =====

class MockAuthProvider implements LiveAuthProvider {
  readonly name = 'mock'
  private users: Map<string, { id: string; roles: string[]; permissions: string[] }> = new Map()

  addUser(token: string, user: { id: string; roles: string[]; permissions: string[] }) {
    this.users.set(token, user)
  }

  async authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null> {
    const token = credentials.token as string
    if (!token) return null
    const user = this.users.get(token)
    if (!user) return null
    return new AuthenticatedContext(user, token)
  }
}

// ===== Tests =====

describe('LiveAuthContext', () => {
  describe('AuthenticatedContext', () => {
    it('should report as authenticated', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', roles: ['admin'], permissions: ['read', 'write'] })
      expect(ctx.authenticated).toBe(true)
      expect(ctx.user?.id).toBe('user-1')
      expect(ctx.authenticatedAt).toBeDefined()
    })

    it('should check roles correctly', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', roles: ['admin', 'moderator'], permissions: [] })

      expect(ctx.hasRole('admin')).toBe(true)
      expect(ctx.hasRole('moderator')).toBe(true)
      expect(ctx.hasRole('user')).toBe(false)

      expect(ctx.hasAnyRole(['admin', 'user'])).toBe(true)
      expect(ctx.hasAnyRole(['user', 'guest'])).toBe(false)

      expect(ctx.hasAllRoles(['admin', 'moderator'])).toBe(true)
      expect(ctx.hasAllRoles(['admin', 'user'])).toBe(false)
    })

    it('should check permissions correctly', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', roles: [], permissions: ['chat.read', 'chat.write'] })

      expect(ctx.hasPermission('chat.read')).toBe(true)
      expect(ctx.hasPermission('chat.admin')).toBe(false)

      expect(ctx.hasAllPermissions(['chat.read', 'chat.write'])).toBe(true)
      expect(ctx.hasAllPermissions(['chat.read', 'chat.admin'])).toBe(false)

      expect(ctx.hasAnyPermission(['chat.read', 'chat.admin'])).toBe(true)
      expect(ctx.hasAnyPermission(['chat.admin', 'users.delete'])).toBe(false)
    })

    it('should handle empty roles and permissions', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1' })

      expect(ctx.hasRole('admin')).toBe(false)
      expect(ctx.hasAnyRole(['admin'])).toBe(false)
      expect(ctx.hasAllRoles([])).toBe(true)
      expect(ctx.hasPermission('read')).toBe(false)
      expect(ctx.hasAnyPermission(['read'])).toBe(false)
      expect(ctx.hasAllPermissions([])).toBe(true)
    })

    it('should store token', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1' }, 'my-token-123')
      expect(ctx.token).toBe('my-token-123')
    })
  })

  describe('AnonymousContext', () => {
    it('should report as not authenticated', () => {
      const ctx = new AnonymousContext()
      expect(ctx.authenticated).toBe(false)
      expect(ctx.user).toBeUndefined()
      expect(ctx.token).toBeUndefined()
    })

    it('should deny all role checks', () => {
      const ctx = ANONYMOUS_CONTEXT
      expect(ctx.hasRole('admin')).toBe(false)
      expect(ctx.hasAnyRole(['admin'])).toBe(false)
      expect(ctx.hasAllRoles(['admin'])).toBe(false)
    })

    it('should deny all permission checks', () => {
      const ctx = ANONYMOUS_CONTEXT
      expect(ctx.hasPermission('read')).toBe(false)
      expect(ctx.hasAnyPermission(['read'])).toBe(false)
      expect(ctx.hasAllPermissions(['read'])).toBe(false)
    })

    it('should be a singleton', () => {
      expect(ANONYMOUS_CONTEXT).toBeInstanceOf(AnonymousContext)
    })
  })
})

describe('LiveAuthManager', () => {
  let manager: LiveAuthManager
  let mockProvider: MockAuthProvider

  beforeEach(() => {
    manager = new LiveAuthManager()
    mockProvider = new MockAuthProvider()
    mockProvider.addUser('valid-token', { id: 'user-1', roles: ['user'], permissions: ['read'] })
    mockProvider.addUser('admin-token', { id: 'admin-1', roles: ['admin', 'user'], permissions: ['read', 'write', 'admin'] })
  })

  describe('Provider Registration', () => {
    it('should register a provider', () => {
      manager.register(mockProvider)
      expect(manager.hasProviders()).toBe(true)
      expect(manager.getInfo().providers).toContain('mock')
    })

    it('should set first provider as default', () => {
      manager.register(mockProvider)
      expect(manager.getInfo().defaultProvider).toBe('mock')
    })

    it('should unregister a provider', () => {
      manager.register(mockProvider)
      manager.unregister('mock')
      expect(manager.hasProviders()).toBe(false)
    })

    it('should change default provider', () => {
      manager.register(mockProvider)
      const secondProvider: LiveAuthProvider = { name: 'second', authenticate: async () => null }
      manager.register(secondProvider)

      manager.setDefault('second')
      expect(manager.getInfo().defaultProvider).toBe('second')
    })

    it('should throw when setting non-existent default', () => {
      expect(() => manager.setDefault('nonexistent')).toThrow("Auth provider 'nonexistent' not registered")
    })
  })

  describe('Authentication', () => {
    beforeEach(() => {
      manager.register(mockProvider)
    })

    it('should authenticate with valid credentials', async () => {
      const ctx = await manager.authenticate({ token: 'valid-token' })
      expect(ctx.authenticated).toBe(true)
      expect(ctx.user?.id).toBe('user-1')
    })

    it('should return anonymous for invalid credentials', async () => {
      const ctx = await manager.authenticate({ token: 'invalid-token' })
      expect(ctx.authenticated).toBe(false)
    })

    it('should return anonymous for empty credentials', async () => {
      const ctx = await manager.authenticate({})
      expect(ctx.authenticated).toBe(false)
    })

    it('should return anonymous when no providers registered', async () => {
      const emptyManager = new LiveAuthManager()
      const ctx = await emptyManager.authenticate({ token: 'some-token' })
      expect(ctx.authenticated).toBe(false)
    })

    it('should authenticate via specific provider name', async () => {
      const ctx = await manager.authenticate({ token: 'valid-token' }, 'mock')
      expect(ctx.authenticated).toBe(true)
    })

    it('should return anonymous for unknown provider name', async () => {
      const ctx = await manager.authenticate({ token: 'valid-token' }, 'unknown')
      expect(ctx.authenticated).toBe(false)
    })
  })

  describe('Component Authorization', () => {
    it('should allow public component (no auth config)', () => {
      const ctx = ANONYMOUS_CONTEXT
      const result = manager.authorizeComponent(ctx, undefined)
      expect(result.allowed).toBe(true)
    })

    it('should deny unauthenticated user on required component', () => {
      const ctx = ANONYMOUS_CONTEXT
      const result = manager.authorizeComponent(ctx, { required: true })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Authentication required')
    })

    it('should allow authenticated user on required component', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1' })
      const result = manager.authorizeComponent(ctx, { required: true })
      expect(result.allowed).toBe(true)
    })

    it('should deny user without required role', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', roles: ['user'] })
      const result = manager.authorizeComponent(ctx, { roles: ['admin'] })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient roles')
    })

    it('should allow user with any of the required roles (OR logic)', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', roles: ['moderator'] })
      const result = manager.authorizeComponent(ctx, { roles: ['admin', 'moderator'] })
      expect(result.allowed).toBe(true)
    })

    it('should deny user without all required permissions', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', permissions: ['chat.read'] })
      const result = manager.authorizeComponent(ctx, { permissions: ['chat.read', 'chat.write'] })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient permissions')
    })

    it('should allow user with all required permissions (AND logic)', () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', permissions: ['chat.read', 'chat.write'] })
      const result = manager.authorizeComponent(ctx, { permissions: ['chat.read', 'chat.write'] })
      expect(result.allowed).toBe(true)
    })

    it('should deny anonymous for role-protected component', () => {
      const ctx = ANONYMOUS_CONTEXT
      const result = manager.authorizeComponent(ctx, { roles: ['admin'] })
      expect(result.allowed).toBe(false)
    })

    it('should deny anonymous for permission-protected component', () => {
      const ctx = ANONYMOUS_CONTEXT
      const result = manager.authorizeComponent(ctx, { permissions: ['chat.read'] })
      expect(result.allowed).toBe(false)
    })
  })

  describe('Action Authorization', () => {
    beforeEach(() => {
      manager.register(mockProvider)
    })

    it('should allow action without auth config', async () => {
      const ctx = ANONYMOUS_CONTEXT
      const result = await manager.authorizeAction(ctx, 'TestComponent', 'sendMessage', undefined)
      expect(result.allowed).toBe(true)
    })

    it('should deny action when user lacks required permissions', async () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', permissions: ['chat.read'] })
      const result = await manager.authorizeAction(ctx, 'TestComponent', 'deleteMessage', {
        permissions: ['chat.admin']
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient permissions')
      expect(result.reason).toContain('deleteMessage')
    })

    it('should allow action when user has required permissions', async () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', permissions: ['chat.admin'] })
      const result = await manager.authorizeAction(ctx, 'TestComponent', 'deleteMessage', {
        permissions: ['chat.admin']
      })
      expect(result.allowed).toBe(true)
    })

    it('should deny action when user lacks required role', async () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', roles: ['user'] })
      const result = await manager.authorizeAction(ctx, 'TestComponent', 'banUser', {
        roles: ['admin', 'moderator']
      })
      expect(result.allowed).toBe(false)
    })

    it('should allow action when user has any required role (OR logic)', async () => {
      const ctx = new AuthenticatedContext({ id: 'user-1', roles: ['moderator'] })
      const result = await manager.authorizeAction(ctx, 'TestComponent', 'banUser', {
        roles: ['admin', 'moderator']
      })
      expect(result.allowed).toBe(true)
    })

    it('should deny anonymous for action requiring auth', async () => {
      const ctx = ANONYMOUS_CONTEXT
      const result = await manager.authorizeAction(ctx, 'TestComponent', 'deleteMessage', {
        permissions: ['chat.admin']
      })
      expect(result.allowed).toBe(false)
    })
  })

  describe('Room Authorization', () => {
    it('should allow room access when no provider implements authorizeRoom', async () => {
      manager.register(mockProvider)
      const ctx = new AuthenticatedContext({ id: 'user-1' })
      const result = await manager.authorizeRoom(ctx, 'general')
      expect(result.allowed).toBe(true)
    })

    it('should allow room access when no providers registered', async () => {
      const ctx = new AuthenticatedContext({ id: 'user-1' })
      const result = await manager.authorizeRoom(ctx, 'general')
      expect(result.allowed).toBe(true)
    })
  })
})

describe('LiveComponent $auth Integration', () => {
  let ws: FluxStackWebSocket

  beforeEach(() => {
    ws = createMockWs()
  })

  it('should default to anonymous context', () => {
    const component = new PublicComponent({}, ws)
    expect(component.$auth.authenticated).toBe(false)
    expect(component.$auth.user).toBeUndefined()
  })

  it('should accept injected auth context via setAuthContext', () => {
    const component = new PublicComponent({}, ws)
    const authCtx = new AuthenticatedContext({ id: 'user-1', roles: ['admin'], permissions: ['read'] })
    component.setAuthContext(authCtx)

    expect(component.$auth.authenticated).toBe(true)
    expect(component.$auth.user?.id).toBe('user-1')
    expect(component.$auth.hasRole('admin')).toBe(true)
    expect(component.$auth.hasPermission('read')).toBe(true)
  })

  it('should set userId from auth context when not already set', () => {
    const component = new PublicComponent({}, ws)
    const authCtx = new AuthenticatedContext({ id: 'user-42' })
    component.setAuthContext(authCtx)

    expect(component.userId).toBe('user-42')
  })

  it('should not overwrite existing userId', () => {
    const component = new PublicComponent({}, ws, { userId: 'existing-user' })
    const authCtx = new AuthenticatedContext({ id: 'new-user' })
    component.setAuthContext(authCtx)

    expect(component.userId).toBe('existing-user')
  })

  it('should expose auth helpers in component actions', () => {
    const component = new ProtectedComponent({}, ws)
    const authCtx = new AuthenticatedContext({
      id: 'user-1',
      roles: ['admin', 'user'],
      permissions: ['chat.read', 'chat.write']
    })
    component.setAuthContext(authCtx)

    expect(component.$auth.hasRole('admin')).toBe(true)
    expect(component.$auth.hasRole('guest')).toBe(false)
    expect(component.$auth.hasAnyRole(['admin', 'guest'])).toBe(true)
    expect(component.$auth.hasAllPermissions(['chat.read', 'chat.write'])).toBe(true)
    expect(component.$auth.hasAllPermissions(['chat.read', 'chat.admin'])).toBe(false)
  })

  it('should read static auth config from component class', () => {
    expect(ProtectedComponent.auth).toEqual({ required: true })
    expect(AdminComponent.auth).toEqual({ required: true, roles: ['admin'] })
    expect(PermissionComponent.auth).toEqual({ required: true, permissions: ['chat.read', 'chat.write'] })
    expect(PublicComponent.auth).toBeUndefined()
  })

  it('should read static actionAuth config from component class', () => {
    expect(ActionAuthComponent.actionAuth).toBeDefined()
    expect(ActionAuthComponent.actionAuth!.deleteMessage).toEqual({ permissions: ['chat.admin'] })
    expect(ActionAuthComponent.actionAuth!.banUser).toEqual({ roles: ['admin', 'moderator'] })
  })
})

describe('ComponentRegistry Auth Integration', () => {
  // These tests validate that ComponentRegistry correctly uses auth checks.
  // We test through the LiveAuthManager directly since the registry calls it.

  let manager: LiveAuthManager
  let mockProvider: MockAuthProvider

  beforeEach(() => {
    manager = new LiveAuthManager()
    mockProvider = new MockAuthProvider()
    mockProvider.addUser('user-token', { id: 'user-1', roles: ['user'], permissions: ['chat.read'] })
    mockProvider.addUser('admin-token', { id: 'admin-1', roles: ['admin', 'user'], permissions: ['chat.read', 'chat.write', 'chat.admin'] })
    manager.register(mockProvider)
  })

  describe('Mount authorization flow', () => {
    it('should allow anonymous on public component', () => {
      const result = manager.authorizeComponent(ANONYMOUS_CONTEXT, PublicComponent.auth)
      expect(result.allowed).toBe(true)
    })

    it('should deny anonymous on protected component', () => {
      const result = manager.authorizeComponent(ANONYMOUS_CONTEXT, ProtectedComponent.auth)
      expect(result.allowed).toBe(false)
    })

    it('should allow authenticated user on protected component', async () => {
      const ctx = await manager.authenticate({ token: 'user-token' })
      const result = manager.authorizeComponent(ctx, ProtectedComponent.auth)
      expect(result.allowed).toBe(true)
    })

    it('should deny non-admin on admin component', async () => {
      const ctx = await manager.authenticate({ token: 'user-token' })
      const result = manager.authorizeComponent(ctx, AdminComponent.auth)
      expect(result.allowed).toBe(false)
    })

    it('should allow admin on admin component', async () => {
      const ctx = await manager.authenticate({ token: 'admin-token' })
      const result = manager.authorizeComponent(ctx, AdminComponent.auth)
      expect(result.allowed).toBe(true)
    })

    it('should deny user without all required permissions', async () => {
      const ctx = await manager.authenticate({ token: 'user-token' }) // only chat.read
      const result = manager.authorizeComponent(ctx, PermissionComponent.auth)
      expect(result.allowed).toBe(false)
    })

    it('should allow user with all required permissions', async () => {
      const ctx = await manager.authenticate({ token: 'admin-token' }) // has chat.read + chat.write
      const result = manager.authorizeComponent(ctx, PermissionComponent.auth)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Action authorization flow', () => {
    it('should allow unprotected action for any user', async () => {
      const result = await manager.authorizeAction(
        ANONYMOUS_CONTEXT,
        'ActionAuthComponent',
        'sendMessage',
        ActionAuthComponent.actionAuth?.sendMessage
      )
      expect(result.allowed).toBe(true)
    })

    it('should deny deleteMessage without chat.admin permission', async () => {
      const ctx = await manager.authenticate({ token: 'user-token' }) // only chat.read
      const result = await manager.authorizeAction(
        ctx,
        'ActionAuthComponent',
        'deleteMessage',
        ActionAuthComponent.actionAuth?.deleteMessage
      )
      expect(result.allowed).toBe(false)
    })

    it('should allow deleteMessage with chat.admin permission', async () => {
      const ctx = await manager.authenticate({ token: 'admin-token' }) // has chat.admin
      const result = await manager.authorizeAction(
        ctx,
        'ActionAuthComponent',
        'deleteMessage',
        ActionAuthComponent.actionAuth?.deleteMessage
      )
      expect(result.allowed).toBe(true)
    })

    it('should deny banUser without admin or moderator role', async () => {
      const ctx = await manager.authenticate({ token: 'user-token' }) // only 'user' role
      const result = await manager.authorizeAction(
        ctx,
        'ActionAuthComponent',
        'banUser',
        ActionAuthComponent.actionAuth?.banUser
      )
      expect(result.allowed).toBe(false)
    })

    it('should allow banUser with admin role', async () => {
      const ctx = await manager.authenticate({ token: 'admin-token' }) // has 'admin' role
      const result = await manager.authorizeAction(
        ctx,
        'ActionAuthComponent',
        'banUser',
        ActionAuthComponent.actionAuth?.banUser
      )
      expect(result.allowed).toBe(true)
    })
  })
})
