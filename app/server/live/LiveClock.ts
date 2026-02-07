// 🔥 LiveClock - Relógio em tempo real
// ZERO interfaces! TypeScript infere tudo automaticamente.
import { LiveComponent } from "@core/types/types"

const defaultState = {
  currentTime: '',
  format: '24h' as '12h' | '24h',
  showSeconds: true
}

export class LiveClock extends LiveComponent<typeof defaultState> {
  private clockInterval: ReturnType<typeof setInterval> | null = null

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
    console.log(`🕐 LiveClock created: ${this.id}`)
    this.startClock()
  }

  private startClock() {
    this.updateTime()
    this.clockInterval = setInterval(() => this.updateTime(), 1000)
  }

  private updateTime() {
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: this.state.showSeconds ? '2-digit' : undefined,
      hour12: this.state.format === '12h'
    }
    this.setState({ currentTime: now.toLocaleTimeString('pt-BR', options) })
  }

  async setFormat(payload: { format: '12h' | '24h' }) {
    this.setState({ format: payload.format })
    this.updateTime()
    return { success: true }
  }

  async toggleSeconds() {
    this.setState({ showSeconds: !this.state.showSeconds })
    this.updateTime()
    return { success: true }
  }

  public destroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval)
      this.clockInterval = null
      console.log(`🕐 Clock stopped: ${this.id}`)
    }
    super.destroy()
  }
}
