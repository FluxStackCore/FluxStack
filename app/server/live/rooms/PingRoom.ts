// PingRoom - Demo de Binary Codec (msgpack)
//
// Room de latencia para demonstrar mensagens binarias.
// Cada ping envia timestamp, o client calcula o round-trip.

import { LiveRoom } from '@fluxstack/live'
import type { RoomJoinContext, RoomLeaveContext } from '@fluxstack/live'

interface PingState {
  onlineCount: number
  totalPings: number
  lastPingBy: string | null
}

interface PingEvents {
  'ping': { from: string; timestamp: number; seq: number }
  'pong': { from: string; timestamp: number; seq: number; serverTime: number }
}

export class PingRoom extends LiveRoom<PingState, {}, PingEvents> {
  static roomName = 'ping'
  static defaultState: PingState = { onlineCount: 0, totalPings: 0, lastPingBy: null }
  static defaultMeta = {}
  // codec defaults to 'msgpack' — binary wire format

  onJoin(_ctx: RoomJoinContext) {
    this.setState({ onlineCount: this.state.onlineCount + 1 })
  }

  onLeave(_ctx: RoomLeaveContext) {
    this.setState({ onlineCount: Math.max(0, this.state.onlineCount - 1) })
  }

  ping(username: string, seq: number) {
    const total = this.state.totalPings + 1
    this.setState({ totalPings: total, lastPingBy: username })
    this.emit('pong', { from: username, timestamp: Date.now(), seq, serverTime: Date.now() })
    return total
  }
}
