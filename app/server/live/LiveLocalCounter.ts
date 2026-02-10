// LiveLocalCounter - Contador sem eventos de sala

import { LiveComponent } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { CounterDemo as _Client } from '@client/src/live/CounterDemo'

export class LiveLocalCounter extends LiveComponent<typeof LiveLocalCounter.defaultState> {
  static componentName = 'LiveLocalCounter'
  static defaultState = {
    count: 0,
    clicks: 0
  }

  async increment() {
    this.state.count++
    this.state.clicks++
    return { success: true, count: this.state.count }
  }

  async decrement() {
    this.state.count--
    this.state.clicks++
    return { success: true, count: this.state.count }
  }

  async reset() {
    this.state.count = 0
    this.state.clicks++
    return { success: true, count: 0 }
  }
}
