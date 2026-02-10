// LiveRoomChat - Chat usando o sistema de salas $room

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { RoomChatDemo as _Client } from '@client/src/live/RoomChatDemo'

// Tipos
export interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

export interface RoomInfo {
  id: string
  name: string
}

export class LiveRoomChat extends LiveComponent<typeof LiveRoomChat.defaultState> {
  static componentName = 'LiveRoomChat'
  static defaultState = {
    username: '',
    activeRoom: null as string | null,
    rooms: [] as RoomInfo[],
    messages: {} as Record<string, ChatMessage[]>,
    typingUsers: {} as Record<string, string[]>
  }
  protected roomType = 'room-chat'

  private typingTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    initialState: Partial<typeof LiveRoomChat.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)
  }

  // ===== Gerenciamento de Salas =====

  /**
   * Entrar em uma sala de chat
   */
  async joinRoom(payload: { roomId: string; roomName?: string }) {
    const { roomId, roomName } = payload

    // Entrar na sala
    this.$room(roomId).join()

    // Escutar mensagens novas de outros usuários
    this.$room(roomId).on('message:new', (msg: ChatMessage) => {
      this.addMessageToState(roomId, msg)
    })

    // Escutar usuários digitando
    this.$room(roomId).on('user:typing', (data: { user: string; typing: boolean }) => {
      this.updateTypingUsers(roomId, data.user, data.typing)
    })

    // Atualizar lista de salas e inicializar mensagens
    const rooms = [
      ...this.state.rooms.filter(r => r.id !== roomId),
      { id: roomId, name: roomName || roomId }
    ]

    this.setState({
      rooms,
      activeRoom: roomId,
      messages: {
        ...this.state.messages,
        [roomId]: this.state.messages[roomId] || []
      },
      typingUsers: {
        ...this.state.typingUsers,
        [roomId]: []
      }
    })

    return {
      success: true,
      roomId,
      rooms: this.$rooms
    }
  }

  private addMessageToState(roomId: string, msg: ChatMessage) {
    const currentMessages = this.state.messages[roomId] || []
    const newMessages = [...currentMessages, msg].slice(-100)

    this.setState({
      messages: {
        ...this.state.messages,
        [roomId]: newMessages
      }
    })
  }

  private updateTypingUsers(roomId: string, user: string, typing: boolean) {
    const current = this.state.typingUsers[roomId] || []
    let updated: string[]

    if (typing && !current.includes(user)) {
      updated = [...current, user]
    } else if (!typing) {
      updated = current.filter(u => u !== user)
    } else {
      return // Sem mudança
    }

    this.setState({
      typingUsers: {
        ...this.state.typingUsers,
        [roomId]: updated
      }
    })
  }

  /**
   * Sair de uma sala
   */
  async leaveRoom(payload: { roomId: string }) {
    const { roomId } = payload

    // Sair da sala
    this.$room(roomId).leave()

    // Atualizar lista
    const rooms = this.state.rooms.filter(r => r.id !== roomId)
    const activeRoom = this.state.activeRoom === roomId
      ? (rooms[0]?.id || null)
      : this.state.activeRoom

    // Remover mensagens e typing da sala
    const { [roomId]: _msgs, ...restMessages } = this.state.messages
    const { [roomId]: _typing, ...restTyping } = this.state.typingUsers

    this.setState({
      rooms,
      activeRoom,
      messages: restMessages,
      typingUsers: restTyping
    })

    return {
      success: true,
      rooms: this.$rooms
    }
  }

  /**
   * Trocar sala ativa (para UI)
   */
  async switchRoom(payload: { roomId: string }) {
    if (!this.$rooms.includes(payload.roomId)) {
      throw new Error('Not in this room')
    }

    this.setState({ activeRoom: payload.roomId })
    return { success: true }
  }

  // ===== Mensagens =====

  /**
   * Enviar mensagem para sala ativa
   */
  async sendMessage(payload: { text: string; roomId?: string }) {
    const roomId = payload.roomId || this.state.activeRoom
    if (!roomId) throw new Error('No active room')

    const text = payload.text?.trim()
    if (!text) throw new Error('Message cannot be empty')
    if (text.length > 1000) throw new Error('Message too long')

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: this.state.username || 'Anônimo',
      text,
      timestamp: Date.now()
    }

    // Adicionar ao meu estado local
    this.addMessageToState(roomId, message)

    // Emitir para outros na sala (eles vão receber via $room.on)
    this.$room(roomId).emit('message:new', message)

    // Parar de digitar
    this.stopTyping({ roomId })

    return { success: true, message }
  }

  /**
   * Indicar que está digitando
   */
  async startTyping(payload: { roomId?: string }) {
    const roomId = payload.roomId || this.state.activeRoom
    if (!roomId) return { success: false }

    // Emitir evento
    this.$room(roomId).emit('user:typing', {
      user: this.state.username,
      typing: true
    })

    // Limpar timer anterior
    const existingTimer = this.typingTimers.get(roomId)
    if (existingTimer) clearTimeout(existingTimer)

    // Auto-parar após 3 segundos
    const timer = setTimeout(() => {
      this.stopTyping({ roomId })
    }, 3000)
    this.typingTimers.set(roomId, timer)

    return { success: true }
  }

  /**
   * Parar de digitar
   */
  async stopTyping(payload: { roomId?: string }) {
    const roomId = payload.roomId || this.state.activeRoom
    if (!roomId) return { success: false }

    // Limpar timer
    const timer = this.typingTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      this.typingTimers.delete(roomId)
    }

    // Emitir evento
    this.$room(roomId).emit('user:typing', {
      user: this.state.username,
      typing: false
    })

    return { success: true }
  }

  // ===== Configuração =====

  /**
   * Definir nome do usuário
   */
  async setUsername(payload: { username: string }) {
    const username = payload.username?.trim()
    if (!username) throw new Error('Username required')
    if (username.length > 30) throw new Error('Username too long')

    this.setState({ username })
    return { success: true, username }
  }

  /**
   * Obter estado de uma sala
   */
  async getRoomState(payload: { roomId: string }) {
    const state = this.$room(payload.roomId).state
    return {
      success: true,
      state: {
        messages: state.messages || [],
        typingUsers: state.typingUsers || []
      }
    }
  }

  // ===== Cleanup =====

  public destroy() {
    // Limpar timers
    for (const timer of this.typingTimers.values()) {
      clearTimeout(timer)
    }
    this.typingTimers.clear()

    super.destroy()
  }
}
