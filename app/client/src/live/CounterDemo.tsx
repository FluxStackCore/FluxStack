// 🔥 CounterDemo - Demonstração do Room Events
// Contador compartilhado entre todos os clientes

import { Live } from '@/core/client'
import { LiveCounter, defaultState } from '@server/live/LiveCounter'

export function CounterDemo() {
  const counter = Live.use(LiveCounter, {
    room: 'global-counter',
    initialState: defaultState
  })

  const handleIncrement = async () => {
    await counter.increment()
  }

  const handleDecrement = async () => {
    await counter.decrement()
  }

  const handleReset = async () => {
    await counter.reset()
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        Contador Compartilhado
      </h2>

      <p className="text-gray-400 text-sm text-center mb-6">
        Abra em várias abas - todos veem o mesmo valor!
      </p>

      {/* Status de conexão */}
      <div className="flex justify-center gap-4 mb-6">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
          counter.$connected
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-red-500/20 text-red-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            counter.$connected ? 'bg-emerald-400' : 'bg-red-400'
          }`} />
          {counter.$connected ? 'Conectado' : 'Desconectado'}
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">
          <span>👥</span>
          {counter.$state.connectedUsers} usuário(s)
        </div>
      </div>

      {/* Contador */}
      <div className="text-center mb-8">
        <div className="text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {counter.$state.count}
        </div>

        {counter.$state.lastUpdatedBy && (
          <p className="text-gray-500 text-sm mt-2">
            Última atualização: {counter.$state.lastUpdatedBy}
          </p>
        )}
      </div>

      {/* Botões */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={handleDecrement}
          disabled={counter.$loading}
          className="w-14 h-14 flex items-center justify-center text-3xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl transition-all disabled:opacity-50"
        >
          −
        </button>

        <button
          onClick={handleReset}
          disabled={counter.$loading}
          className="px-6 h-14 flex items-center justify-center text-sm bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 text-gray-300 rounded-xl transition-all disabled:opacity-50"
        >
          Reset
        </button>

        <button
          onClick={handleIncrement}
          disabled={counter.$loading}
          className="w-14 h-14 flex items-center justify-center text-3xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl transition-all disabled:opacity-50"
        >
          +
        </button>
      </div>

      {/* Loading indicator */}
      {counter.$loading && (
        <div className="flex justify-center mt-4">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Info */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <p className="text-gray-500 text-xs text-center">
          ✨ Usando <code className="text-purple-400">Room Events</code> -
          sincronização server-side sem broadcast manual
        </p>
      </div>
    </div>
  )
}
