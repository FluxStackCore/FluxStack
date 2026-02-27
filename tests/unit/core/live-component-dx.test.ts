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
