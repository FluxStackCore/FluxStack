// ChatRoom - Typed room with lifecycle hooks using @fluxstack/live LiveRoom

import { LiveRoom } from '@fluxstack/live'
import type { RoomJoinContext, RoomLeaveContext } from '@fluxstack/live'

export interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

interface ChatState {
  messages: ChatMessage[]
  onlineCount: number
  isPrivate: boolean
}

interface ChatMeta {
  /** Server-only: password hash. Never sent to clients. */
  password: string | null
  createdBy: string | null
}

interface ChatEvents {
  'chat:message': ChatMessage
}

export class ChatRoom extends LiveRoom<ChatState, ChatMeta, ChatEvents> {
  static roomName = 'chat'
  static defaultState: ChatState = { messages: [], onlineCount: 0, isPrivate: false }
  static defaultMeta: ChatMeta = { password: null, createdBy: null }
  static $options = { maxMembers: 100 }

  /** Set a password for this room. Pass null to remove. */
  setPassword(password: string | null) {
    this.meta.password = password
    this.setState({ isPrivate: password !== null })
  }

  onJoin(ctx: RoomJoinContext) {
    // Validate password if room is protected
    if (this.meta.password) {
      if (ctx.payload?.password !== this.meta.password) {
        return false // Rejected — wrong or missing password
      }
    }
    this.setState({ onlineCount: this.state.onlineCount + 1 })
  }

  onLeave(_ctx: RoomLeaveContext) {
    this.setState({ onlineCount: Math.max(0, this.state.onlineCount - 1) })
  }

  addMessage(user: string, text: string) {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user,
      text,
      timestamp: Date.now(),
    }
    this.setState({
      messages: [...this.state.messages.slice(-99), msg],
    })
    this.emit('chat:message', msg)
    return msg
  }
}
