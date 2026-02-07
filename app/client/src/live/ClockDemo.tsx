// 🔥 Live Component Demo - Proxy-based State Access
import { useLiveComponent } from '@core/client'

interface ClockState {
  currentTime: string
  format: '12h' | '24h'
  showSeconds: boolean
}

// Actions do servidor (para autocomplete)
type ClockActions = {
  setTimeFormat: (payload: { format: '12h' | '24h' }) => Promise<{ success: boolean }>
  toggleSeconds: (payload?: { showSeconds?: boolean }) => Promise<{ success: boolean }>
  getServerInfo: () => Promise<{ success: boolean; info: any }>
  syncTime: () => Promise<{ success: boolean }>
}

export function ClockDemo() {
  // ✨ Estado + Actions do servidor como se fossem locais
  const clock = useLiveComponent<ClockState, ClockActions>('LiveClock', {
    currentTime: '',
    format: '24h',
    showSeconds: true
  })

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Live Clock</h2>

      {/* Status */}
      <div className="flex gap-2 text-sm">
        <span className={clock.$connected ? 'text-green-600' : 'text-red-600'}>
          {clock.$connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
        {clock.$loading && <span>⏳ Loading...</span>}
      </div>

      {/* Time - lê direto do proxy */}
      <div className="text-5xl font-mono">
        {clock.currentTime || '--:--:--'}
      </div>

      {/* Controls - escreve direto no proxy */}
      <div className="flex gap-4">
        <button
          onClick={() => clock.format = '12h'}
          className={`px-4 py-2 rounded ${clock.format === '12h' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          12h
        </button>
        <button
          onClick={() => clock.format = '24h'}
          className={`px-4 py-2 rounded ${clock.format === '24h' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          24h
        </button>
        <button
          onClick={() => clock.showSeconds = !clock.showSeconds}
          className={`px-4 py-2 rounded ${clock.showSeconds ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
        >
          Seconds: {clock.showSeconds ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* ✨ Actions chamadas diretamente como métodos! */}
      <div className="flex gap-4">
        <button
          onClick={async () => {
            const result = await clock.getServerInfo()
            alert(JSON.stringify(result.info, null, 2))
          }}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Get Server Info
        </button>

        <button
          onClick={() => clock.setTimeFormat({ format: '12h' })}
          className="px-4 py-2 bg-indigo-500 text-white rounded"
        >
          Set 12h via Action
        </button>

        <button
          onClick={() => clock.syncTime()}
          className="px-4 py-2 bg-teal-500 text-white rounded"
        >
          Sync Time
        </button>
      </div>
    </div>
  )
}
