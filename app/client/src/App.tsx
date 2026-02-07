import { useState, useEffect } from 'react'
import { api } from './lib/eden-api'
import { FaFire, FaBook, FaGithub, FaClock, FaImage, FaCode } from 'react-icons/fa'
import { LiveComponentsProvider, Live } from '@/core/client'
import { LiveForm } from '@server/live/LiveForm'
import { FileUploadExample } from './live/FileUploadExample'
import { MinimalLiveClock } from './live/MinimalLiveClock'
import { LiveComponentExamples } from './live/LiveExamples'

// ===== Live Form Demo =====

function LiveFormDemo() {
  // ✨ Sem initialState! Usa defaultState do backend automaticamente
  const form = Live.use(LiveForm)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Sincroniza campos pendentes antes de enviar
      await form.$sync()
      const result = await form.submit()
      console.log('Submitted:', result)
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (form.submitted) {
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Enviado!</h2>
          <p className="text-gray-300 mb-4">
            Obrigado, <span className="text-purple-400">{form.name}</span>!
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Enviado em: {form.submittedAt ? new Date(form.submittedAt).toLocaleString() : '-'}
          </p>
          <button
            onClick={() => form.reset()}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            Enviar outro
          </button>
        </div>

        {/* Debug - mostra estado após submit */}
        <details className="mt-6 text-left" open>
          <summary className="text-gray-400 text-sm cursor-pointer">Debug State (servidor)</summary>
          <pre className="mt-2 p-3 bg-black/40 rounded-lg text-xs text-green-400 overflow-auto">
{JSON.stringify(form.$state, null, 2)}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-md w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Live Form</h2>
        <span className={`px-3 py-1 rounded-full text-xs ${
          form.$connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
        }`}>
          {form.$connected ? '🟢 Conectado' : '🔴 Desconectado'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome - syncOn: blur (sincroniza ao sair do campo) */}
        <div>
          <label className="block text-gray-300 text-sm mb-2">
            Nome <span className="text-purple-400 text-xs">(sync: blur)</span>
          </label>
          <input
            type="text"
            {...form.$field('name', { syncOn: 'blur' })}
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-all"
            placeholder="Seu nome"
          />
        </div>

        {/* Email - syncOn: change com debounce maior */}
        <div>
          <label className="block text-gray-300 text-sm mb-2">
            Email <span className="text-blue-400 text-xs">(sync: 500ms)</span>
          </label>
          <input
            type="email"
            {...form.$field('email', { syncOn: 'change', debounce: 500 })}
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-all"
            placeholder="seu@email.com"
          />
        </div>

        {/* Mensagem - syncOn: manual (só sincroniza no submit) */}
        <div>
          <label className="block text-gray-300 text-sm mb-2">
            Mensagem <span className="text-orange-400 text-xs">(sync: manual)</span>
          </label>
          <textarea
            {...form.$field('message', { syncOn: 'manual' })}
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-all resize-none"
            placeholder="Sua mensagem..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!form.$connected}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {form.$loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>

      {/* Legenda */}
      <div className="mt-4 p-3 bg-white/5 rounded-lg text-xs text-gray-400 space-y-1">
        <p><span className="text-purple-400">blur:</span> Sincroniza ao sair do campo</p>
        <p><span className="text-blue-400">500ms:</span> Sincroniza 500ms após parar de digitar</p>
        <p><span className="text-orange-400">manual:</span> Sincroniza só no submit</p>
      </div>

      {/* Debug */}
      <details className="mt-4">
        <summary className="text-gray-400 text-sm cursor-pointer">Debug State (servidor)</summary>
        <pre className="mt-2 p-3 bg-black/40 rounded-lg text-xs text-green-400 overflow-auto">
{JSON.stringify(form.$state, null, 2)}
        </pre>
      </details>
    </div>
  )
}


function AppContent() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [showDemo, setShowDemo] = useState(false)
  const [showApiTest, setShowApiTest] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showLiveExamples, setShowLiveExamples] = useState(false)
  const [apiResponse, setApiResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    checkApiStatus()
  }, [])

  const checkApiStatus = async () => {
    try {
      const { error } = await api.health.get()
      setApiStatus(error ? 'offline' : 'online')
    } catch {
      setApiStatus('offline')
    }
  }

  // Test API calls
  const testHealthCheck = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.health.get()
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  const testGetUsers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.users.get()
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  const testCreateUser = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.users.post({
        name: `Test User ${Date.now()}`,
        email: `test${Date.now()}@example.com`
      })
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  // API Test Panel
  if (showApiTest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setShowApiTest(false)}
              className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-all"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Eden Treaty API Test
            </h1>
          </div>

          {/* Test Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={testHealthCheck}
              disabled={isLoading}
              className="px-6 py-4 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-50"
            >
              <div className="text-2xl mb-2">🏥</div>
              <div>GET /api/health</div>
              <div className="text-xs text-emerald-400/70 mt-1">Health Check</div>
            </button>

            <button
              onClick={testGetUsers}
              disabled={isLoading}
              className="px-6 py-4 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-xl font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50"
            >
              <div className="text-2xl mb-2">👥</div>
              <div>GET /api/users</div>
              <div className="text-xs text-blue-400/70 mt-1">List Users</div>
            </button>

            <button
              onClick={testCreateUser}
              disabled={isLoading}
              className="px-6 py-4 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl font-medium hover:bg-purple-500/30 transition-all disabled:opacity-50"
            >
              <div className="text-2xl mb-2">➕</div>
              <div>POST /api/users</div>
              <div className="text-xs text-purple-400/70 mt-1">Create User</div>
            </button>
          </div>

          {/* Response Panel */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Response</h2>
              {isLoading && (
                <div className="flex items-center gap-2 text-yellow-400">
                  <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </div>
              )}
            </div>
            <pre className="bg-black/60 rounded-xl p-4 overflow-auto max-h-96 text-sm font-mono">
              <code className="text-green-400">
                {apiResponse || '// Click a button above to test the API\n// Type inference works automatically!'}
              </code>
            </pre>
          </div>

          {/* Info */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">How it works</h3>
            <div className="text-gray-400 text-sm space-y-2">
              <p>✅ <code className="text-purple-400">api.health.get()</code> → Full type inference from server</p>
              <p>✅ <code className="text-purple-400">api.users.post({'{ name, email }'})</code> → Request body is typed</p>
              <p>✅ <code className="text-purple-400">{'{ data, error }'}</code> → Response is typed automatically</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Live Component Examples
  if (showLiveExamples) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setShowLiveExamples(false)}
              className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-all"
            >
              ← Voltar
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Live Components - React Style
            </h1>
          </div>
          <LiveComponentExamples />
        </div>
      </div>
    )
  }

  // Live Form Demo
  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center px-4">
        <div className="mb-8">
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-all"
          >
            ← Voltar
          </button>
        </div>
        <LiveFormDemo />
        <p className="mt-6 text-gray-400 text-sm max-w-md text-center">
          ✨ Este formulário usa <code className="text-purple-400">useLiveComponent</code> -
          cada campo sincroniza automaticamente com o servidor!
        </p>
      </div>
    )
  }

  // If demo mode is active, show demo content
  if (showDemo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header with back button */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setShowDemo(false)}
              className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-all"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              FluxStack Demos
            </h1>
          </div>

          {/* Demo Content */}
          <FileUploadExample />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Logo */}
        <div className="mb-8 animate-pulse-slow">
          <FaFire className="text-8xl text-orange-500 drop-shadow-2xl" />
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          FluxStack
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl">
          Full-stack TypeScript framework with{' '}
          <span className="text-purple-400 font-semibold">Bun</span>,{' '}
          <span className="text-blue-400 font-semibold">Elysia</span>, and{' '}
          <span className="text-cyan-400 font-semibold">React</span>
        </p>

        {/* API Status Badge */}
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

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 max-w-6xl">
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
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="text-lg font-semibold text-white mb-2">Moderno</h3>
            <p className="text-gray-400 text-sm">React 19 + Vite + Tailwind CSS</p>
          </div>

          {/* Live Clock Card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <FaClock className="text-2xl text-emerald-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">Live Clock</h3>
                <p className="text-gray-400 text-sm">Provido via LiveComponent</p>
              </div>
            </div>
            <MinimalLiveClock />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            📝 Live Form
          </button>
          <button
            onClick={() => setShowLiveExamples(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
          >
            <FaCode />
            Live.* Sintaxe
          </button>
          <button
            onClick={() => setShowApiTest(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-orange-500/50 transition-all"
          >
            🧪 Test API
          </button>
          <button
            onClick={() => setShowDemo(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/50 transition-all"
          >
            <FaImage />
            View Demos
          </button>
          <a
            href="/swagger"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            <FaBook />
            API Docs
          </a>
          <a
            href="https://github.com/MarcosBrendonDePaula/FluxStack"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
          >
            <FaGithub />
            GitHub
          </a>
          <a
            href="/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
          >
            🚀 API Root
          </a>
        </div>

        {/* Footer */}
        <div className="mt-16 text-gray-500 text-sm">
          <p>Desenvolvido com ❤️ usando TypeScript</p>
        </div>
      </div>

      {/* Animations */}
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

// Main App with LiveComponentsProvider
function App() {
  return (
    <LiveComponentsProvider
      autoConnect={true}
      reconnectInterval={1000}
      maxReconnectAttempts={5}
      heartbeatInterval={30000}
      debug={false}
    >
      <AppContent />
    </LiveComponentsProvider>
  )
}

export default App
