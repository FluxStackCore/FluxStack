// LiveLocalCounter - Counter without room events

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

export class LiveLocalCounter extends LiveComponent<typeof LiveLocalCounter.defaultState> {
  static componentName = 'LiveLocalCounter'
  static defaultState = {
    count: 0
  }

  constructor(initialState: Partial<typeof LiveLocalCounter.defaultState> = {}, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    super(initialState, ws, options)
  }

  async increment() {
    const newCount = this.state.count + 1
    this.setState({ count: newCount })
    return { success: true, count: newCount }
  }

  async decrement() {
    const newCount = this.state.count - 1
    this.setState({ count: newCount })
    return { success: true, count: newCount }
  }

  async reset() {
    this.setState({ count: 0 })
    return { success: true, count: 0 }
  }
}
