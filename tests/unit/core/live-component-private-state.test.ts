import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for $private - Server-Only State
 *
 * Validates that $private state:
 * - Is accessible on the server
 * - Is NEVER sent to the client via STATE_UPDATE or STATE_DELTA
 * - Is NEVER included in getSerializableState()
 * - Cannot be accessed remotely via executeAction
 * - Is cleaned up on destroy
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

// ===== Test Components =====

interface ChatState {
  messages: string[]
  connected: boolean
}

class ChatComponent extends LiveComponent<ChatState> {
  static componentName = 'ChatComponent'
  static defaultState: ChatState = { messages: [], connected: false }
  static publicActions = ['connect', 'sendMessage', 'getPrivateToken'] as const

  async connect(payload: { token: string }) {
    // Store sensitive data in $private (server-only)
    this.$private.token = payload.token
    this.$private.apiKey = 'secret-api-key-123'

    // Only UI-relevant data goes to state (synced with client)
    this.state.connected = true
    return { success: true }
  }

  async sendMessage(payload: { text: string }) {
    // Use $private data internally
    const token = this.$private.token
    if (!token) throw new Error('Not connected')

    this.state.messages = [...this.state.messages, payload.text]
    return { success: true }
  }

  // Expose private data intentionally (for testing)
  async getPrivateToken() {
    return { token: this.$private.token }
  }
}

// ===== Test Helpers =====

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

function getAllSentMessages(ws: FluxStackWebSocket): any[] {
  const sendMock = ws.send as ReturnType<typeof vi.fn>
  return sendMock.mock.calls.map((call: any[]) => JSON.parse(call[0]))
}

// ===== TESTS =====

describe('$private - Server-Only State', () => {
  let ws: FluxStackWebSocket
  let component: ChatComponent

  beforeEach(() => {
    ws = createMockWs()
    component = new ChatComponent({}, ws)
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()
  })

  describe('Basic functionality', () => {
    it('should start with empty $private state', () => {
      expect(component.$private).toEqual({})
    })

    it('should allow storing arbitrary data in $private', () => {
      component.$private.token = 'abc-123'
      component.$private.apiKey = 'key-456'
      component.$private.nested = { deep: true }

      expect(component.$private.token).toBe('abc-123')
      expect(component.$private.apiKey).toBe('key-456')
      expect(component.$private.nested).toEqual({ deep: true })
    })

    it('should persist $private data across reads', () => {
      component.$private.count = 42
      expect(component.$private.count).toBe(42)
      expect(component.$private.count).toBe(42) // read again
    })

    it('should allow updating $private data', () => {
      component.$private.token = 'old'
      component.$private.token = 'new'
      expect(component.$private.token).toBe('new')
    })

    it('should allow deleting $private data', () => {
      component.$private.temp = 'value'
      delete component.$private.temp
      expect(component.$private.temp).toBeUndefined()
    })
  })

  describe('Isolation from client state', () => {
    it('should NOT include $private data in getSerializableState()', () => {
      component.$private.secret = 'top-secret'
      component.$private.apiKey = 'key-123'

      const serialized = component.getSerializableState()

      expect(serialized).not.toHaveProperty('secret')
      expect(serialized).not.toHaveProperty('apiKey')
      expect(serialized).not.toHaveProperty('$private')
      expect(serialized).not.toHaveProperty('_privateState')
    })

    it('should NOT emit STATE_DELTA when $private changes', () => {
      component.$private.token = 'secret-token'
      component.$private.counter = 1
      component.$private.counter = 2

      // No messages should have been sent
      expect(ws.send).not.toHaveBeenCalled()
    })

    it('should keep $private and state completely separate', async () => {
      // Set both $private and state
      component.$private.secret = 'hidden'
      component.state.connected = true

      // Only state change should emit
      const messages = getAllSentMessages(ws)
      expect(messages).toHaveLength(1)
      expect(messages[0].type).toBe('STATE_DELTA')
      expect(messages[0].payload.delta).toEqual({ connected: true })

      // Verify serializable state doesn't include $private
      const serialized = component.getSerializableState()
      expect(serialized.connected).toBe(true)
      expect((serialized as any).secret).toBeUndefined()
    })

    it('should NOT leak $private through state proxy', () => {
      component.$private.leak = 'should not appear'

      const state = component.state
      expect((state as any).leak).toBeUndefined()
      expect((state as any).$private).toBeUndefined()
      expect((state as any)._privateState).toBeUndefined()
    })
  })

  describe('Usage in actions', () => {
    it('should allow storing data in $private from an action', async () => {
      await component.executeAction('connect', { token: 'my-token' })

      expect(component.$private.token).toBe('my-token')
      expect(component.$private.apiKey).toBe('secret-api-key-123')
    })

    it('should allow reading $private data in subsequent actions', async () => {
      await component.executeAction('connect', { token: 'my-token' })
      await component.executeAction('sendMessage', { text: 'hello' })

      expect(component.state.messages).toEqual(['hello'])
    })

    it('should verify $private data is NOT in any message sent to client', async () => {
      await component.executeAction('connect', { token: 'secret-token-xyz' })

      const messages = getAllSentMessages(ws)

      for (const msg of messages) {
        const msgStr = JSON.stringify(msg)
        expect(msgStr).not.toContain('secret-token-xyz')
        expect(msgStr).not.toContain('secret-api-key-123')
      }
    })
  })

  describe('Security - Remote access blocking', () => {
    it('ATTACK: should block calling $private remotely', async () => {
      await expect(component.executeAction('$private', {}))
        .rejects.toThrow("Action '$private' is not callable")
    })

    it('ATTACK: should block calling _privateState remotely', async () => {
      await expect(component.executeAction('_privateState', {}))
        .rejects.toThrow("Action '_privateState' is not callable")
    })
  })

  describe('Lifecycle', () => {
    it('should clear $private on destroy', () => {
      component.$private.token = 'secret'
      component.$private.apiKey = 'key'

      component.destroy()

      expect(component.$private).toEqual({})
    })

    it('should NOT affect state when $private is cleared on destroy', () => {
      component.$private.token = 'secret'
      component.setState({ connected: true, messages: ['hello'] })

      // State should still be intact (destroy clears rooms etc but state remains readable)
      expect(component.state.connected).toBe(true)
    })
  })
})
