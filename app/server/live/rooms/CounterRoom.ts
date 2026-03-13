// CounterRoom - Shared counter using typed LiveRoom
//
// All members see the same count value.
// New joiners get the current count from room state.

import { LiveRoom } from '@fluxstack/live'
import type { RoomJoinContext, RoomLeaveContext } from '@fluxstack/live'

interface CounterState {
  count: number
  lastUpdatedBy: string | null
  onlineCount: number
}

interface CounterEvents {
  'counter:updated': { count: number; updatedBy: string }
}

export class CounterRoom extends LiveRoom<CounterState, {}, CounterEvents> {
  static roomName = 'counter'
  static defaultState: CounterState = { count: 0, lastUpdatedBy: null, onlineCount: 0 }
  static defaultMeta = {}

  onJoin(_ctx: RoomJoinContext) {
    this.setState({ onlineCount: this.state.onlineCount + 1 })
  }

  onLeave(_ctx: RoomLeaveContext) {
    this.setState({ onlineCount: Math.max(0, this.state.onlineCount - 1) })
  }

  increment(username: string) {
    const count = this.state.count + 1
    this.setState({ count, lastUpdatedBy: username })
    this.emit('counter:updated', { count, updatedBy: username })
    return count
  }

  decrement(username: string) {
    const count = this.state.count - 1
    this.setState({ count, lastUpdatedBy: username })
    this.emit('counter:updated', { count, updatedBy: username })
    return count
  }

  reset(username: string) {
    this.setState({ count: 0, lastUpdatedBy: username })
    this.emit('counter:updated', { count: 0, updatedBy: username })
    return 0
  }
}
