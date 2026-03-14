// LivePingPong - Demo de Binary Codec (msgpack)
//
// Demonstra o wire format binario do sistema de rooms.
// Client envia ping, server responde pong via room event (msgpack).
// Round-trip time calculado no client.

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { PingRoom } from './rooms/PingRoom'

// Componente Cliente (Ctrl+Click para navegar)
import type { PingPongDemo as _Client } from '@client/src/live/PingPongDemo'

export class LivePingPong extends LiveComponent<typeof LivePingPong.defaultState> {
  static componentName = 'LivePingPong'
  static publicActions = ['ping'] as const
  static defaultState = {
    username: '',
    onlineCount: 0,
    totalPings: 0,
    lastPingBy: null as string | null,
  }

  private pongUnsub: (() => void) | null = null

  constructor(
    initialState: Partial<typeof LivePingPong.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    const room = this.$room(PingRoom, 'global')
    room.join()

    // Sync room state on join
    this.setState({
      onlineCount: room.state.onlineCount,
      totalPings: room.state.totalPings,
      lastPingBy: room.state.lastPingBy,
    })

    // Listen for pong events (binary msgpack)
    this.pongUnsub = room.on('pong', (data) => {
      this.setState({
        totalPings: this.state.totalPings + 1,
        lastPingBy: data.from,
      })
    })
  }

  async ping(payload: { seq: number }) {
    const room = this.$room(PingRoom, 'global')
    const total = room.ping(this.state.username || 'Anonymous', payload.seq)
    return { success: true, total }
  }

  destroy() {
    this.pongUnsub?.()
    super.destroy()
  }
}
