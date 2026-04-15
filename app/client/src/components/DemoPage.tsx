import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { FaArrowLeft, FaBolt } from 'react-icons/fa'

const demoNav = [
  { to: '/counter', label: 'Counter' },
  { to: '/form', label: 'Form' },
  { to: '/upload', label: 'Upload' },
  { to: '/room-chat', label: 'Room Chat' },
  { to: '/auth', label: 'Auth' },
  { to: '/ping-pong', label: 'Ping Pong' },
]

const demoMeta: Record<string, { title: string; description: string; note?: ReactNode }> = {
  '/counter': {
    title: 'Counters',
    description: 'Compare estado local, estado isolado por sala e estado compartilhado em tempo real.',
  },
  '/form': {
    title: 'Live Form',
    description: 'Formulario com campos sincronizados pelo servidor, debounce e estado compartilhado pelo proxy Live.',
    note: <>Este formulario usa <code className="text-theme">Live.use()</code> - cada campo sincroniza automaticamente com o servidor.</>,
  },
  '/upload': {
    title: 'Live Upload',
    description: 'Upload conectado ao runtime Live, com progresso, resposta do servidor e preview do arquivo enviado.',
  },
  '/shared-counter': {
    title: 'Shared Counter',
    description: 'Uma sala global sincroniza usuarios, eventos e estado entre abas abertas ao mesmo tempo.',
    note: <>Contador compartilhado usando <code className="text-theme">LiveRoom</code> - abra em varias abas.</>,
  },
  '/room-chat': {
    title: 'Room Chat',
    description: 'Chat multi-sala com salas publicas, salas protegidas por senha e mensagens em tempo real.',
    note: <>Chat com multiplas salas usando o sistema <code className="text-theme">$room</code>.</>,
  },
  '/auth': {
    title: 'Live Auth',
    description: 'Fluxo de autenticacao para Live Components com roles, permissoes e painel protegido.',
    note: <>Sistema de autenticacao declarativo para Live Components com <code className="text-theme">$auth</code>.</>,
  },
  '/ping-pong': {
    title: 'Ping Pong Binary',
    description: 'Mede round-trip time de mensagens binarias no WebSocket usando codec msgpack.',
    note: <>Latency demo com <code className="text-theme-secondary">msgpack</code> binary codec - mensagens binarias no WebSocket.</>,
  },
}

interface DemoPageProps {
  children: ReactNode
  title?: string
  description?: string
  eyebrow?: string
  note?: ReactNode
}

export function DemoPage({
  children,
  title,
  description,
  eyebrow = 'Live Demo',
  note,
}: DemoPageProps) {
  const location = useLocation()
  const meta = demoMeta[location.pathname]
  const pageTitle = title ?? meta?.title ?? 'Live Component Demo'
  const pageDescription = description ?? meta?.description ?? 'Explore uma capacidade do runtime Live em uma interface conectada ao servidor.'
  const pageNote = meta?.note ?? note

  return (
    <div className="relative min-h-[calc(100vh-128px)] overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 app-grid-bg opacity-45" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <FaArrowLeft className="h-3 w-3" />
            Home
          </Link>

          <section className="rounded-lg border border-white/10 bg-[#07070b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-theme-active bg-theme-muted px-3 py-1 text-xs font-medium text-theme">
                  <FaBolt className="h-3 w-3" />
                  {eyebrow}
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {pageTitle}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
                  {pageDescription}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {demoNav.map(item => {
                  const active = location.pathname === item.to
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        active
                          ? 'border-white bg-white text-black'
                          : 'border-white/10 bg-white/[0.025] text-gray-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-white/10 bg-black/20 p-3 shadow-2xl shadow-black/20 backdrop-blur sm:p-5">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
            {children}
          </div>
        </section>

        {pageNote && (
          <aside className="mx-auto w-full max-w-3xl rounded-lg border border-theme bg-theme-accent px-4 py-3 text-center">
            <p className="text-xs leading-6 text-gray-400 sm:text-sm">
              {pageNote}
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
