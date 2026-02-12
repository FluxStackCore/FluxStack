import { Link, Outlet, useLocation } from 'react-router'
import { FaBook, FaGithub } from 'react-icons/fa'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/counter', label: 'Counter' },
  { to: '/form', label: 'Form' },
  { to: '/upload', label: 'Upload' },
  { to: '/chat', label: 'Chat' },
  { to: '/room-chat', label: 'Room Chat' },
  { to: '/auth', label: 'Auth' },
  { to: '/api-test', label: 'API Test' }
]

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-900/60 border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-white font-semibold tracking-wide">
            FluxStack
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="/swagger"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
            >
              <FaBook />
              Docs
            </a>
            <a
              href="https://github.com/MarcosBrendonDePaula/FluxStack"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
            >
              <FaGithub />
              GitHub
            </a>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  )
}
