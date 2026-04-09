/**
 * SSR Layout — Server-side rendered shell
 *
 * Renders the app layout (header, nav, footer) on the server.
 * Client-side components mount inside the {children} slot via React hydration.
 *
 * No hooks, no browser APIs — pure React elements.
 */
import { createElement, type ReactNode } from 'react'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/counter', label: 'Counter' },
  { to: '/form', label: 'Form' },
  { to: '/shared-counter', label: 'Shared Counter' },
  { to: '/room-chat', label: 'Room Chat' },
  { to: '/auth', label: 'Auth' },
  { to: '/api-test', label: 'API Test' },
]

export function SSRLayout({ children, activeRoute = '/' }: { children?: ReactNode; activeRoute?: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a1a]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
                F
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                FluxStack
              </span>
            </a>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <a
                  key={item.to}
                  href={item.to}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    activeRoute === item.to
                      ? 'bg-purple-500/20 text-purple-300 font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* External links */}
            <div className="flex items-center gap-2">
              <a
                href="/swagger"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] transition-all"
                title="API Docs"
              >
                📖
              </a>
              <a
                href="https://github.com/FluxStackCore/FluxStack"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] transition-all"
                title="GitHub"
              >
                ⭐
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
        {/* SPA outlet — React client mounts interactive content here */}
        <div id="spa-outlet" />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500 text-sm">
            Built with <span className="text-purple-400">FluxStack</span> — Bun + Elysia + React
          </p>
          <p className="text-gray-600 text-xs mt-1">
            Open Source • TypeScript • Real-time
          </p>
        </div>
      </footer>
    </div>
  )
}
