// LiveSharedCounter - Shared counter using typed CounterRoom
//
// All connected clients share the same counter value.
// New joiners see the current value from room state.

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { CounterRoom } from './rooms/CounterRoom'

// Componente Cliente (Ctrl+Click para navegar)
import type { SharedCounterDemo as _Client } from '@client/src/live/SharedCounterDemo'

export class LiveSharedCounter extends LiveComponent<typeof LiveSharedCounter.defaultState> {
  static componentName = 'LiveSharedCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const
  static defaultState = {
    username: '',
    count: 0,
    lastUpdatedBy: null as string | null,
    onlineCount: 0
  }

  private counterUnsub: (() => void) | null = null

  constructor(
    initialState: Partial<typeof LiveSharedCounter.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    // Join the shared counter room
    const room = this.$room(CounterRoom, 'global')
    room.join()

    // Load current state from room (new joiners see the current value)
    this.setState({
      count: room.state.count,
      lastUpdatedBy: room.state.lastUpdatedBy,
      onlineCount: room.state.onlineCount
    })

    // Listen for updates from other users
    this.counterUnsub = room.on('counter:updated', (data) => {
      this.setState({
        count: data.count,
        lastUpdatedBy: data.updatedBy
      })
    })
  }

  async increment() {
    const room = this.$room(CounterRoom, 'global')
    const count = room.increment(this.state.username || 'Anonymous')
    return { success: true, count }
  }

  async decrement() {
    const room = this.$room(CounterRoom, 'global')
    const count = room.decrement(this.state.username || 'Anonymous')
    return { success: true, count }
  }

  async reset() {
    const room = this.$room(CounterRoom, 'global')
    const count = room.reset(this.state.username || 'Anonymous')
    return { success: true, count }
  }

  destroy() {
    this.counterUnsub?.()
    super.destroy()
  }
}
