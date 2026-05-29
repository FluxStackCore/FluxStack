'use client'
import { useMemo } from 'react'
import { Live } from '@/core/client'
import { LiveCounter } from '@server/live/LiveCounter'
import { LiveLocalCounter } from '@server/live/LiveLocalCounter'
import { FaMinus, FaPlus, FaRotateRight, FaUsers } from 'react-icons/fa6'

type CounterProxy = ReturnType<typeof Live.use>

function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
      connected
        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
        : 'border-red-400/25 bg-red-400/10 text-red-200'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-300' : 'bg-red-300'}`} />
      {connected ? 'Connected' : 'Offline'}
    </span>
  )
}

function CounterCard({
  title,
  description,
  mode,
  counter,
  accent = 'theme',
}: {
  title: string
  description: string
  mode: string
  counter: CounterProxy
  accent?: 'theme' | 'warm'
}) {
  const valueClass = accent === 'warm'
    ? 'bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300'
    : 'bg-theme-gradient'

  return (
    <article className="flex min-h-[430px] w-full flex-col rounded-lg border border-white/10 bg-[#07070b]/85 p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-gray-400">
            {mode}
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
        </div>
        {'$connected' in counter && <ConnectionPill connected={counter.$connected} />}
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <div className={`bg-clip-text text-7xl font-semibold tabular-nums tracking-tight text-transparent sm:text-8xl ${valueClass}`}>
          {counter.$state.count}
        </div>
      </div>

      {'connectedUsers' in counter.$state && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-2">
            <FaUsers className="text-theme" />
            Users in room
          </span>
          <span className="font-mono text-white">{counter.$state.connectedUsers}</span>
        </div>
      )}

      {counter.$state.lastUpdatedBy && (
        <p className="mb-5 truncate text-xs text-gray-500">
          Last update: <span className="text-gray-300">{counter.$state.lastUpdatedBy}</span>
        </p>
      )}

      <div className="grid grid-cols-[56px_1fr_56px] gap-3">
        <button
          onClick={() => counter.decrement()}
          disabled={counter.$loading}
          className="flex h-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-200 transition hover:bg-white/[0.07] disabled:opacity-50"
          aria-label={`Decrease ${title}`}
        >
          <FaMinus />
        </button>
        <button
          onClick={() => counter.reset()}
          disabled={counter.$loading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-theme-active bg-theme-muted px-4 text-sm font-semibold text-theme transition hover:shadow-theme disabled:opacity-50"
        >
          <FaRotateRight className="h-3.5 w-3.5" />
          Reset
        </button>
        <button
          onClick={() => counter.increment()}
          disabled={counter.$loading}
          className="flex h-12 items-center justify-center rounded-lg bg-white text-black transition hover:bg-gray-200 disabled:opacity-50"
          aria-label={`Increase ${title}`}
        >
          <FaPlus />
        </button>
      </div>
    </article>
  )
}

export function CounterDemo() {
  const isolatedRoom = useMemo(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `local-${crypto.randomUUID()}`
    }
    return `local-${Math.random().toString(36).slice(2)}`
  }, [])

  const localCounter = Live.use(LiveLocalCounter, {
    initialState: LiveLocalCounter.defaultState,
    persistState: false,
  })

  const isolatedCounter = Live.use(LiveCounter, {
    room: isolatedRoom,
    initialState: LiveCounter.defaultState,
    persistState: false,
  })

  const sharedCounter = Live.use(LiveCounter, {
    room: 'global-counter',
    initialState: LiveCounter.defaultState,
  })

  return (
    <div className="grid w-full gap-4 lg:grid-cols-3">
      <CounterCard
        title="Local state"
        description="A component-local counter for quick state updates without a shared room."
        mode="No room"
        counter={localCounter}
        accent="warm"
      />
      <CounterCard
        title="Isolated room"
        description="A private room per tab. The server owns the state, but the session is isolated."
        mode="Private room"
        counter={isolatedCounter}
      />
      <CounterCard
        title="Shared room"
        description="One global room. Open another tab and every client sees the same counter."
        mode="Global room"
        counter={sharedCounter}
      />
    </div>
  )
}
