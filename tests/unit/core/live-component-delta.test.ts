import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for Live Component Delta State Updates
 *
 * Validates that state mutations emit STATE_DELTA (partial) instead of
 * STATE_UPDATE (full state), reducing WebSocket payload size.
 */

// Mock the room dependencies before importing the module
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

// Concrete test component
interface TestState {
  count: number
  name: string
  items: string[]
}

class TestComponent extends LiveComponent<TestState> {
  static componentName = 'TestComponent'
  static defaultState: TestState = { count: 0, name: 'default', items: [] }

  async increment() {
    this.state.count++
    return { success: true }
  }

  async setName(payload: { name: string }) {
    this.state.name = payload.name
    return { success: true }
  }

  async batchUpdate(payload: { count: number; name: string }) {
    this.setState({ count: payload.count, name: payload.name })
    return { success: true }
  }
}

function createMockWs(): FluxStackWebSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
    data: {
      connectionId: 'test-conn',
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

function getAllSentMessages(ws: FluxStackWebSocket): any[] {
  const sendMock = ws.send as ReturnType<typeof vi.fn>
  return sendMock.mock.calls.map((call: any[]) => JSON.parse(call[0]))
}

describe('LiveComponent Delta State Updates', () => {
  let ws: FluxStackWebSocket
  let component: TestComponent

  beforeEach(() => {
    ws = createMockWs()
    component = new TestComponent({}, ws)
    // Clear constructor-related sends
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()
  })

  describe('Proxy set (this.state.prop = value)', () => {
    it('should emit STATE_DELTA with only the changed property', () => {
      component.state.count = 42

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload).toEqual({ delta: { count: 42 } })
    })

    it('should not include unchanged properties in delta', () => {
      component.state.name = 'updated'

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload).toEqual({ delta: { name: 'updated' } })
      // Should NOT contain count or items
      expect(msg.payload.delta.count).toBeUndefined()
      expect(msg.payload.delta.items).toBeUndefined()
    })

    it('should not emit if value is the same', () => {
      component.state.count = 0 // same as default

      expect(ws.send).not.toHaveBeenCalled()
    })

    it('should emit separate deltas for sequential property changes', () => {
      component.state.count = 1
      component.state.name = 'hello'

      const messages = getAllSentMessages(ws)
      expect(messages).toHaveLength(2)
      expect(messages[0].payload).toEqual({ delta: { count: 1 } })
      expect(messages[1].payload).toEqual({ delta: { name: 'hello' } })
    })
  })

  describe('setState (batch update)', () => {
    it('should emit STATE_DELTA with partial updates', () => {
      component.setState({ count: 10, name: 'batch' })

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload).toEqual({ delta: { count: 10, name: 'batch' } })
    })

    it('should emit single STATE_DELTA for multiple properties', () => {
      component.setState({ count: 5, name: 'multi' })

      const messages = getAllSentMessages(ws)
      // setState emits a single message (not one per property)
      expect(messages).toHaveLength(1)
      expect(messages[0].payload.delta).toEqual({ count: 5, name: 'multi' })
    })

    it('should support function updater form', () => {
      component.setState(prev => ({ count: prev.count + 1 }))

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload).toEqual({ delta: { count: 1 } })
    })

    it('should not include unchanged properties from function updater', () => {
      component.setState(prev => ({ count: prev.count + 5 }))

      const msg = getLastSentMessage(ws)
      expect(msg.payload.delta).toEqual({ count: 5 })
      expect(msg.payload.delta.name).toBeUndefined()
    })
  })

  describe('Internal state consistency', () => {
    it('should update internal state correctly with proxy set', () => {
      component.state.count = 99
      expect(component.state.count).toBe(99)
      expect(component.getSerializableState().count).toBe(99)
    })

    it('should update internal state correctly with setState', () => {
      component.setState({ count: 50, name: 'test' })
      expect(component.state.count).toBe(50)
      expect(component.state.name).toBe('test')
    })

    it('should preserve untouched properties after proxy set', () => {
      component.state.count = 10
      expect(component.state.name).toBe('default')
      expect(component.state.items).toEqual([])
    })

    it('should preserve untouched properties after setState', () => {
      component.setState({ count: 10 })
      expect(component.state.name).toBe('default')
      expect(component.state.items).toEqual([])
    })
  })

  describe('Action-driven state changes', () => {
    it('should emit delta when action modifies state via proxy', async () => {
      await component.increment()

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload).toEqual({ delta: { count: 1 } })
    })

    it('should emit delta when action modifies state via setState', async () => {
      await component.batchUpdate({ count: 100, name: 'action-batch' })

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('STATE_DELTA')
      expect(msg.payload.delta).toEqual({ count: 100, name: 'action-batch' })
    })
  })

  describe('Message format', () => {
    it('should include componentId in delta messages', () => {
      component.state.count = 1

      const msg = getLastSentMessage(ws)
      expect(msg.componentId).toBe(component.id)
    })

    it('should include timestamp in delta messages', () => {
      component.state.count = 1

      const msg = getLastSentMessage(ws)
      expect(msg.timestamp).toBeDefined()
      expect(typeof msg.timestamp).toBe('number')
    })
  })
})
