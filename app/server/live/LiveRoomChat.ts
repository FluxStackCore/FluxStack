// LiveRoomChat - Chat multi-salas using typed LiveRoom system

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { ChatRoom } from './rooms/ChatRoom'
import { DirectoryRoom } from './rooms/DirectoryRoom'
import type { ChatMessage } from './rooms/ChatRoom'
import type { DirectoryEntry } from './rooms/DirectoryRoom'

// Componente Cliente (Ctrl+Click para navegar)
import type { RoomChatDemo as _Client } from '@client/src/live/RoomChatDemo'

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

  // Track event unsubscribers per room
  private roomListeners = new Map<string, (() => void)[]>()
  private directoryUnsubs: (() => void)[] = []

  constructor(
    initialState: Partial<typeof LiveRoomChat.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    // Auto-join the directory room so we can see rooms created by others
    const dir = this.$room(DirectoryRoom, 'main')
    dir.join()

    // Load existing custom rooms from directory state
    this.setState({ customRooms: dir.state.rooms || [] })

    // Listen for new rooms being added
    const unsubAdd = dir.on('room:added', (entry: DirectoryEntry) => {
      const current = this.state.customRooms.filter(r => r.id !== entry.id)
      this.setState({ customRooms: [...current, entry] })
    })

    // Listen for rooms being removed
    const unsubRemove = dir.on('room:removed', (data: { id: string }) => {
      this.setState({
        customRooms: this.state.customRooms.filter(r => r.id !== data.id)
      })
    })

    this.directoryUnsubs = [unsubAdd, unsubRemove]
  }

  async createRoom(payload: { roomId: string; roomName: string; password?: string }) {
    const { roomId, roomName, password } = payload

    if (!roomId || !roomName) throw new Error('Room ID and name are required')
    if (roomId.length > 30 || roomName.length > 50) throw new Error('Room ID/name too long')

    // Create by joining the room first
    const room = this.$room(ChatRoom, roomId)
    const result = room.join()

    if ('rejected' in result && result.rejected) {
      return { success: false, error: result.reason }
    }

    // Set password and creator (meta is server-only, never sent to clients)
    if (password) {
      room.setPassword(password)
    }
    room.meta.createdBy = this.state.username || 'Anonymous'

    // Register in the directory so all users can see it
    const dir = this.$room(DirectoryRoom, 'main')
    dir.addRoom({
      id: roomId,
      name: roomName,
      isPrivate: !!password,
      createdBy: this.state.username || 'Anonymous'
    })

    // Listen for messages
    const unsub = room.on('chat:message', (msg: ChatMessage) => {
      const msgs = this.state.messages[roomId] || []
      this.setState({
        messages: { ...this.state.messages, [roomId]: [...msgs, msg].slice(-100) }
      })
    })
    this.roomListeners.set(roomId, [unsub])

    this.setState({
      activeRoom: roomId,
      rooms: [...this.state.rooms.filter(r => r.id !== roomId), { id: roomId, name: roomName, isPrivate: !!password }],
      messages: { ...this.state.messages, [roomId]: [] }
    })

    return { success: true, roomId }
  }

  async joinRoom(payload: { roomId: string; roomName?: string; password?: string }) {
    const { roomId, roomName, password } = payload

    // Already in room? Just activate it
    if (this.roomListeners.has(roomId)) {
      this.state.activeRoom = roomId
      return { success: true, roomId }
    }

    // Use typed room: $room(ChatRoom, instanceId)
    const room = this.$room(ChatRoom, roomId)
    const result = room.join({ password })

    if ('rejected' in result && result.rejected) {
      return { success: false, error: 'Senha incorreta' }
    }

    // Listen for chat messages from other members
    const unsub = room.on('chat:message', (msg: ChatMessage) => {
      const msgs = this.state.messages[roomId] || []
      this.setState({
        messages: { ...this.state.messages, [roomId]: [...msgs, msg].slice(-100) }
      })
    })
    this.roomListeners.set(roomId, [unsub])

    // Update component state — load existing messages from room state
    this.setState({
      activeRoom: roomId,
      rooms: [...this.state.rooms.filter(r => r.id !== roomId), { id: roomId, name: roomName || roomId, isPrivate: room.state.isPrivate }],
      messages: { ...this.state.messages, [roomId]: room.state.messages || [] }
    })

    return { success: true, roomId }
  }

  async leaveRoom(payload: { roomId: string }) {
    const { roomId } = payload

    // Cleanup listeners
    this.roomListeners.get(roomId)?.forEach(fn => fn())
    this.roomListeners.delete(roomId)
    this.$room(ChatRoom, roomId).leave()

    // Update state
    const rooms = this.state.rooms.filter(r => r.id !== roomId)
    const { [roomId]: _, ...restMessages } = this.state.messages

    this.setState({
      rooms,
      activeRoom: this.state.activeRoom === roomId ? (rooms[0]?.id || null) : this.state.activeRoom,
      messages: restMessages
    })

    return { success: true }
  }

  async switchRoom(payload: { roomId: string }) {
    if (!this.roomListeners.has(payload.roomId)) throw new Error('Not in this room')
    this.state.activeRoom = payload.roomId
    return { success: true }
  }

  async sendMessage(payload: { text: string }) {
    const roomId = this.state.activeRoom
    if (!roomId) throw new Error('No active room')

    const text = payload.text?.trim()
    if (!text) throw new Error('Message cannot be empty')

    // Use typed room's custom method — the chat:message event handler
    // (set up in joinRoom) updates component state for all members including sender
    const room = this.$room(ChatRoom, roomId)
    const message = room.addMessage(this.state.username || 'Anonymous', text)

    return { success: true, message }
  }

  async setUsername(payload: { username: string }) {
    const username = payload.username?.trim()
    if (!username || username.length > 30) throw new Error('Invalid username')
    this.state.username = username
    return { success: true }
  }

  destroy() {
    for (const fns of this.roomListeners.values()) fns.forEach(fn => fn())
    this.roomListeners.clear()
    this.directoryUnsubs.forEach(fn => fn())
    this.directoryUnsubs = []
    super.destroy()
  }
}
