import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { FaBook, FaGithub, FaBars, FaTimes } from 'react-icons/fa'

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
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-900/60 border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div className="text-white font-semibold tracking-wide">
            FluxStack
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
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
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
            >
              <FaBook />
              Docs
            </a>
            <a
              href="https://github.com/MarcosBrendonDePaula/FluxStack"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
            >
              <FaGithub />
              GitHub
            </a>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-slate-900/90 backdrop-blur-md">
            <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
                <a
                  href="/swagger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
                >
                  <FaBook />
                  Docs
                </a>
                <a
                  href="https://github.com/MarcosBrendonDePaula/FluxStack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
                >
                  <FaGithub />
                  GitHub
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      <Outlet />
    </div>
  )
}
