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
import { LiveComponent, EMIT_OVERRIDE_KEY } from '@core/types/types'
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

      ;(component as any)[EMIT_OVERRIDE_KEY] = (type: string, payload: any) => {
        const message = JSON.stringify({
          type,
          componentId: component.id,
          payload,
          timestamp: Date.now()
        })
        for (const [, ws] of connections) {
          ws.send(message)
        }
      }

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
      ;(component as any)[EMIT_OVERRIDE_KEY] = (_type: string, _payload: any) => {
        ws2.send('override')
      }

      // Clear override
      ;(component as any)[EMIT_OVERRIDE_KEY] = null

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

    it('blocks _inStateChange from client', async () => {
      const ws = createMockWs()

      class SecureComponent extends LiveComponent<CounterState> {
        static componentName = 'SecureComponent4'
        static defaultState: CounterState = { count: 0, label: 'secure' }
        static publicActions = ['increment', '_inStateChange'] as const

        async increment() { return { success: true } }
      }

      const component = new SecureComponent({}, ws)
      await expect(component.executeAction('_inStateChange', {})).rejects.toThrow('not callable')
    })

    it('blocks all new lifecycle hooks from client', async () => {
      const ws = createMockWs()

      class TestComp extends LiveComponent<CounterState> {
        static componentName = 'TestCompBlocked'
        static defaultState: CounterState = { count: 0, label: 'x' }
        static publicActions = ['increment', 'onConnect', 'onDisconnect', 'onStateChange', 'onRoomJoin', 'onRoomLeave', 'onRehydrate', 'onAction'] as const
        async increment() { return { success: true } }
      }

      const component = new TestComp({}, ws)
      for (const hook of ['onConnect', 'onDisconnect', 'onStateChange', 'onRoomJoin', 'onRoomLeave', 'onRehydrate', 'onAction']) {
        await expect(component.executeAction(hook, {})).rejects.toThrow('not callable')
      }
    })
  })

  // ===== onConnect =====
  describe('onConnect Hook', () => {
    it('onConnect is callable on the component', () => {
      const ws = createMockWs()
      let connectCalled = false

      class ConnectComponent extends LiveComponent<CounterState> {
        static componentName = 'ConnectComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onConnect() {
          connectCalled = true
        }
      }

      const component = new ConnectComponent({}, ws)
      ;(component as any).onConnect()
      expect(connectCalled).toBe(true)
    })
  })

  // ===== onDisconnect =====
  describe('onDisconnect Hook', () => {
    it('onDisconnect is callable and distinct from onDestroy', () => {
      const ws = createMockWs()
      const calls: string[] = []

      class DisconnectComponent extends LiveComponent<CounterState> {
        static componentName = 'DisconnectComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onDisconnect() {
          calls.push('onDisconnect')
        }

        protected onDestroy() {
          calls.push('onDestroy')
        }
      }

      const component = new DisconnectComponent({}, ws)

      // Simulate disconnect (registry calls onDisconnect before destroy)
      ;(component as any).onDisconnect()
      component.destroy()

      expect(calls).toEqual(['onDisconnect', 'onDestroy'])
    })
  })

  // ===== onStateChange =====
  describe('onStateChange Hook', () => {
    it('fires on proxy mutation', () => {
      const ws = createMockWs()
      const changes: any[] = []

      class StateChangeComponent extends LiveComponent<CounterState> {
        static componentName = 'StateChangeComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onStateChange(c: Partial<CounterState>) {
          changes.push({ ...c })
        }
      }

      const component = new StateChangeComponent({ count: 0, label: 'test' }, ws)
      component.state.count = 42

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({ count: 42 })
    })

    it('fires on setState batch', () => {
      const ws = createMockWs()
      const changes: any[] = []

      class StateChangeComponent extends LiveComponent<CounterState> {
        static componentName = 'StateChangeComponent2'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onStateChange(c: Partial<CounterState>) {
          changes.push({ ...c })
        }
      }

      const component = new StateChangeComponent({ count: 0, label: 'old' }, ws)
      component.setState({ count: 10, label: 'new' })

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({ count: 10, label: 'new' })
    })

    it('does not fire if value is unchanged', () => {
      const ws = createMockWs()
      let callCount = 0

      class StateChangeComponent extends LiveComponent<CounterState> {
        static componentName = 'StateChangeComponent3'
        static defaultState: CounterState = { count: 5, label: 'test' }

        protected onStateChange() {
          callCount++
        }
      }

      const component = new StateChangeComponent({ count: 5, label: 'test' }, ws)
      component.state.count = 5 // Same value

      expect(callCount).toBe(0)
    })

    it('errors in onStateChange do not break state updates', () => {
      const ws = createMockWs()

      class ErrorStateComponent extends LiveComponent<CounterState> {
        static componentName = 'ErrorStateComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onStateChange() {
          throw new Error('boom')
        }
      }

      const component = new ErrorStateComponent({ count: 0, label: 'test' }, ws)
      // Should not throw
      expect(() => { component.state.count = 99 }).not.toThrow()
      // State should still be updated
      expect((component as any)._state.count).toBe(99)
    })

    it('does not cause infinite recursion when onStateChange modifies state', () => {
      const ws = createMockWs()
      let hookCallCount = 0

      class RecursiveStateComponent extends LiveComponent<CounterState> {
        static componentName = 'RecursiveStateComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onStateChange(changes: Partial<CounterState>) {
          hookCallCount++
          // This would cause infinite recursion without the guard
          if ('count' in changes) {
            this.state.label = `count-${this.state.count}`
          }
        }
      }

      const component = new RecursiveStateComponent({ count: 0, label: 'test' }, ws)
      component.state.count = 42

      // Hook should be called exactly once (guard prevents recursion)
      expect(hookCallCount).toBe(1)
      // Both state changes should apply
      expect((component as any)._state.count).toBe(42)
      expect((component as any)._state.label).toBe('count-42')
    })

    it('recursion guard works with setState too', () => {
      const ws = createMockWs()
      let hookCallCount = 0

      class RecursiveSetStateComponent extends LiveComponent<CounterState> {
        static componentName = 'RecursiveSetStateComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onStateChange(changes: Partial<CounterState>) {
          hookCallCount++
          if ('count' in changes) {
            this.setState({ label: `count-${(changes as any).count}` })
          }
        }
      }

      const component = new RecursiveSetStateComponent({ count: 0, label: 'test' }, ws)
      component.setState({ count: 10 })

      // Hook should be called exactly once
      expect(hookCallCount).toBe(1)
      expect((component as any)._state.count).toBe(10)
      expect((component as any)._state.label).toBe('count-10')
    })
  })

  // ===== onRoomJoin / onRoomLeave =====
  describe('onRoomJoin / onRoomLeave Hooks', () => {
    it('fires onRoomJoin when joining a room', () => {
      const ws = createMockWs()
      const roomEvents: string[] = []

      class RoomComponent extends LiveComponent<CounterState> {
        static componentName = 'RoomComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onRoomJoin(roomId: string) {
          roomEvents.push(`join:${roomId}`)
        }

        protected onRoomLeave(roomId: string) {
          roomEvents.push(`leave:${roomId}`)
        }
      }

      const component = new RoomComponent({}, ws, { room: 'default-room' })
      component.$room('test-room').join()

      expect(roomEvents).toContain('join:test-room')
    })

    it('fires onRoomLeave when leaving a room', () => {
      const ws = createMockWs()
      const roomEvents: string[] = []

      class RoomComponent extends LiveComponent<CounterState> {
        static componentName = 'RoomComponent2'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onRoomJoin(roomId: string) {
          roomEvents.push(`join:${roomId}`)
        }

        protected onRoomLeave(roomId: string) {
          roomEvents.push(`leave:${roomId}`)
        }
      }

      const component = new RoomComponent({}, ws, { room: 'default-room' })
      component.$room('test-room').join()
      component.$room('test-room').leave()

      expect(roomEvents).toEqual(['join:test-room', 'leave:test-room'])
    })
  })

  // ===== onRehydrate =====
  describe('onRehydrate Hook', () => {
    it('onRehydrate receives previous state', () => {
      const ws = createMockWs()
      let receivedState: any = null

      class RehydrateComponent extends LiveComponent<CounterState> {
        static componentName = 'RehydrateComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onRehydrate(previousState: CounterState) {
          receivedState = previousState
        }
      }

      const component = new RehydrateComponent({}, ws)
      const oldState = { count: 42, label: 'old' }
      ;(component as any).onRehydrate(oldState)

      expect(receivedState).toEqual({ count: 42, label: 'old' })
    })
  })

  // ===== onAction =====
  describe('onAction Hook', () => {
    it('fires before action execution', async () => {
      const ws = createMockWs()
      const log: string[] = []

      class ActionHookComponent extends LiveComponent<CounterState> {
        static componentName = 'ActionHookComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment'] as const

        protected onAction(action: string, _payload: any) {
          log.push(`before:${action}`)
        }

        async increment() {
          log.push('execute:increment')
          this.state.count++
          return { count: this.state.count }
        }
      }

      const component = new ActionHookComponent({ count: 0, label: 'test' }, ws)
      await component.executeAction('increment', {})

      expect(log).toEqual(['before:increment', 'execute:increment'])
    })

    it('returning false cancels the action', async () => {
      const ws = createMockWs()
      let executed = false

      class CancelComponent extends LiveComponent<CounterState> {
        static componentName = 'CancelComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment'] as const

        protected onAction(_action: string, _payload: any): false {
          return false
        }

        async increment() {
          executed = true
          this.state.count++
          return { count: this.state.count }
        }
      }

      const component = new CancelComponent({ count: 0, label: 'test' }, ws)

      await expect(component.executeAction('increment', {})).rejects.toThrow('cancelled by onAction')
      expect(executed).toBe(false)
    })

    it('returning void allows the action', async () => {
      const ws = createMockWs()

      class AllowComponent extends LiveComponent<CounterState> {
        static componentName = 'AllowComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment'] as const

        protected onAction() {
          // No return = allow
        }

        async increment() {
          this.state.count++
          return { count: this.state.count }
        }
      }

      const component = new AllowComponent({ count: 0, label: 'test' }, ws)
      const result = await component.executeAction('increment', {})
      expect(result).toEqual({ count: 1 })
    })
  })

  // ===== Full Lifecycle Order =====
  describe('Lifecycle Order', () => {
    it('hooks fire in correct order: onConnect → onMount → actions → onDestroy', async () => {
      const ws = createMockWs()
      const order: string[] = []

      class FullLifecycleComponent extends LiveComponent<CounterState> {
        static componentName = 'FullLifecycleComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment'] as const

        protected onConnect() { order.push('onConnect') }
        protected onMount() { order.push('onMount') }
        protected onAction(action: string) { order.push(`onAction:${action}`) }
        protected onStateChange() { order.push('onStateChange') }
        protected onDisconnect() { order.push('onDisconnect') }
        protected onDestroy() { order.push('onDestroy') }

        async increment() {
          order.push('increment')
          this.state.count++
          return { success: true }
        }
      }

      const component = new FullLifecycleComponent({ count: 0, label: 'test' }, ws)

      // Simulate registry lifecycle
      ;(component as any).onConnect()
      await (component as any).onMount()
      await component.executeAction('increment', {})
      ;(component as any).onDisconnect()
      component.destroy()

      expect(order).toEqual([
        'onConnect',
        'onMount',
        'onAction:increment',
        'increment',
        'onStateChange',
        'onDisconnect',
        'onDestroy'
      ])
    })
  })
})

// =============================================
// ADDITIONAL COMPREHENSIVE TESTS
// =============================================

describe('LiveComponent DX — Extended Coverage', () => {

  // ===== onConnect Error Safety =====
  describe('onConnect Error Safety', () => {
    it('errors in onConnect do not prevent further lifecycle', async () => {
      const ws = createMockWs()
      const order: string[] = []

      class ErrorConnectComponent extends LiveComponent<CounterState> {
        static componentName = 'ErrorConnectComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment'] as const

        protected onConnect() {
          order.push('onConnect')
          throw new Error('connect failed')
        }

        protected onMount() {
          order.push('onMount')
        }

        async increment() {
          this.state.count++
          return { count: this.state.count }
        }
      }

      const component = new ErrorConnectComponent({ count: 0, label: 'test' }, ws)

      // Simulate registry behavior: catch onConnect errors and continue
      try { (component as any).onConnect() } catch {}
      ;(component as any).onMount()

      expect(order).toContain('onConnect')
      expect(order).toContain('onMount')

      // Component still functional
      const result = await component.executeAction('increment', {})
      expect(result).toEqual({ count: 1 })
    })
  })

  // ===== onDisconnect Error Safety =====
  describe('onDisconnect Error Safety', () => {
    it('errors in onDisconnect do not prevent cleanup', () => {
      const ws = createMockWs()

      class ErrorDisconnectComponent extends LiveComponent<CounterState> {
        static componentName = 'ErrorDisconnectComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onDisconnect() {
          throw new Error('disconnect boom')
        }
      }

      const component = new ErrorDisconnectComponent({}, ws)

      // Simulate registry: catch onDisconnect error, then destroy
      try { (component as any).onDisconnect() } catch {}
      expect(() => component.destroy()).not.toThrow()
    })
  })

  // ===== Async onAction =====
  describe('Async onAction', () => {
    it('async onAction returning false cancels the action', async () => {
      const ws = createMockWs()
      let executed = false

      class AsyncCancelComponent extends LiveComponent<CounterState> {
        static componentName = 'AsyncCancelComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['doStuff'] as const

        protected async onAction(_action: string, _payload: any): Promise<void | false> {
          await new Promise(r => setTimeout(r, 5))
          return false
        }

        async doStuff() {
          executed = true
          return { done: true }
        }
      }

      const component = new AsyncCancelComponent({}, ws)
      await expect(component.executeAction('doStuff', {})).rejects.toThrow('cancelled by onAction')
      expect(executed).toBe(false)
    })

    it('async onAction returning void allows the action', async () => {
      const ws = createMockWs()

      class AsyncAllowComponent extends LiveComponent<CounterState> {
        static componentName = 'AsyncAllowComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['doStuff'] as const

        protected async onAction(): Promise<void> {
          await new Promise(r => setTimeout(r, 5))
          // no return = allow
        }

        async doStuff() {
          this.state.count = 99
          return { done: true }
        }
      }

      const component = new AsyncAllowComponent({ count: 0, label: 'test' }, ws)
      const result = await component.executeAction('doStuff', {})
      expect(result).toEqual({ done: true })
    })
  })

  // ===== onAction Receives Correct Payload =====
  describe('onAction Payload', () => {
    it('receives the action name and full payload', async () => {
      const ws = createMockWs()
      let receivedAction: string | null = null
      let receivedPayload: any = null

      class PayloadCheckComponent extends LiveComponent<CounterState> {
        static componentName = 'PayloadCheckComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['submit'] as const

        protected onAction(action: string, payload: any) {
          receivedAction = action
          receivedPayload = payload
        }

        async submit(payload: { name: string; value: number }) {
          return { received: true, ...payload }
        }
      }

      const component = new PayloadCheckComponent({}, ws)
      await component.executeAction('submit', { name: 'test', value: 42 })

      expect(receivedAction).toBe('submit')
      expect(receivedPayload).toEqual({ name: 'test', value: 42 })
    })
  })

  // ===== onStateChange — Multiple Rapid Changes =====
  describe('onStateChange Multiple Changes', () => {
    it('fires for each proxy mutation separately', () => {
      const ws = createMockWs()
      const changes: any[] = []

      class MultiChangeComponent extends LiveComponent<CounterState> {
        static componentName = 'MultiChangeComponent'
        static defaultState: CounterState = { count: 0, label: 'initial' }

        protected onStateChange(c: Partial<CounterState>) {
          changes.push({ ...c })
        }
      }

      const component = new MultiChangeComponent({ count: 0, label: 'initial' }, ws)
      component.state.count = 1
      component.state.count = 2
      component.state.label = 'updated'

      expect(changes).toHaveLength(3)
      expect(changes[0]).toEqual({ count: 1 })
      expect(changes[1]).toEqual({ count: 2 })
      expect(changes[2]).toEqual({ label: 'updated' })
    })

    it('setState with function updater triggers onStateChange', () => {
      const ws = createMockWs()
      const changes: any[] = []

      class FnUpdateComponent extends LiveComponent<CounterState> {
        static componentName = 'FnUpdateComponent'
        static defaultState: CounterState = { count: 10, label: 'test' }

        protected onStateChange(c: Partial<CounterState>) {
          changes.push({ ...c })
        }
      }

      const component = new FnUpdateComponent({ count: 10, label: 'test' }, ws)
      component.setState((prev) => ({ count: prev.count + 5 }))

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({ count: 15 })
    })
  })

  // ===== onStateChange During Action Execution =====
  describe('onStateChange During Actions', () => {
    it('fires when action modifies state via proxy', async () => {
      const ws = createMockWs()
      const changes: any[] = []

      class ActionStateComponent extends LiveComponent<CounterState> {
        static componentName = 'ActionStateComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment'] as const

        protected onStateChange(c: Partial<CounterState>) {
          changes.push({ ...c })
        }

        async increment() {
          this.state.count++
          return { count: this.state.count }
        }
      }

      const component = new ActionStateComponent({ count: 0, label: 'test' }, ws)
      await component.executeAction('increment', {})

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({ count: 1 })
    })

    it('fires when action modifies state via setState', async () => {
      const ws = createMockWs()
      const changes: any[] = []

      class ActionSetStateComponent extends LiveComponent<CounterState> {
        static componentName = 'ActionSetStateComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['update'] as const

        protected onStateChange(c: Partial<CounterState>) {
          changes.push({ ...c })
        }

        async update() {
          this.setState({ count: 42, label: 'updated' })
          return { done: true }
        }
      }

      const component = new ActionSetStateComponent({ count: 0, label: 'test' }, ws)
      await component.executeAction('update', {})

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({ count: 42, label: 'updated' })
    })
  })

  // ===== onMount Can Modify State =====
  describe('onMount State Modification', () => {
    it('onMount can modify state and state is updated', async () => {
      const ws = createMockWs()

      class MountStateComponent extends LiveComponent<CounterState> {
        static componentName = 'MountStateComponent'
        static defaultState: CounterState = { count: 0, label: 'loading' }

        protected onMount() {
          this.state.label = 'ready'
          this.state.count = 100
        }
      }

      const component = new MountStateComponent({ count: 0, label: 'loading' }, ws)
      ;(component as any).onMount()

      expect(component.state.label).toBe('ready')
      expect(component.state.count).toBe(100)
    })
  })

  // ===== onRehydrate Can Modify State =====
  describe('onRehydrate State Modification', () => {
    it('onRehydrate can migrate/modify state after rehydration', () => {
      const ws = createMockWs()

      interface VersionedState {
        count: number
        label: string
        version: number
      }

      class MigrateComponent extends LiveComponent<VersionedState> {
        static componentName = 'MigrateComponent'
        static defaultState: VersionedState = { count: 0, label: 'test', version: 2 }

        protected onRehydrate(previousState: VersionedState) {
          if (!previousState.version || previousState.version < 2) {
            this.state.version = 2
            this.state.label = 'migrated'
          }
        }
      }

      const component = new MigrateComponent({ count: 5, label: 'old', version: 0 }, ws)
      ;(component as any).onRehydrate({ count: 5, label: 'old', version: 0 })

      expect(component.state.version).toBe(2)
      expect(component.state.label).toBe('migrated')
      expect(component.state.count).toBe(5)
    })
  })

  // ===== $persistent Deep Object Mutations =====
  describe('$persistent Deep Mutations', () => {
    afterEach(() => {
      delete (globalThis as any).__fluxstack_persistent_DeepPersistentComponent
    })

    it('nested object mutations persist across instances', () => {
      const ws = createMockWs()

      class DeepPersistentComponent extends LiveComponent<CounterState> {
        static componentName = 'DeepPersistentComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static persistent = {
          nested: { items: [] as string[], meta: { version: 1 } }
        }
      }

      const comp1 = new DeepPersistentComponent({}, ws)
      comp1.$persistent.nested.items.push('item1')
      comp1.$persistent.nested.items.push('item2')
      comp1.$persistent.nested.meta.version = 2

      // New instance (HMR)
      const comp2 = new DeepPersistentComponent({}, ws)
      expect(comp2.$persistent.nested.items).toEqual(['item1', 'item2'])
      expect(comp2.$persistent.nested.meta.version).toBe(2)
    })

    it('$persistent allows adding new keys at runtime', () => {
      const ws = createMockWs()

      class DeepPersistentComponent extends LiveComponent<CounterState> {
        static componentName = 'DeepPersistentComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static persistent = { initial: 'value' }
      }

      const comp = new DeepPersistentComponent({}, ws)
      comp.$persistent.newKey = 'dynamically added'

      const comp2 = new DeepPersistentComponent({}, ws)
      expect(comp2.$persistent.newKey).toBe('dynamically added')
      expect(comp2.$persistent.initial).toBe('value')
    })
  })

  // ===== onRoomJoin / onRoomLeave Error Safety =====
  describe('Room Hook Error Safety', () => {
    it('errors in onRoomJoin do not prevent room join', () => {
      const ws = createMockWs()

      class ErrorRoomComponent extends LiveComponent<CounterState> {
        static componentName = 'ErrorRoomComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onRoomJoin(_roomId: string) {
          throw new Error('room join boom')
        }
      }

      const component = new ErrorRoomComponent({}, ws, { room: 'default-room' })

      // Should not throw — errors are caught inside $room.join()
      expect(() => component.$room('error-room').join()).not.toThrow()
      expect(component.$rooms).toContain('error-room')
    })

    it('errors in onRoomLeave do not prevent room leave', () => {
      const ws = createMockWs()

      class ErrorLeaveComponent extends LiveComponent<CounterState> {
        static componentName = 'ErrorLeaveComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onRoomLeave(_roomId: string) {
          throw new Error('room leave boom')
        }
      }

      const component = new ErrorLeaveComponent({}, ws, { room: 'default-room' })
      component.$room('test-room').join()
      expect(component.$rooms).toContain('test-room')

      expect(() => component.$room('test-room').leave()).not.toThrow()
      expect(component.$rooms).not.toContain('test-room')
    })
  })

  // ===== Security: _ prefixed Methods Blocked =====
  describe('Security: Private Method Blocking', () => {
    it('blocks methods starting with _ even if in publicActions', async () => {
      const ws = createMockWs()

      class UnderscoreComponent extends LiveComponent<CounterState> {
        static componentName = 'UnderscoreComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['_secretMethod', 'safeMethod'] as const

        async _secretMethod() { return { secret: true } }
        async safeMethod() { return { safe: true } }
      }

      const component = new UnderscoreComponent({}, ws)
      await expect(component.executeAction('_secretMethod', {})).rejects.toThrow('not callable')

      // But safe method works
      const result = await component.executeAction('safeMethod', {})
      expect(result).toEqual({ safe: true })
    })

    it('blocks methods starting with # (hash prefix)', async () => {
      const ws = createMockWs()

      class HashComponent extends LiveComponent<CounterState> {
        static componentName = 'HashComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['#private', 'safeMethod'] as const

        async safeMethod() { return { ok: true } }
      }

      const component = new HashComponent({}, ws)
      await expect(component.executeAction('#private', {})).rejects.toThrow('not callable')
    })
  })

  // ===== Security: No publicActions Defined =====
  describe('Security: No publicActions', () => {
    it('blocks ALL actions when publicActions is undefined', async () => {
      const ws = createMockWs()

      class NoActionsComponent extends LiveComponent<CounterState> {
        static componentName = 'NoActionsComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        // No publicActions defined

        async doSomething() { return { done: true } }
      }

      const component = new NoActionsComponent({}, ws)
      await expect(component.executeAction('doSomething', {})).rejects.toThrow('no publicActions defined')
    })
  })

  // ===== Singleton Emit Override — State Changes =====
  describe('Singleton State Sync', () => {
    it('setState broadcasts to all connections via emit override', () => {
      const ws1 = createMockWs('conn-1')
      const ws2 = createMockWs('conn-2')

      const component = new SingletonComponent({ count: 0, label: 'shared' }, ws1)

      const connections = new Map<string, FluxStackWebSocket>()
      connections.set('conn-1', ws1)
      connections.set('conn-2', ws2)

      ;(component as any)[EMIT_OVERRIDE_KEY] = (type: string, payload: any) => {
        const message = JSON.stringify({ type, componentId: component.id, payload, timestamp: Date.now() })
        for (const [, ws] of connections) {
          ws.send(message)
        }
      }

      // Use setState (batch update)
      component.setState({ count: 50, label: 'batch' })

      // Both connections should receive STATE_DELTA
      expect((ws1.send as any).mock.calls.length).toBeGreaterThan(0)
      expect((ws2.send as any).mock.calls.length).toBeGreaterThan(0)

      const msg1 = getLastSentMessage(ws1)
      expect(msg1.type).toBe('STATE_DELTA')
      expect(msg1.payload.delta).toEqual({ count: 50, label: 'batch' })

      const msg2 = getLastSentMessage(ws2)
      expect(msg2.type).toBe('STATE_DELTA')
      expect(msg2.payload.delta).toEqual({ count: 50, label: 'batch' })
    })
  })

  // ===== Singleton Actions Broadcast State =====
  describe('Singleton Action Broadcasts', () => {
    it('action that modifies state broadcasts to all clients', async () => {
      const ws1 = createMockWs('conn-1')
      const ws2 = createMockWs('conn-2')

      const component = new SingletonComponent({ count: 0, label: 'shared' }, ws1)

      const connections = new Map<string, FluxStackWebSocket>()
      connections.set('conn-1', ws1)
      connections.set('conn-2', ws2)

      ;(component as any)[EMIT_OVERRIDE_KEY] = (type: string, payload: any) => {
        const message = JSON.stringify({ type, componentId: component.id, payload, timestamp: Date.now() })
        for (const [, ws] of connections) {
          ws.send(message)
        }
      }

      await component.executeAction('increment', {})

      // Both connections received the delta from the action
      const msg1 = getLastSentMessage(ws1)
      expect(msg1.type).toBe('STATE_DELTA')
      expect(msg1.payload.delta.count).toBe(1)

      const msg2 = getLastSentMessage(ws2)
      expect(msg2.type).toBe('STATE_DELTA')
      expect(msg2.payload.delta.count).toBe(1)
    })
  })

  // ===== Default Room Handle Operations =====
  describe('$room Default Handle', () => {
    it('$room methods use default room when room is set in constructor', () => {
      const ws = createMockWs()
      const events: string[] = []

      class DefaultRoomComponent extends LiveComponent<CounterState> {
        static componentName = 'DefaultRoomComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onRoomJoin(roomId: string) {
          events.push(`join:${roomId}`)
        }

        protected onRoomLeave(roomId: string) {
          events.push(`leave:${roomId}`)
        }
      }

      const component = new DefaultRoomComponent({}, ws, { room: 'my-room' })

      // Default room was auto-joined in constructor (but onRoomJoin is for $room.join() calls)
      expect(component.$rooms).toContain('my-room')
    })

    it('throws error when calling $room methods without a default room', () => {
      const ws = createMockWs()

      class NoRoomComponent extends LiveComponent<CounterState> {
        static componentName = 'NoRoomComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new NoRoomComponent({}, ws)

      // No default room — calling default methods should throw
      expect(() => component.$room.join()).toThrow('No default room set')
      expect(() => component.$room.leave()).toThrow('No default room set')
      expect(() => component.$room.emit('test', {})).toThrow('No default room set')
    })
  })

  // ===== $rooms List =====
  describe('$rooms Array', () => {
    it('tracks all joined rooms', () => {
      const ws = createMockWs()

      class MultiRoomComponent extends LiveComponent<CounterState> {
        static componentName = 'MultiRoomComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new MultiRoomComponent({}, ws, { room: 'default' })
      component.$room('room-a').join()
      component.$room('room-b').join()

      expect(component.$rooms).toContain('default')
      expect(component.$rooms).toContain('room-a')
      expect(component.$rooms).toContain('room-b')
      expect(component.$rooms).toHaveLength(3)
    })

    it('removes rooms when leaving', () => {
      const ws = createMockWs()

      class LeaveRoomComponent extends LiveComponent<CounterState> {
        static componentName = 'LeaveRoomComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new LeaveRoomComponent({}, ws, { room: 'default' })
      component.$room('temp').join()
      expect(component.$rooms).toHaveLength(2)

      component.$room('temp').leave()
      expect(component.$rooms).toHaveLength(1)
      expect(component.$rooms).not.toContain('temp')
    })

    it('joining same room twice is idempotent', () => {
      const ws = createMockWs()

      class IdempotentRoomComponent extends LiveComponent<CounterState> {
        static componentName = 'IdempotentRoomComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new IdempotentRoomComponent({}, ws, { room: 'default' })
      component.$room('room-x').join()
      component.$room('room-x').join() // duplicate

      expect(component.$rooms.filter(r => r === 'room-x')).toHaveLength(1)
    })
  })

  // ===== State Proxy — Delta Emissions =====
  describe('State Proxy Delta Emissions', () => {
    it('each proxy mutation sends a STATE_DELTA message', () => {
      const ws = createMockWs()

      class DeltaComponent extends LiveComponent<CounterState> {
        static componentName = 'DeltaComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new DeltaComponent({ count: 0, label: 'test' }, ws)
      component.state.count = 10
      component.state.label = 'changed'

      const calls = (ws.send as any).mock.calls
      expect(calls.length).toBe(2)

      const msg1 = JSON.parse(calls[0][0])
      expect(msg1.type).toBe('STATE_DELTA')
      expect(msg1.payload.delta).toEqual({ count: 10 })

      const msg2 = JSON.parse(calls[1][0])
      expect(msg2.type).toBe('STATE_DELTA')
      expect(msg2.payload.delta).toEqual({ label: 'changed' })
    })

    it('setState sends a single STATE_DELTA with all changes', () => {
      const ws = createMockWs()

      class BatchDeltaComponent extends LiveComponent<CounterState> {
        static componentName = 'BatchDeltaComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new BatchDeltaComponent({ count: 0, label: 'test' }, ws)
      component.setState({ count: 99, label: 'batch' })

      const calls = (ws.send as any).mock.calls
      expect(calls.length).toBe(1)

      const msg = JSON.parse(calls[0][0])
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload.delta).toEqual({ count: 99, label: 'batch' })
    })
  })

  // ===== Object.prototype Methods Blocked =====
  describe('Security: Object.prototype Blocking', () => {
    it('blocks Object.prototype methods even if in publicActions', async () => {
      const ws = createMockWs()

      class ProtoComponent extends LiveComponent<CounterState> {
        static componentName = 'ProtoComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['toString', 'increment'] as const

        async increment() { return { ok: true } }
      }

      const component = new ProtoComponent({}, ws)
      await expect(component.executeAction('toString', {})).rejects.toThrow('not callable')

      // Normal action works
      const result = await component.executeAction('increment', {})
      expect(result).toEqual({ ok: true })
    })
  })

  // ===== Multiple executeAction Calls =====
  describe('Concurrent Action Execution', () => {
    it('multiple actions can run and onAction fires for each', async () => {
      const ws = createMockWs()
      const actionLog: string[] = []

      class MultiActionComponent extends LiveComponent<CounterState> {
        static componentName = 'MultiActionComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment', 'setLabel'] as const

        protected onAction(action: string) {
          actionLog.push(action)
        }

        async increment() {
          this.state.count++
          return { count: this.state.count }
        }

        async setLabel(payload: { label: string }) {
          this.state.label = payload.label
          return { label: this.state.label }
        }
      }

      const component = new MultiActionComponent({ count: 0, label: 'test' }, ws)

      await component.executeAction('increment', {})
      await component.executeAction('setLabel', { label: 'hello' })
      await component.executeAction('increment', {})

      expect(actionLog).toEqual(['increment', 'setLabel', 'increment'])
      expect(component.state.count).toBe(2)
      expect(component.state.label).toBe('hello')
    })
  })

  // ===== onAction Selective Cancellation =====
  describe('onAction Selective Cancel', () => {
    it('can cancel specific actions while allowing others', async () => {
      const ws = createMockWs()

      class SelectiveCancelComponent extends LiveComponent<CounterState> {
        static componentName = 'SelectiveCancelComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
        static publicActions = ['increment', 'reset'] as const

        protected onAction(action: string): void | false {
          if (action === 'reset') return false
        }

        async increment() {
          this.state.count++
          return { count: this.state.count }
        }

        async reset() {
          this.state.count = 0
          return { count: 0 }
        }
      }

      const component = new SelectiveCancelComponent({ count: 0, label: 'test' }, ws)

      // increment allowed
      const r1 = await component.executeAction('increment', {})
      expect(r1).toEqual({ count: 1 })

      // reset cancelled
      await expect(component.executeAction('reset', {})).rejects.toThrow('cancelled by onAction')
      expect(component.state.count).toBe(1) // still 1, not reset
    })
  })

  // ===== Complete Lifecycle Order with Rehydration =====
  describe('Rehydration Lifecycle Order', () => {
    it('follows onConnect → onRehydrate → onMount order', async () => {
      const ws = createMockWs()
      const order: string[] = []

      class RehydrateLifecycleComponent extends LiveComponent<CounterState> {
        static componentName = 'RehydrateLifecycleComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }

        protected onConnect() { order.push('onConnect') }
        protected onRehydrate(prev: CounterState) { order.push(`onRehydrate:count=${prev.count}`) }
        protected onMount() { order.push('onMount') }
        protected onDestroy() { order.push('onDestroy') }
      }

      const component = new RehydrateLifecycleComponent({ count: 42, label: 'old' }, ws)

      // Simulate registry rehydration lifecycle
      ;(component as any).onConnect()
      ;(component as any).onRehydrate({ count: 42, label: 'old' })
      await (component as any).onMount()

      expect(order).toEqual([
        'onConnect',
        'onRehydrate:count=42',
        'onMount'
      ])

      component.destroy()
      expect(order).toContain('onDestroy')
    })
  })

  // ===== defaultState Merge =====
  describe('defaultState Merge with initialState', () => {
    it('merges defaultState with partial initialState', () => {
      const ws = createMockWs()

      class MergeComponent extends LiveComponent<CounterState> {
        static componentName = 'MergeComponent'
        static defaultState: CounterState = { count: 0, label: 'default-label' }
      }

      // Only provide count, label should come from defaultState
      const component = new MergeComponent({ count: 42 } as any, ws)
      expect(component.state.count).toBe(42)
      expect(component.state.label).toBe('default-label')
    })

    it('initialState overrides defaultState', () => {
      const ws = createMockWs()

      class OverrideComponent extends LiveComponent<CounterState> {
        static componentName = 'OverrideComponent'
        static defaultState: CounterState = { count: 0, label: 'default' }
      }

      const component = new OverrideComponent({ count: 100, label: 'custom' }, ws)
      expect(component.state.count).toBe(100)
      expect(component.state.label).toBe('custom')
    })
  })

  // ===== All Hooks No-Op by Default =====
  describe('Default Hook No-Ops', () => {
    it('component with no hooks overridden works correctly', async () => {
      const ws = createMockWs()

      class PlainComponent extends LiveComponent<CounterState> {
        static componentName = 'PlainComponent'
        static defaultState: CounterState = { count: 0, label: 'plain' }
        static publicActions = ['increment'] as const

        async increment() {
          this.state.count++
          return { count: this.state.count }
        }
      }

      const component = new PlainComponent({ count: 0, label: 'plain' }, ws)

      // All lifecycle hooks should be no-ops
      expect(() => (component as any).onConnect()).not.toThrow()
      expect(() => (component as any).onDisconnect()).not.toThrow()
      // onMount returns void (not a Promise) by default
      expect((component as any).onMount()).toBeUndefined()
      expect(() => (component as any).onStateChange({})).not.toThrow()
      expect(() => (component as any).onRoomJoin('test')).not.toThrow()
      expect(() => (component as any).onRoomLeave('test')).not.toThrow()
      expect(() => (component as any).onRehydrate({})).not.toThrow()
      expect(await (component as any).onAction('test', {})).toBeUndefined()

      // Normal operations work
      const result = await component.executeAction('increment', {})
      expect(result).toEqual({ count: 1 })

      expect(() => component.destroy()).not.toThrow()
    })
  })

  // ===== getSerializableState =====
  describe('getSerializableState', () => {
    it('returns current state without internal fields', () => {
      const ws = createMockWs()

      class SerializableComponent extends LiveComponent<CounterState> {
        static componentName = 'SerializableComponent'
        static defaultState: CounterState = { count: 5, label: 'serialize-me' }
      }

      const component = new SerializableComponent({ count: 5, label: 'serialize-me' }, ws)
      const state = component.getSerializableState()

      expect(state).toEqual({ count: 5, label: 'serialize-me' })
    })

    it('reflects state changes via proxy', () => {
      const ws = createMockWs()

      class SerializableComponent extends LiveComponent<CounterState> {
        static componentName = 'SerializableComponent2'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new SerializableComponent({ count: 0, label: 'test' }, ws)
      component.state.count = 77
      component.state.label = 'updated'

      const state = component.getSerializableState()
      expect(state).toEqual({ count: 77, label: 'updated' })
    })
  })

  // ===== Emit Message Format =====
  describe('Emit Message Format', () => {
    it('emit sends correctly structured LiveMessage', () => {
      const ws = createMockWs()

      class EmitComponent extends LiveComponent<CounterState> {
        static componentName = 'EmitComponent'
        static defaultState: CounterState = { count: 0, label: 'test' }
      }

      const component = new EmitComponent({ count: 0, label: 'test' }, ws, { room: 'my-room', userId: 'user-123' })
      component.state.count = 1

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.componentId).toBe(component.id)
      expect(msg.payload.delta).toEqual({ count: 1 })
      expect(msg.timestamp).toBeDefined()
      expect(msg.userId).toBe('user-123')
      expect(msg.room).toBe('my-room')
    })
  })
})
