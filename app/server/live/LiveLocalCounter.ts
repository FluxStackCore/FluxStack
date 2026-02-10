// LiveLocalCounter - Counter without room events

import { LiveComponent } from '@core/types/types'

export class LiveLocalCounter extends LiveComponent<typeof LiveLocalCounter.defaultState> {
  static componentName = 'LiveLocalCounter'
  static defaultState = {
    count: 0
  }

  async increment() {
    this.state.count++
    return { success: true, count: this.state.count }
  }

  async decrement() {
    this.state.count--
    return { success: true, count: this.state.count }
  }

  async reset() {
    this.state.count = 0
    return { success: true, count: 0 }
  }
}
