// 🔥 ClockDemo - usando nova API Live.use()
import { Live } from '@/core/client'
import { LiveClock } from '@server/live/LiveClock'

export function ClockDemo() {
  const clock = Live.use(LiveClock, {
    currentTime: '--:--:--',
    format: '24h',
    showSeconds: true
  })

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-white">Live Clock</h2>

      {/* Status */}
      <div className="flex gap-2 text-sm">
        <span className={clock.$connected ? 'text-green-400' : 'text-red-400'}>
          {clock.$connected ? '🟢 Conectado' : '🔴 Desconectado'}
        </span>
        {clock.$loading && <span className="text-yellow-400">⏳ Carregando...</span>}
      </div>

      {/* Time */}
      <div className="text-5xl font-mono text-white">
        {clock.currentTime}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={() => clock.setFormat({ format: '12h' })}
          className={`px-4 py-2 rounded ${clock.format === '12h' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          12h
        </button>
        <button
          onClick={() => clock.setFormat({ format: '24h' })}
          className={`px-4 py-2 rounded ${clock.format === '24h' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          24h
        </button>
        <button
          onClick={() => clock.toggleSeconds()}
          className={`px-4 py-2 rounded ${clock.showSeconds ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          Segundos: {clock.showSeconds ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
