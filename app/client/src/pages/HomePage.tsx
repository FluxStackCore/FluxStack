import { Link } from 'react-router'
import { FaFire } from 'react-icons/fa'

export function HomePage({ apiStatus }: { apiStatus: 'checking' | 'online' | 'offline' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-72px)] px-6 text-center">
      <div className="mb-8 animate-pulse-slow">
        <FaFire className="text-8xl text-orange-500 drop-shadow-2xl" />
      </div>

      <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        FluxStack
      </h1>

      <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl">
        Full-stack TypeScript framework with{' '}
        <span className="text-purple-400 font-semibold">Bun</span>,{' '}
        <span className="text-blue-400 font-semibold">Elysia</span>, and{' '}
        <span className="text-cyan-400 font-semibold">React</span>
      </p>

      <div className="mb-12">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          apiStatus === 'online'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : apiStatus === 'offline'
            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            apiStatus === 'online' ? 'bg-emerald-400' : apiStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
          }`}></div>
          <span>{apiStatus === 'checking' ? 'Checking API...' : apiStatus === 'online' ? 'API Online' : 'API Offline'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="text-lg font-semibold text-white mb-2">Ultra Rápido</h3>
          <p className="text-gray-400 text-sm">Bun runtime 3x mais rápido que Node.js</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
          <div className="text-3xl mb-3">🔒</div>
          <h3 className="text-lg font-semibold text-white mb-2">Type Safe</h3>
          <p className="text-gray-400 text-sm">Eden Treaty com inferência automática</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
          <div className="text-3xl mb-3">🔥</div>
          <h3 className="text-lg font-semibold text-white mb-2">Live Components</h3>
          <p className="text-gray-400 text-sm">Estado reativo no servidor estilo Livewire</p>
        </div>
      </div>

      <div className="mt-4 text-gray-500 text-sm">
        Use a navegação no topo para acessar as demos.
      </div>

      <div className="mt-16 text-gray-500 text-sm">
        <p>Desenvolvido com ❤️ usando TypeScript</p>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  )
}
