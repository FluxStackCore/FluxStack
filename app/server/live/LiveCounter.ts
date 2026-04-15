import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { CounterRoom } from './rooms/CounterRoom'

import type { CounterDemo as _Client } from '@client/src/live/CounterDemo'

export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const
  static defaultState = {
    count: 0,
    lastUpdatedBy: null as string | null,
    connectedUsers: 0,
  }

  private roomId: string
  private unsubscribeCounter: (() => void) | null = null
  private unsubscribePresence: (() => void) | null = null

  constructor(
    initialState: Partial<typeof LiveCounter.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    this.roomId = options?.room ?? 'default'
    const room = this.$room(CounterRoom, this.roomId)
    room.join()

    this.setState({
      count: room.state.count,
      lastUpdatedBy: room.state.lastUpdatedBy,
      connectedUsers: room.state.onlineCount,
    })

    this.unsubscribeCounter = room.on('counter:updated', (data) => {
      this.setState({
        count: data.count,
        lastUpdatedBy: data.updatedBy,
      })
    })

    this.unsubscribePresence = room.on('presence:changed', (data) => {
      this.setState({ connectedUsers: data.onlineCount })
    })
  }

  async increment() {
    const room = this.$room(CounterRoom, this.roomId)
    const count = room.increment(this.userId || 'anonymous')
    return { success: true, count }
  }

  async decrement() {
    const room = this.$room(CounterRoom, this.roomId)
    const count = room.decrement(this.userId || 'anonymous')
    return { success: true, count }
  }

  async reset() {
    const room = this.$room(CounterRoom, this.roomId)
    const count = room.reset(this.userId || 'anonymous')
    return { success: true, count }
  }

  destroy() {
    this.unsubscribeCounter?.()
    this.unsubscribePresence?.()
    super.destroy()
  }
}
