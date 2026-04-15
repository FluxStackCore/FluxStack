import { Live } from '@/core/client'
import { LiveForm } from '@server/live/LiveForm'
import { FaCheck, FaCode, FaEnvelope, FaRegMessage, FaUser } from 'react-icons/fa6'

function FieldHint({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-gray-500">
      {children}
    </span>
  )
}

export function FormDemo() {
  const form = Live.use(LiveForm)

  if (form.submitted) {
    return (
      <div className="w-full max-w-2xl rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-6 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-400 text-black">
          <FaCheck />
        </div>
        <h2 className="text-2xl font-semibold text-white">Message received</h2>
        <p className="mt-2 text-sm leading-6 text-gray-300">
          Thanks, <span className="text-emerald-200">{form.name || 'there'}</span>. The server state was updated and submitted.
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Submitted at {form.submittedAt ? new Date(form.submittedAt).toLocaleString() : '-'}
        </p>
        <button onClick={() => form.reset()} className="mt-6 h-11 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-gray-200">
          Start another form
        </button>
      </div>
    )
  }

  return (
    <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-white/10 bg-[#07070b]/85 p-5 shadow-2xl shadow-black/20 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Contact workflow</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Fields sync with the server using different strategies so the UI stays responsive.
            </p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            form.$connected
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
              : 'border-red-400/25 bg-red-400/10 text-red-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${form.$connected ? 'bg-emerald-300' : 'bg-red-300'}`} />
            {form.$connected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <div className="space-y-4">
          <label className="block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-200">
                <FaUser className="text-theme" />
                Name
              </span>
              <FieldHint>sync on blur</FieldHint>
            </div>
            <input
              {...form.$field('name', { syncOn: 'blur' })}
              placeholder="Ada Lovelace"
              className="w-full input-theme"
            />
          </label>

          <label className="block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-200">
                <FaEnvelope className="text-theme-secondary" />
                Email
              </span>
              <FieldHint>debounce 500ms</FieldHint>
            </div>
            <input
              {...form.$field('email', { syncOn: 'change', debounce: 500 })}
              type="email"
              placeholder="ada@company.dev"
              className="w-full input-theme"
            />
          </label>

          <label className="block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-200">
                <FaRegMessage className="text-theme" />
                Message
              </span>
              <FieldHint>sync on blur</FieldHint>
            </div>
            <textarea
              {...form.$field('message', { syncOn: 'blur' })}
              rows={5}
              placeholder="Tell us what you want to build..."
              className="w-full resize-none input-theme"
            />
          </label>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              onClick={async () => {
                try {
                  await form.$sync()
                  await form.submit()
                } catch (err: any) {
                  alert(err.message || 'Submit failed')
                }
              }}
              disabled={!form.$connected || form.$loading}
              className="h-11 flex-1 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
            >
              {form.$loading ? 'Sending...' : 'Submit'}
            </button>
            <button
              onClick={() => form.reset()}
              className="h-11 rounded-lg border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <aside className="rounded-lg border border-white/10 bg-black/30 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <FaCode className="text-theme" />
          Server state
        </div>
        <pre className="max-h-[460px] overflow-auto rounded-lg border border-white/10 bg-black/50 p-4 text-xs leading-6 text-emerald-300">
          <code>{JSON.stringify(form.$state, null, 2)}</code>
        </pre>
      </aside>
    </div>
  )
}
