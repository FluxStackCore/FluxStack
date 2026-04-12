"use client"

// 🔥 FormDemo - Exemplo de Live Component
import { Live } from '@/core/client'
import { LiveForm } from '@server/live/LiveForm'

export function FormDemo() {
  // ✨ Usa defaultState do backend automaticamente
  const form = Live.use(LiveForm)

  // Sucesso
  if (form.submitted) {
    return (
      <div className="p-4 sm:p-6 bg-green-500/20 border border-green-500/30 rounded-xl text-center w-full max-w-xl mx-auto">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-white mb-2">Enviado!</h2>
        <p className="text-gray-300">Obrigado, <span className="text-green-400">{form.name}</span>!</p>
        <p className="text-gray-400 text-sm mt-2">
          Enviado em: {form.submittedAt ? new Date(form.submittedAt).toLocaleString() : '-'}
        </p>
        <button
          onClick={() => form.reset()}
          className="mt-4 btn-theme"
        >
          Novo Formulário
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Live Form</h2>
        <span className={`px-3 py-1 rounded-full text-xs ${
          form.$connected ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
        }`}>
          {form.$connected ? '🟢 Conectado' : '🔴 Desconectado'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Nome - sync on blur */}
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Nome <span className="text-theme text-xs">(sync: blur)</span>
          </label>
          <input
            {...form.$field('name', { syncOn: 'blur' })}
            placeholder="Seu nome"
            className="w-full input-theme"
          />
        </div>

        {/* Email - sync on change with debounce */}
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Email <span className="text-blue-400 text-xs">(sync: 500ms)</span>
          </label>
          <input
            {...form.$field('email', { syncOn: 'change', debounce: 500 })}
            type="email"
            placeholder="seu@email.com"
            className="w-full input-theme"
          />
        </div>

        {/* Mensagem - sync on blur */}
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Mensagem <span className="text-orange-400 text-xs">(sync: blur)</span>
          </label>
          <textarea
            {...form.$field('message', { syncOn: 'blur' })}
            rows={3}
            placeholder="Sua mensagem..."
            className="w-full input-theme resize-none"
          />
        </div>

        {/* Botões */}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await form.$sync()
                await form.submit()
              } catch (err: any) {
                alert(err.message || 'Erro ao enviar')
              }
            }}
            disabled={!form.$connected || form.$loading}
            className="flex-1 px-4 py-3 bg-theme-gradient text-white rounded-lg font-medium hover:shadow-theme transition-all disabled:opacity-50"
          >
            {form.$loading ? 'Enviando...' : 'Enviar'}
          </button>
          <button
            onClick={() => form.reset()}
            className="px-4 py-3 btn-theme-ghost"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-4 p-3 bg-white/5 rounded-lg text-xs text-gray-400 space-y-1">
        <p><span className="text-theme">blur:</span> Sincroniza ao sair do campo</p>
        <p><span className="text-blue-400">500ms:</span> Sincroniza 500ms após parar de digitar</p>
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