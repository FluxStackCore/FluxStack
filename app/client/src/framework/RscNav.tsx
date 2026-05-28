// Navbar SERVER COMPONENT (estrutura 0 JS). Os links são RscLink (pequena ilha
// client) que navegam SEM reload — buscam o .rsc e trocam só o conteúdo, mantendo
// o shell e a conexão WebSocket vivos. "O que pode ser server, é server."
import FluxStackLogo from '@client/src/assets/fluxstack.svg'
import { RscLink } from './RscLink'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/counter', label: 'Counters' },
  { to: '/form', label: 'Form' },
  { to: '/shared-counter', label: 'Shared' },
  { to: '/room-chat', label: 'Chat' },
  { to: '/auth', label: 'Auth' },
  { to: '/ping-pong', label: 'Ping-Pong' },
]

export function RscNav({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <RscLink href="/" className="flex items-center gap-2">
          <img src={FluxStackLogo} alt="FluxStack" className="h-6 w-6" />
          <span className="font-semibold text-white">FluxStack</span>
        </RscLink>
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((item) => {
            const isActive = item.to === active
            return (
              <RscLink
                key={item.to}
                href={item.to}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {item.label}
              </RscLink>
            )
          })}
        </nav>
        <RscLink href="/swagger" external className="ml-auto text-sm text-gray-400 hover:text-white">
          API docs
        </RscLink>
      </div>
    </header>
  )
}
