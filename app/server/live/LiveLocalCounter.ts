// LiveLocalCounter - Counter without room events

import { LiveComponent } from '@core/types/types'

export const defaultState = {
  count: 0
}

export class LiveLocalCounter extends LiveComponent<typeof defaultState> {
  static componentName = 'LiveLocalCounter'
  static defaultState = defaultState

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
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
