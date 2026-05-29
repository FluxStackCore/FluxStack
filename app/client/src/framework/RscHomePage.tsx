// HomePage como SERVER COMPONENT (RSC) — a página bonita original, portada.
// Sem estado/interatividade → roda 100% no server, 0 JS no client.
// Diferenças vs HomePage.tsx original:
//  - <Link> (react-router) → <a> (navegação RSC usa anchor + fetch do payload)
//  - apiStatus vem como prop do server (sem fetch client no shell)
import FluxStack from '@client/src/assets/fluxstack.svg'
import {
  FaArrowRight,
  FaBolt,
  FaCodeBranch,
  FaLayerGroup,
  FaServer,
  FaShieldAlt,
  FaTerminal,
} from 'react-icons/fa'

export function RscHomePage() {
  const features = [
    { icon: FaBolt, title: 'Runtime rapido', copy: 'Bun no centro do fluxo de dev e build, com feedback curto para projetos full stack.' },
    { icon: FaShieldAlt, title: 'Type-safe', copy: 'Contratos compartilhados entre Elysia, Eden Treaty e React sem duplicar modelos.' },
    { icon: FaLayerGroup, title: 'Live Components', copy: 'Estado no servidor com UI reativa, salas em tempo real e componentes declarativos.' },
  ]
  const stackItems = ['Bun', 'Elysia', 'React', 'TypeScript']

  return (
    <div className="relative min-h-[calc(100vh-72px)] overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 app-grid-bg opacity-70" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-10 lg:min-h-[calc(100vh-144px)] lg:justify-center">
        <section className="grid items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 px-2 py-0.5">Server Rendered (RSC)</span>
              <span className="hidden sm:inline">Full-stack starter for production apps</span>
            </div>

            <div className="mb-5 flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30">
                <img src={FluxStack} alt="FluxStack" className="h-11 w-11 glow-theme" />
              </div>
              <div className="hidden h-px flex-1 bg-gradient-to-r from-white/20 to-transparent sm:block" />
            </div>

            <h1 className="max-w-4xl text-left text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              FluxStack
              <span className="block bg-theme-gradient bg-clip-text text-transparent">TypeScript full stack.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-left text-base leading-8 text-gray-400 sm:text-lg">
              Um framework direto ao ponto para construir APIs Elysia, interfaces React,
              componentes em tempo real e contratos type-safe em uma unica base.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/counter" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-gray-200">
                Ver demos
                <FaArrowRight className="h-3.5 w-3.5" />
              </a>
              <a href="/swagger" target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.06]">
                <FaServer className="h-3.5 w-3.5 text-theme" />
                API docs
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {stackItems.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-gray-300">{item}</span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-lg border border-white/10 bg-[#050508]/80 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
                </div>
                <span className="font-mono text-xs text-gray-500">fluxstack.config.ts</span>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <FaTerminal className="text-theme" />
                    Ship from one command
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-black/50 p-4 text-left text-xs leading-6 text-gray-300">
                    <code>{`bunx create-fluxstack my-app\ncd my-app\nbun dev`}</code>
                  </pre>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <FaCodeBranch className="mb-4 text-theme-secondary" />
                    <p className="text-sm font-semibold text-white">Typed routes</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">Client e server compartilham o contrato.</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <FaLayerGroup className="mb-4 text-theme" />
                    <p className="text-sm font-semibold text-white">Live UI</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">WebSocket, rooms e estado remoto.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="group rounded-lg border border-white/10 bg-white/[0.025] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.045]">
              <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-theme transition group-hover:border-theme-active">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">{copy}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
