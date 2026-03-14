// PingPongDemo - Demo de Binary Codec (msgpack)
//
// Mostra latencia round-trip de mensagens binárias.
// Cada ping viaja como msgpack binário pelo WebSocket.
// Abra em varias abas para ver o onlineCount e totalPings compartilhados.

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Live } from '@/core/client'
import { LivePingPong } from '@server/live/LivePingPong'
import type { PingRoom } from '@server/live/rooms/PingRoom'

interface PingEntry {
  seq: number
  sentAt: number
  rtt: number | null
}

export function PingPongDemo() {
  const username = useMemo(() => {
    const adj = ['Swift', 'Rapid', 'Quick', 'Turbo', 'Flash'][Math.floor(Math.random() * 5)]
    const noun = ['Ping', 'Bolt', 'Wave', 'Pulse', 'Beam'][Math.floor(Math.random() * 5)]
    return `${adj}${noun}${Math.floor(Math.random() * 100)}`
  }, [])

  const live = Live.use(LivePingPong, {
    initialState: { ...LivePingPong.defaultState, username },
  })

  const [pings, setPings] = useState<PingEntry[]>([])
  const [avgRtt, setAvgRtt] = useState<number | null>(null)
  const [minRtt, setMinRtt] = useState<number | null>(null)
  const [maxRtt, setMaxRtt] = useState<number | null>(null)
  const seqRef = useRef(0)
  const pendingRef = useRef<Map<number, number>>(new Map())

  // Listen for pong events (binary msgpack from server)
  useEffect(() => {
    const unsub = live.$room<PingRoom>('ping:global').on('pong', (data) => {
      const sentAt = pendingRef.current.get(data.seq)
      if (sentAt == null) return
      pendingRef.current.delete(data.seq)

      const rtt = Date.now() - sentAt

      setPings(prev => {
        const updated = [{ seq: data.seq, sentAt, rtt }, ...prev].slice(0, 20)
        // Compute stats
        const rtts = updated.filter(p => p.rtt != null).map(p => p.rtt!)
        if (rtts.length > 0) {
          setAvgRtt(Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length))
          setMinRtt(Math.min(...rtts))
          setMaxRtt(Math.max(...rtts))
        }
        return updated
      })
    })
    return unsub
  }, [])

  const sendPing = useCallback(() => {
    const seq = ++seqRef.current
    pendingRef.current.set(seq, Date.now())
    live.ping({ seq })
  }, [live])

  // Auto-ping mode
  const [autoPing, setAutoPing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (autoPing && live.$connected) {
      intervalRef.current = setInterval(sendPing, 500)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoPing, live.$connected, sendPing])

  const onlineCount = live.$state.onlineCount
  const totalPings = live.$state.totalPings
  const lastPingBy = live.$state.lastPingBy

  const rttColor = (rtt: number) => {
    if (rtt < 10) return 'text-emerald-400'
    if (rtt < 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Ping Pong Binary</h2>
        <p className="text-sm text-gray-400">
          Mensagens binárias via <code className="text-cyan-400">msgpack</code> — round-trip latency demo
        </p>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${live.$connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-sm text-gray-400">{live.$connected ? 'Conectado' : 'Desconectado'}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <span className="text-sm text-gray-400">{onlineCount} online</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-xs text-cyan-300">{username}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 w-full">
        <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white tabular-nums">
            {avgRtt != null ? `${avgRtt}ms` : '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">AVG RTT</div>
        </div>
        <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {minRtt != null ? `${minRtt}ms` : '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">MIN RTT</div>
        </div>
        <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400 tabular-nums">
            {maxRtt != null ? `${maxRtt}ms` : '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">MAX RTT</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={sendPing}
          disabled={!live.$connected || live.$loading}
          className="px-8 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-lg font-bold hover:bg-cyan-500/30 active:scale-95 disabled:opacity-50 transition-all"
        >
          Ping!
        </button>
        <button
          onClick={() => setAutoPing(!autoPing)}
          disabled={!live.$connected}
          className={`px-6 h-14 rounded-2xl border text-sm font-medium transition-all ${
            autoPing
              ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30'
              : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'
          }`}
        >
          {autoPing ? 'Auto ON' : 'Auto OFF'}
        </button>
      </div>

      {/* Global stats */}
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <span>Total pings: <span className="text-white font-mono">{totalPings}</span></span>
        {lastPingBy && <span>Ultimo: <span className="text-gray-300">{lastPingBy}</span></span>}
      </div>

      {/* Ping log */}
      <div className="w-full bg-gray-800/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">Ping Log</span>
          <span className="text-xs text-gray-600">
            wire format: <code className="text-cyan-400">msgpack</code> (binary)
          </span>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {pings.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-600 text-sm">
              Clique Ping! para enviar uma mensagem binaria
            </div>
          ) : (
            pings.map((p) => (
              <div
                key={p.seq}
                className="px-4 py-2 border-b border-white/5 flex items-center justify-between text-sm"
              >
                <span className="text-gray-500 font-mono">#{p.seq}</span>
                <span className={`font-mono font-bold ${p.rtt != null ? rttColor(p.rtt) : 'text-gray-600'}`}>
                  {p.rtt != null ? `${p.rtt}ms` : 'pending...'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info */}
      <div className="text-center text-xs text-gray-600 space-y-1">
        <p>Powered by <code className="text-purple-400">LiveRoom</code> + <code className="text-cyan-400">msgpack codec</code></p>
        <p>Wire format: binary frames <code className="text-cyan-400">0x02</code> (event) / <code className="text-cyan-400">0x03</code> (state)</p>
      </div>
    </div>
  )
}
