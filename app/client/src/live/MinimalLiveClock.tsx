// 🔥 MinimalLiveClock - Live Component
import { useTypedLiveComponent } from '@/core/client';

// Import component type DIRECTLY from backend - full type inference!
import type { LiveClockComponent } from '@/app/server/live/LiveClockComponent';

export function MinimalLiveClock() {
  const { state, setValue } = useTypedLiveComponent<LiveClockComponent>(
    'LiveClock',
    {
      currentTime: "Loading...",
      timeZone: "America/Sao_Paulo",
      format: "12h",
      showSeconds: true,
      showDate: true,
      lastSync: new Date(),
      serverUptime: 0,
    },
    {
      // Called when WebSocket connects (component not mounted yet - can't use setValue)
      onConnect: () => {
        console.log('onConnect called - WebSocket connected')
      },
      // Called after fresh mount (no prior state)
      onMount: () => {
        console.log('onMount called - changing format to 12h')
        setValue('format', '12h')
      },
      // Called after successful rehydration (restoring prior state)
      onRehydrate: () => {
        console.log('onRehydrate called - keeping format 24h')
        setValue('format', '24h')
      }
    }
  )

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-400/20">
      <div className="text-4xl font-mono font-bold text-white text-center tracking-wider">
        {state.currentTime}
      </div>
      <div className="text-center mt-2">
        <span className="text-xs text-gray-400">{state.timeZone} ({state.format})</span>
      </div>
    </div>
  )
}
