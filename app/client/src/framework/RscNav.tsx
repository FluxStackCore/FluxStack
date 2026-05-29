// Navbar SERVER COMPONENT — gerada automaticamente a partir das rotas descobertas
// (file-based). Adicionar uma página em pages/ a faz aparecer aqui sozinha
// (a menos que a página exporte `nav = false`). Links via RscLink (SPA sem reload).
import FluxStackLogo from '@client/src/assets/fluxstack.svg'
import { RscLink } from './RscLink'
import { routes } from './routes'

export function RscNav({ active }: { active: string }) {
  const navItems = routes.filter((r) => r.inNav)

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <RscLink href="/" className="flex items-center gap-2">
          <img src={FluxStackLogo} alt="FluxStack" className="h-6 w-6" />
          <span className="font-semibold text-white">FluxStack</span>
        </RscLink>
        <nav className="flex flex-wrap items-center gap-1">
          {navItems.map((item) => {
            const isActive = item.path === active
            return (
              <RscLink
                key={item.path}
                href={item.path}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {item.navLabel}
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
