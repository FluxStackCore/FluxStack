// 🔥 MinimalLiveClock - usando nova API Live.use()
import { Live } from '@/core/client'
import { LiveClock } from '@server/live/LiveClock'

export function MinimalLiveClock() {
  const clock = Live.use(LiveClock, {
    currentTime: '--:--:--',
    format: '24h',
    showSeconds: true
  })

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-400/20">
      <div className="text-4xl font-mono font-bold text-white text-center tracking-wider">
        {clock.currentTime}
      </div>
      <div className="text-center mt-2 text-xs text-gray-400">
        {clock.format} {clock.showSeconds ? '+ segundos' : ''}
      </div>
    </div>
  )
}
