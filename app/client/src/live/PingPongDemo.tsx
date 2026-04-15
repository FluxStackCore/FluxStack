import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Live } from '@/core/client'
import { LivePingPong } from '@server/live/LivePingPong'
import type { PingRoom } from '@server/live/rooms/PingRoom'
import { FaGaugeHigh, FaPlay, FaSignal, FaStopwatch } from 'react-icons/fa6'

interface PingEntry {
  seq: number
  sentAt: number
  rtt: number | null
}

function StatCard({ label, value, tone = 'white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-gray-600">{label}</div>
    </div>
  )
}

export function PingPongDemo() {
  const username = useMemo(() => {
    const prefix = ['Edge', 'Core', 'Node', 'Wire', 'Frame'][Math.floor(Math.random() * 5)]
    const suffix = Math.floor(Math.random() * 100)
    return `${prefix}-${suffix}`
  }, [])

  const live = Live.use(LivePingPong, {
    initialState: { ...LivePingPong.defaultState, username },
  })

  const [pings, setPings] = useState<PingEntry[]>([])
  const [avgRtt, setAvgRtt] = useState<number | null>(null)
  const [minRtt, setMinRtt] = useState<number | null>(null)
  const [maxRtt, setMaxRtt] = useState<number | null>(null)
  const [autoPing, setAutoPing] = useState(false)
  const seqRef = useRef(0)
  const pendingRef = useRef<Map<number, number>>(new Map())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsub = live.$room<PingRoom>('ping:global').on('pong', (data) => {
      const sentAt = pendingRef.current.get(data.seq)
      if (sentAt == null) return
      pendingRef.current.delete(data.seq)

      const rtt = Date.now() - sentAt
      setPings(prev => {
        const updated = [{ seq: data.seq, sentAt, rtt }, ...prev].slice(0, 18)
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
  }, [live])

  const sendPing = useCallback(() => {
    const seq = ++seqRef.current
    pendingRef.current.set(seq, Date.now())
    live.ping({ seq })
  }, [live])

  useEffect(() => {
    if (autoPing && live.$connected) {
      intervalRef.current = setInterval(sendPing, 500)
    }
    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoPing, live.$connected, sendPing])

  const rttColor = (rtt: number) => {
    if (rtt < 10) return 'text-emerald-300'
    if (rtt < 50) return 'text-amber-300'
    return 'text-red-300'
  }

  return (
    <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[380px_1fr]">
      <section className="rounded-lg border border-white/10 bg-[#07070b]/85 p-5 shadow-2xl shadow-black/20">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Latency probe</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Send binary msgpack events and measure round-trip time through the Live room.
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            live.$connected
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
              : 'border-red-400/25 bg-red-400/10 text-red-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live.$connected ? 'bg-emerald-300' : 'bg-red-300'}`} />
            {live.$connected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <div className="grid gap-3">
          <StatCard label="Average" value={avgRtt != null ? `${avgRtt}ms` : '--'} />
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Min" value={minRtt != null ? `${minRtt}ms` : '--'} tone="text-emerald-300" />
            <StatCard label="Max" value={maxRtt != null ? `${maxRtt}ms` : '--'} tone="text-red-300" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={sendPing}
            disabled={!live.$connected || live.$loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
          >
            <FaPlay className="h-3.5 w-3.5" />
            Ping
          </button>
          <button
            onClick={() => setAutoPing(!autoPing)}
            disabled={!live.$connected}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:opacity-50 ${
              autoPing
                ? 'border-amber-400/25 bg-amber-400/10 text-amber-200'
                : 'border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]'
            }`}
          >
            <FaStopwatch className="h-3.5 w-3.5" />
            {autoPing ? 'Auto on' : 'Auto off'}
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] p-4 text-sm text-gray-400">
          <div className="mb-2 flex items-center gap-2 text-white">
            <FaSignal className="text-theme" />
            Session
          </div>
          <div className="grid gap-2 text-xs">
            <div className="flex justify-between"><span>Client</span><span className="font-mono text-gray-200">{username}</span></div>
            <div className="flex justify-between"><span>Online</span><span className="font-mono text-gray-200">{live.$state.onlineCount}</span></div>
            <div className="flex justify-between"><span>Total pings</span><span className="font-mono text-gray-200">{live.$state.totalPings}</span></div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-black/30">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <FaGaugeHigh className="text-theme" />
            Event log
          </div>
          <span className="text-xs text-gray-500">wire: msgpack binary frames</span>
        </div>

        <div className="max-h-[560px] overflow-auto">
          {pings.length === 0 ? (
            <div className="px-4 py-14 text-center text-sm text-gray-600">
              Send a ping to populate the event log.
            </div>
          ) : (
            pings.map((p) => (
              <div key={p.seq} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm">
                <span className="font-mono text-gray-500">#{p.seq}</span>
                <span className="text-gray-500">{new Date(p.sentAt).toLocaleTimeString()}</span>
                <span className={`font-mono font-semibold ${p.rtt != null ? rttColor(p.rtt) : 'text-gray-600'}`}>
                  {p.rtt != null ? `${p.rtt}ms` : 'pending'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
