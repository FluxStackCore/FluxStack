import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * 🔥 DX Enhancement Tests for Live Components
 *
 * Tests for:
 * 1. Lifecycle hooks (onMount, onDestroy)
 * 2. HMR persistence (static persistent + $persistent)
 * 3. Better publicActions error messages
 * 4. Singleton/shared component pattern
 */

// Mock the room dependencies before importing
vi.mock('@core/server/live/RoomEventBus', () => ({
  roomEvents: {
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn()
  }
}))

vi.mock('@core/server/live/LiveRoomManager', () => ({
  liveRoomManager: {
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    emitToRoom: vi.fn(),
    getRoomState: vi.fn(() => ({})),
    setRoomState: vi.fn()
  }
}))

// Import after mocks
import { LiveComponent } from '@core/types/types'
import type { FluxStackWebSocket } from '@core/types/types'

// ===== Test Helpers =====

function createMockWs(connectionId = 'test-conn'): FluxStackWebSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
    data: {
      connectionId,
      components: new Map(),
      subscriptions: new Set(),
      connectedAt: new Date()
    },
    remoteAddress: '127.0.0.1',
    readyState: 1
  } as unknown as FluxStackWebSocket
}

function getLastSentMessage(ws: FluxStackWebSocket): any {
  const sendMock = ws.send as ReturnType<typeof vi.fn>
  const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1]
  return lastCall ? JSON.parse(lastCall[0]) : null
}

// ===== Test Components =====

interface CounterState {
  count: number
  label: string
}

// Component with lifecycle hooks
class LifecycleComponent extends LiveComponent<CounterState> {
  static componentName = 'LifecycleComponent'
  static defaultState: CounterState = { count: 0, label: 'test' }
  static publicActions = ['increment'] as const

  mountCalled = false
  destroyCalled = false
  mountOrder: string[] = []

  protected onMount() {
    this.mountCalled = true
    this.mountOrder.push('onMount')
  }

  protected onDestroy() {
    this.destroyCalled = true
    this.mountOrder.push('onDestroy')
  }

  async increment() {
    this.state.count++
    return { count: this.state.count }
  }
}

// Component with async onMount
class AsyncLifecycleComponent extends LiveComponent<CounterState> {
  static componentName = 'AsyncLifecycleComponent'
  static defaultState: CounterState = { count: 0, label: 'async' }
  static publicActions = ['increment'] as const

  initData: string | null = null

  protected async onMount() {
    // Simulate async initialization
    await new Promise(resolve => setTimeout(resolve, 10))
    this.initData = 'initialized'
    this.state.label = 'ready'
  }

  async increment() {
    this.state.count++
    return { count: this.state.count }
  }
}

// Component with HMR persistence
class PersistentComponent extends LiveComponent<CounterState> {
  static componentName = 'PersistentComponent'
  static defaultState: CounterState = { count: 0, label: 'persistent' }
  static publicActions = ['increment'] as const
  static persistent = {
    cache: {} as Record<string, any>,
    runCount: 0
  }

  protected onMount() {
    this.$persistent.runCount++
  }

  async increment() {
    this.state.count++
    return { count: this.state.count }
  }
}

// Component with missing publicActions entry (for error message test)
class PartialActionsComponent extends LiveComponent<CounterState> {
  static componentName = 'PartialActionsComponent'
  static defaultState: CounterState = { count: 0, label: 'partial' }
  static publicActions = ['increment'] as const  // Missing 'decrement'

  async increment() {
    this.state.count++
    return { count: this.state.count }
  }

  async decrement() {
    this.state.count--
    return { count: this.state.count }
  }
}

// Singleton component
class SingletonComponent extends LiveComponent<CounterState> {
  static componentName = 'SingletonComponent'
  static defaultState: CounterState = { count: 0, label: 'singleton' }
  static publicActions = ['increment'] as const
  static singleton = true

  async increment() {
    this.state.count++
    return { count: this.state.count }
  }
}

// =============================================
// TESTS
// =============================================

describe('LiveComponent DX Enhancements', () => {

  // ===== Lifecycle Hooks =====
  describe('Lifecycle Hooks', () => {
    it('onMount is called and has access to component state', () => {
      const ws = createMockWs()
      const component = new LifecycleComponent({ count: 5, label: 'init' }, ws)

      // onMount is not called by constructor — it's called by the registry after setup
      expect(component.mountCalled).toBe(false)

      // Simulate registry calling onMount
      ;(component as any).onMount()
      expect(component.mountCalled).toBe(true)
      expect(component.state.count).toBe(5)
    })

    it('onDestroy is called during destroy()', () => {
      const ws = createMockWs()
      const component = new LifecycleComponent({ count: 0, label: 'test' }, ws)

      expect(component.destroyCalled).toBe(false)

      component.destroy()
      expect(component.destroyCalled).toBe(true)
    })

    it('onDestroy is called before internal cleanup', () => {
      const ws = createMockWs()
      const component = new LifecycleComponent({ count: 0, label: 'test' }, ws)

      component.destroy()
      expect(component.mountOrder).toContain('onDestroy')
    })

    it('async onMount works correctly', async () => {
      const ws = createMockWs()
      const component = new AsyncLifecycleComponent({ count: 0, label: 'loading' }, ws)

      expect(component.initData).toBeNull()

      // Simulate async onMount
      await (component as any).onMount()
      expect(component.initData).toBe('initialized')
    })

    it('onDestroy errors do not prevent cleanup', () => {
      const ws = createMockWs()

      class ErrorComponent extends LiveComponent<CounterState> {
        static componentName = 'ErrorComponent'
        static defaultState: CounterState = { count: 0, label: 'error' }

        protected onDestroy() {
          throw new Error('Cleanup error')
        }
      }

      const component = new ErrorComponent({}, ws)

      // Should not throw even though onDestroy throws
      expect(() => component.destroy()).not.toThrow()
    })

    it('default onMount and onDestroy are no-ops', () => {
      const ws = createMockWs()

      class BasicComponent extends LiveComponent<CounterState> {
        static componentName = 'BasicComponent'
        static defaultState: CounterState = { count: 0, label: 'basic' }
      }

      const component = new BasicComponent({}, ws)

      // Should not throw
      expect(() => (component as any).onMount()).not.toThrow()
      expect(() => component.destroy()).not.toThrow()
    })
  })

  // ===== HMR Persistence =====
  describe('HMR Persistence', () => {
    afterEach(() => {
      // Clean up globalThis
      delete (globalThis as any).__fluxstack_persistent_PersistentComponent
    })

    it('$persistent returns an object with defaults from static persistent', () => {
      const ws = createMockWs()
      const component = new PersistentComponent({}, ws)

      expect(component.$persistent).toBeDefined()
      expect(component.$persistent.runCount).toBe(0)
      expect(component.$persistent.cache).toEqual({})
    })

    it('$persistent data survives across instances (simulates HMR)', () => {
      const ws = createMockWs()

      // First instance
      const comp1 = new PersistentComponent({}, ws)
      comp1.$persistent.runCount = 5
      comp1.$persistent.cache['key1'] = 'value1'

      // Second instance (simulates HMR reload)
      const comp2 = new PersistentComponent({}, ws)

      // Data should persist via globalThis
      expect(comp2.$persistent.runCount).toBe(5)
      expect(comp2.$persistent.cache['key1']).toBe('value1')
    })

    it('different component classes have separate persistent stores', () => {
      const ws = createMockWs()

      class OtherPersistent extends LiveComponent<CounterState> {
        static componentName = 'OtherPersistent'
        static defaultState: CounterState = { count: 0, label: 'other' }
        static persistent = { value: 'default' }
      }

      const comp1 = new PersistentComponent({}, ws)
      comp1.$persistent.runCount = 99

      const comp2 = new OtherPersistent({}, ws)

      // Different namespace
      expect(comp2.$persistent.value).toBe('default')
      expect(comp2.$persistent.runCount).toBeUndefined()

      // Clean up
      delete (globalThis as any).__fluxstack_persistent_OtherPersistent
    })

    it('$persistent works with onMount lifecycle', () => {
      const ws = createMockWs()

      const comp1 = new PersistentComponent({}, ws)
      ;(comp1 as any).onMount()
      expect(comp1.$persistent.runCount).toBe(1)

      // Simulate HMR - new instance
      const comp2 = new PersistentComponent({}, ws)
      ;(comp2 as any).onMount()
      expect(comp2.$persistent.runCount).toBe(2)
    })

    it('component without static persistent gets empty $persistent', () => {
      const ws = createMockWs()

      class NoPersistent extends LiveComponent<CounterState> {
        static componentName = 'NoPersistent'
        static defaultState: CounterState = { count: 0, label: 'none' }
      }

      const component = new NoPersistent({}, ws)
      expect(component.$persistent).toEqual({})

      // Still works - can add data
      component.$persistent.someKey = 'someValue'
      expect(component.$persistent.someKey).toBe('someValue')

      // Clean up
      delete (globalThis as any).__fluxstack_persistent_NoPersistent
    })
  })

  // ===== Better publicActions Error Messages =====
  describe('publicActions Error Messages', () => {
    it('gives helpful error when method exists but not in publicActions', async () => {
      const ws = createMockWs()
      const component = new PartialActionsComponent({}, ws)

      try {
        await component.executeAction('decrement', {})
        expect.unreachable('Should have thrown')
      } catch (err: any) {
        // Should mention the action name, component name, and suggest adding to publicActions
        expect(err.message).toContain('decrement')
        expect(err.message).toContain('PartialActionsComponent')
        expect(err.message).toContain('publicActions')
        expect(err.message).toContain("'decrement'")
      }
    })

    it('gives generic error when method does not exist at all', async () => {
      const ws = createMockWs()
      const component = new PartialActionsComponent({}, ws)

      try {
        await component.executeAction('nonexistent', {})
        expect.unreachable('Should have thrown')
      } catch (err: any) {
        // Generic error - no helpful suggestion since method doesn't exist
        expect(err.message).toContain('not callable')
        expect(err.message).not.toContain('publicActions')
      }
    })

    it('whitelisted actions still work normally', async () => {
      const ws = createMockWs()
      const component = new PartialActionsComponent({ count: 0, label: 'test' }, ws)

      const result = await component.executeAction('increment', {})
      expect(result).toEqual({ count: 1 })
    })
  })

  // ===== Singleton Pattern =====
  describe('Singleton Pattern', () => {
    it('static singleton is declared on the class', () => {
      expect((SingletonComponent as any).singleton).toBe(true)
    })

    it('non-singleton component does not have singleton flag', () => {
      expect((LifecycleComponent as any).singleton).toBeUndefined()
    })

    it('singleton emit override broadcasts to all connections', () => {
      const ws1 = createMockWs('conn-1')
      const ws2 = createMockWs('conn-2')
      const ws3 = createMockWs('conn-3')

      const component = new SingletonComponent({ count: 0, label: 'shared' }, ws1)

      // Simulate registry setting up singleton broadcast
      const connections = new Map<string, FluxStackWebSocket>()
      connections.set('conn-1', ws1)
      connections.set('conn-2', ws2)
      connections.set('conn-3', ws3)

      ;(component as any)._setEmitOverride((type: string, payload: any) => {
        const message = JSON.stringify({
          type,
          componentId: component.id,
          payload,
          timestamp: Date.now()
        })
        for (const [, ws] of connections) {
          ws.send(message)
        }
      })

      // Trigger state change (which calls emit via proxy)
      component.state.count = 42

      // All three connections should receive the STATE_DELTA
      expect((ws1.send as any).mock.calls.length).toBeGreaterThan(0)
      expect((ws2.send as any).mock.calls.length).toBeGreaterThan(0)
      expect((ws3.send as any).mock.calls.length).toBeGreaterThan(0)

      // Verify the message content
      const msg1 = getLastSentMessage(ws1)
      expect(msg1.type).toBe('STATE_DELTA')
      expect(msg1.payload.delta.count).toBe(42)

      const msg2 = getLastSentMessage(ws2)
      expect(msg2.type).toBe('STATE_DELTA')
      expect(msg2.payload.delta.count).toBe(42)
    })

    it('without emit override, emit goes to single ws only', () => {
      const ws = createMockWs()
      const component = new SingletonComponent({ count: 0, label: 'single' }, ws)

      // No emit override set - normal behavior
      component.state.count = 10

      // Only the component's own ws receives the message
      expect((ws.send as any).mock.calls.length).toBeGreaterThan(0)
      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload.delta.count).toBe(10)
    })

    it('emit override can be cleared', () => {
      const ws1 = createMockWs('conn-1')
      const ws2 = createMockWs('conn-2')

      const component = new SingletonComponent({ count: 0, label: 'test' }, ws1)

      // Set override
      ;(component as any)._setEmitOverride((_type: string, _payload: any) => {
        ws2.send('override')
      })

      // Clear override
      ;(component as any)._setEmitOverride(null)

      // Should go back to normal single-ws emit
      component.state.count = 5
      expect((ws2.send as any).mock.calls.length).toBe(0)
      const msg = getLastSentMessage(ws1)
      expect(msg.type).toBe('STATE_DELTA')
    })
  })

  // ===== BLOCKED_ACTIONS =====
  describe('BLOCKED_ACTIONS includes new internals', () => {
    it('blocks onMount from client', async () => {
      const ws = createMockWs()

      class SecureComponent extends LiveComponent<CounterState> {
        static componentName = 'SecureComponent'
        static defaultState: CounterState = { count: 0, label: 'secure' }
        static publicActions = ['increment', 'onMount'] as const  // Even if listed!

        async increment() { return { success: true } }
      }

      const component = new SecureComponent({}, ws)
      await expect(component.executeAction('onMount', {})).rejects.toThrow('not callable')
    })

    it('blocks onDestroy from client', async () => {
      const ws = createMockWs()

      class SecureComponent extends LiveComponent<CounterState> {
        static componentName = 'SecureComponent2'
        static defaultState: CounterState = { count: 0, label: 'secure' }
        static publicActions = ['increment', 'onDestroy'] as const

        async increment() { return { success: true } }
      }

      const component = new SecureComponent({}, ws)
      await expect(component.executeAction('onDestroy', {})).rejects.toThrow('not callable')
    })

    it('blocks $persistent from client', async () => {
      const ws = createMockWs()

      class SecureComponent extends LiveComponent<CounterState> {
        static componentName = 'SecureComponent3'
        static defaultState: CounterState = { count: 0, label: 'secure' }
        static publicActions = ['increment', '$persistent'] as const

        async increment() { return { success: true } }
      }

      const component = new SecureComponent({}, ws)
      await expect(component.executeAction('$persistent', {})).rejects.toThrow('not callable')
    })

    it('blocks _setEmitOverride from client', async () => {
      const ws = createMockWs()

      class SecureComponent extends LiveComponent<CounterState> {
        static componentName = 'SecureComponent4'
        static defaultState: CounterState = { count: 0, label: 'secure' }
        static publicActions = ['increment', '_setEmitOverride'] as const

        async increment() { return { success: true } }
      }

      const component = new SecureComponent({}, ws)
      await expect(component.executeAction('_setEmitOverride', {})).rejects.toThrow('not callable')
    })
  })
})
