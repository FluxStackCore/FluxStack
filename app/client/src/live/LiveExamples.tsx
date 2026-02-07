// 🔥 Live Components - Exemplo de uso com Live.use()
import { Live } from '@/core/client'
import { LiveForm } from '@server/live/LiveForm'

export function FormExample() {
  const form = Live.use(LiveForm, {
    name: '',
    email: '',
    message: '',
    submitted: false,
    submittedAt: null
  })

  // Sucesso
  if (form.submitted) {
    return (
      <div className="p-6 bg-green-500/20 rounded-xl text-center">
        <h2 className="text-xl font-bold text-white mb-2">Enviado!</h2>
        <p className="text-white/70">Enviado em: {form.submittedAt}</p>
        <button
          onClick={() => form.reset()}
          className="mt-4 px-4 py-2 bg-purple-500 text-white rounded"
        >
          Novo Formulário
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white/10 rounded-xl">
      <h2 className="text-xl font-bold text-white mb-4">Live Form</h2>

      {/* Status */}
      <div className="mb-4 text-sm">
        {form.$connected ? '🟢 Conectado' : '🔴 Desconectado'}
      </div>

      {/* Campos */}
      <input
        {...form.$field('name', { syncOn: 'blur' })}
        placeholder="Nome"
        className="w-full mb-3 px-4 py-2 bg-black/20 rounded text-white"
      />
      <input
        {...form.$field('email', { syncOn: 'change', debounce: 500 })}
        placeholder="Email"
        className="w-full mb-3 px-4 py-2 bg-black/20 rounded text-white"
      />
      <textarea
        {...form.$field('message', { syncOn: 'blur' })}
        placeholder="Mensagem"
        className="w-full mb-3 px-4 py-2 bg-black/20 rounded text-white"
      />

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
          disabled={!form.$connected}
          className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
        >
          Enviar
        </button>
        <button
          onClick={() => form.reset()}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Limpar
        </button>
      </div>

      {/* Debug */}
      <div className="mt-4 p-2 bg-black/30 rounded text-xs text-white/50">
        <pre>{JSON.stringify(form.$state, null, 2)}</pre>
      </div>
    </div>
  )
}

// ===== Página de Exemplos =====

export function LiveComponentExamples() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">
        Live Components
      </h1>

      <div className="max-w-2xl mx-auto space-y-8">
        {/* Documentação */}
        <div className="p-6 bg-black/30 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-4">Como Usar</h2>
          <pre className="p-3 bg-black/40 rounded text-sm overflow-x-auto text-white/80">
{`import { Live } from '@/core/client'
import { LiveForm } from '@server/live/LiveForm'

const form = Live.use(LiveForm, { name: '', email: '' })

// Campos com sync automático
<input {...form.$field('name', { syncOn: 'blur' })} />
<input {...form.$field('email', { syncOn: 'change', debounce: 500 })} />

// Actions
await form.submit()
await form.reset()`}
          </pre>
        </div>

        {/* Exemplo */}
        <FormExample />
      </div>
    </div>
  )
}
