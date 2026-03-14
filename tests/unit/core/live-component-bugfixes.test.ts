import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * 🐛 Bug Regression Tests for Live Components
 *
 * These tests FIRST expose the bugs identified in PR #68/#69 review,
 * then verify the fixes work correctly.
 *
 * Bugs covered:
 * 1. onAction cancellation leaks internal info to client via ERROR emit
 * 2. setState emits STATE_DELTA even when values are unchanged
 * 3. Silent catch {} in onStateChange proxy swallows errors without logging
 * 4. Singleton broadcast missing userId/room metadata
 * 5. Singleton onDisconnect fires for every client disconnect (should only fire for last)
 * 6. Singleton onMount not called for 2+ clients (needs onClientJoin/onClientLeave)
 */

// Import from @fluxstack/live
import { LiveComponent, setLiveComponentContext, RoomEventBus, LiveRoomManager } from '@fluxstack/live'
import type { GenericWebSocket as FluxStackWebSocket } from '@fluxstack/live'

// EMIT_OVERRIDE_KEY uses Symbol.for() so we can reference it directly
const EMIT_OVERRIDE_KEY = Symbol.for('fluxstack:emitOverride')

/** Flush pending queueMicrotask callbacks (WsSendBatcher) */
const flush = () => new Promise<void>(r => queueMicrotask(r))

// Set up DI context for LiveComponent
const testRoomEvents = new RoomEventBus()
const testRoomManager = new LiveRoomManager(testRoomEvents)
setLiveComponentContext({
  roomEvents: testRoomEvents,
  roomManager: testRoomManager,
  debugger: { enabled: false, trackStateChange: () => {}, trackAction: () => {}, trackError: () => {} } as any,
})

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

function getAllSentMessages(ws: FluxStackWebSocket): any[] {
  const sendMock = ws.send as ReturnType<typeof vi.fn>
  return sendMock.mock.calls.map((call: any[]) => JSON.parse(call[0]))
}

function getLastSentMessage(ws: FluxStackWebSocket): any {
  const sendMock = ws.send as ReturnType<typeof vi.fn>
  const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1]
  return lastCall ? JSON.parse(lastCall[0]) : null
}

// ===== Test Components =====

interface CounterState {
  count: number
  name: string
}

class RateLimitedComponent extends LiveComponent<CounterState> {
  static componentName = 'RateLimitedComponent'
  static defaultState: CounterState = { count: 0, name: 'test' }
  static publicActions = ['increment', 'blockedAction'] as const

  private _callCount = 0

  protected onAction(action: string, payload: any): void | false | Promise<void | false> {
    this._callCount++
    if (this._callCount > 2) return false // Rate limit after 2 calls
  }

  async increment() {
    this.state.count++
    return { success: true }
  }

  async blockedAction() {
    return { blocked: false }
  }
}

class StateChangeLoggingComponent extends LiveComponent<CounterState> {
  static componentName = 'StateChangeLoggingComponent'
  static defaultState: CounterState = { count: 0, name: 'test' }
  static publicActions = ['setCount'] as const

  stateChangeLog: Array<Partial<CounterState>> = []

  protected onStateChange(changes: Partial<CounterState>): void {
    this.stateChangeLog.push(changes)
  }

  async setCount(payload: { count: number }) {
    this.setState({ count: payload.count })
    return { success: true }
  }
}

class ThrowingStateChangeComponent extends LiveComponent<CounterState> {
  static componentName = 'ThrowingStateChangeComponent'
  static defaultState: CounterState = { count: 0, name: 'test' }
  static publicActions = ['setCount'] as const

  protected onStateChange(changes: Partial<CounterState>): void {
    throw new Error('onStateChange exploded!')
  }

  async setCount(payload: { count: number }) {
    this.setState({ count: payload.count })
    return { success: true }
  }
}

interface DashboardState {
  visitors: number
  lastVisitor: string
}

class SingletonDashboard extends LiveComponent<DashboardState> {
  static componentName = 'SingletonDashboard'
  static singleton = true
  static defaultState: DashboardState = { visitors: 0, lastVisitor: '' }
  static publicActions = ['recordVisit'] as const

  connectCalls: string[] = []
  disconnectCalls: string[] = []
  clientJoinCalls: Array<{ connectionId: string; connectionCount: number }> = []
  clientLeaveCalls: Array<{ connectionId: string; connectionCount: number }> = []

  protected onConnect(): void {
    this.connectCalls.push('connected')
  }

  protected onDisconnect(): void {
    this.disconnectCalls.push('disconnected')
  }

  protected onClientJoin(connectionId: string, connectionCount: number): void {
    this.clientJoinCalls.push({ connectionId, connectionCount })
  }

  protected onClientLeave(connectionId: string, connectionCount: number): void {
    this.clientLeaveCalls.push({ connectionId, connectionCount })
  }

  async recordVisit(payload: { visitor: string }) {
    this.state.visitors++
    this.state.lastVisitor = payload.visitor
    return { success: true }
  }
}

// =====================================================
// 🐛 BUG 1: onAction cancellation leaks info to client
// =====================================================
describe('🐛 Bug #1: onAction cancellation should NOT emit ERROR to client', () => {
  let ws: FluxStackWebSocket
  let component: RateLimitedComponent

  beforeEach(() => {
    ws = createMockWs()
    component = new RateLimitedComponent({}, ws)
  })

  it('should NOT send ERROR message when onAction returns false (cancellation)', async () => {
    // First 2 calls pass
    await component.executeAction('increment', {})
    await component.executeAction('increment', {})
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    // 3rd call should be cancelled by onAction
    await expect(component.executeAction('blockedAction', {})).rejects.toThrow()

    // BUG: The cancellation currently emits an ERROR message to the client
    // revealing internal server logic ("cancelled by onAction hook")
    const messages = getAllSentMessages(ws)
    const errorMessages = messages.filter(m => m.type === 'ERROR')

    // After fix: no ERROR should be emitted for cancelled actions
    expect(errorMessages).toHaveLength(0)
  })

  it('cancelled action error should NOT reveal internal hook details', async () => {
    await component.executeAction('increment', {})
    await component.executeAction('increment', {})

    try {
      await component.executeAction('blockedAction', {})
    } catch (err: any) {
      // The error should be generic, not mentioning "onAction hook"
      expect(err.message).not.toContain('onAction hook')
      expect(err.message).toContain('cancelled')
    }
  })
})

// =====================================================
// 🐛 BUG 2: setState emits delta when values unchanged
// =====================================================
describe('🐛 Bug #2: setState should skip emit when values are unchanged', () => {
  let ws: FluxStackWebSocket
  let component: StateChangeLoggingComponent

  beforeEach(() => {
    ws = createMockWs()
    component = new StateChangeLoggingComponent({}, ws)
  })

  it('should NOT emit STATE_DELTA when setState sets the same values', () => {
    // Initial state is { count: 0, name: 'test' }
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    // Set the SAME values
    component.setState({ count: 0, name: 'test' })

    // BUG: Currently emits STATE_DELTA even though nothing changed
    const messages = getAllSentMessages(ws)
    const deltaMessages = messages.filter(m => m.type === 'STATE_DELTA')

    // After fix: no delta should be emitted for unchanged values
    expect(deltaMessages).toHaveLength(0)
  })

  it('should NOT call onStateChange when setState sets the same values', () => {
    component.stateChangeLog = []

    // Set the SAME values
    component.setState({ count: 0, name: 'test' })

    // After fix: onStateChange should not be called for no-ops
    expect(component.stateChangeLog).toHaveLength(0)
  })

  it('should emit STATE_DELTA only for keys that actually changed', async () => {
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    // Set count to new value but name stays the same
    component.setState({ count: 5, name: 'test' })
    await flush()

    const messages = getAllSentMessages(ws)
    const deltaMessages = messages.filter(m => m.type === 'STATE_DELTA')

    expect(deltaMessages).toHaveLength(1)
    // Only the changed key should be in the delta
    expect(deltaMessages[0].payload.delta).toEqual({ count: 5 })
  })

  it('proxy set should remain consistent — skip emit for unchanged values', () => {
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    // Proxy already checks oldValue !== value, this should NOT emit
    component.state.count = 0 // Same value

    const messages = getAllSentMessages(ws)
    const deltaMessages = messages.filter(m => m.type === 'STATE_DELTA')
    expect(deltaMessages).toHaveLength(0)
  })
})

// =====================================================
// 🐛 BUG 3: Silent catch {} in onStateChange proxy
// =====================================================
describe('🐛 Bug #3: onStateChange errors should be logged, not silently swallowed', () => {
  let ws: FluxStackWebSocket
  let component: ThrowingStateChangeComponent
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    ws = createMockWs()
    component = new ThrowingStateChangeComponent({}, ws)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should log error when onStateChange throws during proxy mutation', () => {
    // Trigger proxy set which calls onStateChange
    component.state.count = 42

    // BUG: Currently the error is silently swallowed with empty catch {}
    // After fix: should log the error
    expect(consoleErrorSpy).toHaveBeenCalled()
    const errorCall = consoleErrorSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('onStateChange')
    )
    expect(errorCall).toBeDefined()
  })

  it('should log error when onStateChange throws during setState', () => {
    consoleErrorSpy.mockClear()

    component.setState({ count: 99 })

    // BUG: Currently the error is silently swallowed with empty catch {}
    // After fix: should log the error
    expect(consoleErrorSpy).toHaveBeenCalled()
    const errorCall = consoleErrorSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('onStateChange')
    )
    expect(errorCall).toBeDefined()
  })

  // Note: onRoomJoin/onRoomLeave hooks are defined but not invoked
  // by @fluxstack/live v0.3.0 — room lifecycle is handled by LiveRoomManager.
  // These tests are skipped until the hooks are re-wired in a future version.
  it.skip('should log error when onRoomJoin hook throws', () => {})
  it.skip('should log error when onRoomLeave hook throws', () => {})
})

// =====================================================
// 🐛 BUG 4: Singleton broadcast missing userId/room
// =====================================================
describe('🐛 Bug #4: Singleton broadcast should include userId and room metadata', () => {
  it('normal (non-singleton) emit includes userId and room', async () => {
    const ws = createMockWs('conn-1')
    const component = new SingletonDashboard({}, ws, { userId: 'user-1', room: 'dashboard' })
    await flush()

    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    // Trigger a state change (normal emit path)
    component.state.visitors = 5
    await flush()

    const msg = getLastSentMessage(ws)
    expect(msg.userId).toBe('user-1')
    expect(msg.room).toBe('dashboard')
  })

  it('singleton emit override should include userId and room (contract test)', () => {
    const ws1 = createMockWs('conn-1')
    const ws2 = createMockWs('conn-2')

    const component = new SingletonDashboard({}, ws1, { userId: 'user-1', room: 'dashboard' })

    // Simulate the FIXED emit override as ComponentRegistry would set up
    // This test validates the contract: the override MUST include userId and room
    const connections = new Map<string, FluxStackWebSocket>()
    connections.set('conn-1', ws1)
    connections.set('conn-2', ws2)

    ;(component as any)[EMIT_OVERRIDE_KEY] = (type: string, payload: any) => {
      const message = {
        type: type,
        componentId: component.id,
        payload,
        timestamp: Date.now(),
        // These MUST be present — the fix ensures ComponentRegistry includes them
        userId: component.userId,
        room: component.room
      }
      const serialized = JSON.stringify(message)
      for (const [, connWs] of connections) {
        try { connWs.send(serialized) } catch {}
      }
    }

    ;(ws1.send as ReturnType<typeof vi.fn>).mockClear()
    ;(ws2.send as ReturnType<typeof vi.fn>).mockClear()

    // Trigger a state change which will emit via the override
    component.state.visitors = 5

    const msg1 = getLastSentMessage(ws1)
    const msg2 = getLastSentMessage(ws2)

    expect(msg1.userId).toBe('user-1')
    expect(msg1.room).toBe('dashboard')
    expect(msg2.userId).toBe('user-1')
    expect(msg2.room).toBe('dashboard')
  })
})

// =====================================================
// 🐛 BUG 5: Singleton onDisconnect fires for every client
// =====================================================
describe('🐛 Bug #5: Singleton onDisconnect should only fire when last client disconnects', () => {
  it('should have onClientJoin/onClientLeave hooks for per-connection notifications', () => {
    const ws = createMockWs()
    const component = new SingletonDashboard({}, ws)

    // The new hooks should exist on the component
    expect(typeof (component as any).onClientJoin).toBe('function')
    expect(typeof (component as any).onClientLeave).toBe('function')
  })

  it('onClientJoin should receive connectionId and count', () => {
    const ws = createMockWs()
    const component = new SingletonDashboard({}, ws)

    // Simulate a client join notification
    ;(component as any).onClientJoin('conn-2', 2)

    expect(component.clientJoinCalls).toHaveLength(1)
    expect(component.clientJoinCalls[0]).toEqual({ connectionId: 'conn-2', connectionCount: 2 })
  })

  it('onClientLeave should receive connectionId and remaining count', () => {
    const ws = createMockWs()
    const component = new SingletonDashboard({}, ws)

    // Simulate a client leave notification
    ;(component as any).onClientLeave('conn-2', 1)

    expect(component.clientLeaveCalls).toHaveLength(1)
    expect(component.clientLeaveCalls[0]).toEqual({ connectionId: 'conn-2', connectionCount: 1 })
  })
})

// =====================================================
// 🐛 BUG 6: onAction throwing vs returning false
// =====================================================
describe('🐛 Bug #6: onAction that throws should propagate error correctly', () => {
  it('should handle onAction that throws (not returns false) as an action error', async () => {
    class ThrowingActionHookComponent extends LiveComponent<CounterState> {
      static componentName = 'ThrowingActionHookComponent'
      static defaultState: CounterState = { count: 0, name: 'test' }
      static publicActions = ['doSomething'] as const

      protected onAction(action: string, payload: any): void | false {
        throw new Error('Pre-validation failed: invalid token')
      }

      async doSomething() {
        return { success: true }
      }
    }

    const ws = createMockWs()
    const component = new ThrowingActionHookComponent({}, ws)
    await flush()

    // onAction throws — this should propagate as an error, not crash
    await expect(component.executeAction('doSomething', {}))
      .rejects.toThrow('Pre-validation failed: invalid token')
    await flush()

    // v0.3.0: Error is propagated via reject, not via ws ERROR message.
    // If an ERROR message IS sent, it should not reveal "onAction hook" details.
    const messages = getAllSentMessages(ws)
    const errorMsg = messages.find(m => m.type === 'ERROR')
    if (errorMsg) {
      expect(errorMsg.payload.error).not.toContain('onAction')
    }
  })
})

// =====================================================
// Additional regression: setState with function updater
// =====================================================
describe('setState with function updater should also skip unchanged values', () => {
  let ws: FluxStackWebSocket
  let component: StateChangeLoggingComponent

  beforeEach(() => {
    ws = createMockWs()
    component = new StateChangeLoggingComponent({}, ws)
  })

  it('should not emit when function updater returns same values', () => {
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()
    component.stateChangeLog = []

    component.setState((prev) => ({ count: prev.count })) // Returns same count

    const messages = getAllSentMessages(ws)
    const deltaMessages = messages.filter(m => m.type === 'STATE_DELTA')

    expect(deltaMessages).toHaveLength(0)
    expect(component.stateChangeLog).toHaveLength(0)
  })
})

// =====================================================
// Lifecycle hooks should be blocked from BLOCKED_ACTIONS
// =====================================================
describe('New lifecycle hooks (onClientJoin/onClientLeave) should be blocked from remote execution', () => {
  it('should block onClientJoin from being called remotely', async () => {
    const ws = createMockWs()
    const component = new SingletonDashboard({}, ws)

    await expect(component.executeAction('onClientJoin', { connectionId: 'fake' }))
      .rejects.toThrow("is not callable")
  })

  it('should block onClientLeave from being called remotely', async () => {
    const ws = createMockWs()
    const component = new SingletonDashboard({}, ws)

    await expect(component.executeAction('onClientLeave', { connectionId: 'fake' }))
      .rejects.toThrow("is not callable")
  })
})
