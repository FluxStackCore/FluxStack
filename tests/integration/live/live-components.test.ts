import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LiveComponent, setLiveComponentContext, RoomEventBus, LiveRoomManager } from '@fluxstack/live'
import type { GenericWebSocket as FluxStackWebSocket } from '@fluxstack/live'

// Set up DI context for LiveComponent
const testRoomEvents = new RoomEventBus()
const testRoomManager = new LiveRoomManager(testRoomEvents)
setLiveComponentContext({
  roomEvents: testRoomEvents,
  roomManager: testRoomManager,
  debugger: { enabled: false, trackStateChange: () => {}, trackAction: () => {}, trackError: () => {} } as any,
})

/** Flush pending queueMicrotask callbacks (WsSendBatcher) */
const flush = () => new Promise<void>(r => queueMicrotask(r))

// Test component
interface ChatState {
  messages: Array<{ id: number; text: string }>
  joined: boolean
}

class ChatComponent extends LiveComponent<ChatState> {
  static componentName = 'IntegrationChat'
  static defaultState: ChatState = { messages: [], joined: false }

  async sendMessage(payload: { text: string }) {
    const msg = { id: Date.now(), text: payload.text }
    this.state.messages = [...this.state.messages, msg]
    return { success: true }
  }

  async joinRoom(payload: { roomId: string }) {
    this.$room(payload.roomId).join()
    this.$room(payload.roomId).on('chat:message', (msg: { id: number; text: string }) => {
      this.state.messages = [...this.state.messages, msg]
    })
    this.state.joined = true
    return { success: true }
  }
}

function createMockWs(): FluxStackWebSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
    data: {
      connectionId: `conn-${Math.random().toString(36).slice(2)}`,
      components: new Map(),
      subscriptions: new Set(),
      connectedAt: new Date(),
    },
    remoteAddress: '127.0.0.1',
    readyState: 1,
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

describe('Live Components - Integration', () => {
  let ws: FluxStackWebSocket

  beforeEach(async () => {
    ws = createMockWs()
  })

  it('component mount and initial state sync', async () => {
    const component = new ChatComponent({}, ws)
    await flush()

    // Component should be initialized with default state
    expect(component.state.messages).toEqual([])
    expect(component.state.joined).toBe(false)

    // Serializable state should match the in-memory state
    const serialized = component.getSerializableState()
    expect(serialized.messages).toEqual([])
    expect(serialized.joined).toBe(false)

    // Component should have a unique id assigned
    expect(component.id).toBeDefined()
    expect(typeof component.id).toBe('string')
    expect(component.id.length).toBeGreaterThan(0)
  })

  it('action execution updates state and emits delta', async () => {
    const component = new ChatComponent({}, ws)
    await flush()
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    await component.sendMessage({ text: 'Hello World' })
    await flush()

    const msg = getLastSentMessage(ws)
    expect(msg.type).toBe('STATE_DELTA')
    expect(msg.payload.delta.messages).toBeDefined()
    expect(msg.payload.delta.messages).toHaveLength(1)
    expect(msg.payload.delta.messages[0].text).toBe('Hello World')
  })

  it('room join and cross-component event broadcasting', async () => {
    const wsA = createMockWs()
    const wsB = createMockWs()

    const componentA = new ChatComponent({}, wsA)
    const componentB = new ChatComponent({}, wsB)
    await flush()

    // Both join the same room
    await componentA.joinRoom({ roomId: 'test-room' })
    await componentB.joinRoom({ roomId: 'test-room' })
    await flush()

    // Clear mocks after join
    ;(wsA.send as ReturnType<typeof vi.fn>).mockClear()
    ;(wsB.send as ReturnType<typeof vi.fn>).mockClear()

    // Component A emits an event to the room
    const testMessage = { id: 999, text: 'Cross-component message' }
    componentA.$room('test-room').emit('chat:message', testMessage)
    await flush()

    // Component B should have received the event and updated its state
    expect(componentB.state.messages).toContainEqual(testMessage)
  })

  it('component destroy cleans up subscriptions', async () => {
    const component = new ChatComponent({}, ws)
    await flush()

    await component.joinRoom({ roomId: 'cleanup-room' })
    await flush()
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    // Destroy the component
    component.destroy()

    // Emit event to the room after destroy — component should not receive it
    const messageCountBefore = component.state.messages.length
    testRoomEvents.emit('cleanup-room', 'chat:message', { id: 1, text: 'after-destroy' })
    await flush()

    // Messages should not have changed after destroy
    expect(component.state.messages.length).toBe(messageCountBefore)
  })
})
