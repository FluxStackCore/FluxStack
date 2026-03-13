// SharedCounterDemo - Contador compartilhado entre todas as abas
//
// Abra em varias abas - todos veem o mesmo valor!
// Usa o sistema de LiveRoom tipado com CounterRoom.
// Demo de client-side room events via $room().on()

import { useMemo, useState, useEffect, useRef } from 'react'
import { Live } from '@/core/client'
import { LiveSharedCounter } from '@server/live/LiveSharedCounter'
import type { CounterRoom } from '@server/live/rooms/CounterRoom'

interface FloatingEvent {
  id: number
  text: string
  color: string
}

export function SharedCounterDemo() {
  const username = useMemo(() => {
    const adj = ['Happy', 'Cool', 'Fast', 'Smart', 'Brave'][Math.floor(Math.random() * 5)]
    const noun = ['Panda', 'Tiger', 'Eagle', 'Wolf', 'Bear'][Math.floor(Math.random() * 5)]
    return `${adj}${noun}${Math.floor(Math.random() * 100)}`
  }, [])

  const counter = Live.use(LiveSharedCounter, {
    initialState: { ...LiveSharedCounter.defaultState, username }
  })

  // Client-side room events — floating animation
  const [floats, setFloats] = useState<FloatingEvent[]>([])
  const floatIdRef = useRef(0)

  useEffect(() => {
    const unsub = counter.$room<CounterRoom>('counter:global').on('counter:updated', (data) => {
      const id = ++floatIdRef.current
      const isReset = data.count === 0
      const text = isReset ? '0' : data.count > 0 ? `+${data.count}` : `${data.count}`
      const color = isReset ? 'text-yellow-400' : data.count > 0 ? 'text-emerald-400' : 'text-red-400'

      setFloats(prev => [...prev, { id, text: `${text} (${data.updatedBy})`, color }])
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 2000)
    })
    return unsub
  }, [])

  const count = counter.$state.count
  const onlineCount = counter.$state.onlineCount
  const lastUpdatedBy = counter.$state.lastUpdatedBy

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Contador Compartilhado</h2>
        <p className="text-sm text-gray-400">Abra em varias abas - todos veem o mesmo valor!</p>
      </div>

      {/* Connection + Online */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${counter.$connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-sm text-gray-400">{counter.$connected ? 'Conectado' : 'Desconectado'}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <span className="text-sm text-gray-400">{onlineCount} online</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
          <span className="text-xs text-purple-300">{username}</span>
        </div>
      </div>

      {/* Counter Display */}
      <div className="relative">
        <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="relative bg-gray-800/50 border border-white/10 rounded-3xl px-16 py-10 flex flex-col items-center">
          <span className={`text-7xl font-black tabular-nums transition-colors ${
            count > 0 ? 'text-emerald-400' : count < 0 ? 'text-red-400' : 'text-white'
          }`}>
            {count}
          </span>
          {lastUpdatedBy && (
            <span className="text-xs text-gray-500 mt-3">
              Ultimo: {lastUpdatedBy}
            </span>
          )}
        </div>

        {/* Floating room events */}
        {floats.map(f => (
          <span
            key={f.id}
            className={`absolute left-1/2 -translate-x-1/2 top-0 ${f.color} text-sm font-bold pointer-events-none animate-float-up`}
          >
            {f.text}
          </span>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => counter.decrement()}
          disabled={counter.$loading}
          className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-300 text-2xl font-bold hover:bg-red-500/30 active:scale-95 disabled:opacity-50 transition-all"
        >
          -
        </button>
        <button
          onClick={() => counter.reset()}
          disabled={counter.$loading}
          className="px-6 h-14 rounded-2xl bg-white/10 border border-white/20 text-gray-300 text-sm font-medium hover:bg-white/20 active:scale-95 disabled:opacity-50 transition-all"
        >
          Reset
        </button>
        <button
          onClick={() => counter.increment()}
          disabled={counter.$loading}
          className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-2xl font-bold hover:bg-emerald-500/30 active:scale-95 disabled:opacity-50 transition-all"
        >
          +
        </button>
      </div>

      {/* Info */}
      <div className="text-center text-xs text-gray-600 space-y-1">
        <p>Powered by <code className="text-purple-400">LiveRoom</code> + <code className="text-purple-400">CounterRoom</code></p>
        <p>Estado via component state + eventos via <code className="text-cyan-400">$room().on()</code></p>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
        }
        .animate-float-up {
          animation: float-up 2s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
