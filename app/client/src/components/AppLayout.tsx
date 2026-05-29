'use client'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { FaBars, FaBook, FaChevronDown, FaExternalLinkAlt, FaGithub, FaTimes } from 'react-icons/fa'
import FluxStackLogo from '@client/src/assets/fluxstack.svg'
import faviconSvg from '@client/src/assets/fluxstack-static.svg?raw'
import { useThemeClock } from '../hooks/useThemeClock'
import { ThemePicker } from './ThemePicker'
import type { ColorPalette } from '../lib/theme-clock'
import { themeConfig } from '../config/theme.config'

const navItems = [
  { to: '/', label: 'Home' },
]

const demoItems = [
  { to: '/counter', label: 'Counter' },
  { to: '/form', label: 'Form' },

  { to: '/room-chat', label: 'Room Chat' },
  { to: '/auth', label: 'Auth' },
  { to: '/ping-pong', label: 'Ping Pong' },
]

const allRouteItems = [...navItems, ...demoItems]

const MAX_FAVICON_CACHE = 20
const faviconUrlCache = new Map<string, string>()

function HeaderLink({
  href,
  children,
  subtle = false,
}: {
  href: string
  children: ReactNode
  subtle?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`hidden h-9 items-center gap-2 rounded-lg border px-3 text-sm transition sm:inline-flex ${
        subtle
          ? 'border-white/10 bg-white/[0.025] text-gray-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
          : 'border-theme-active bg-theme-muted text-theme hover:shadow-theme'
      }`}
    >
      {children}
    </a>
  )
}

export function AppLayout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [demosOpen, setDemosOpen] = useState(false)
  const autoTheme = useThemeClock()
  const [overrideTheme, setOverrideTheme] = useState<ColorPalette | null>(null)
  const theme = overrideTheme || autoTheme

  useEffect(() => {
    setDemosOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const current = allRouteItems.find(item => item.to === location.pathname)
    document.title = current ? `${current.label} - FluxStack` : 'FluxStack'

    const hue = `${Math.round(theme.baseHue - 270)}deg`
    let url = faviconUrlCache.get(hue)
    if (!url) {
      if (faviconUrlCache.size >= MAX_FAVICON_CACHE) {
        const oldestKey = faviconUrlCache.keys().next().value!
        const oldestUrl = faviconUrlCache.get(oldestKey)!
        URL.revokeObjectURL(oldestUrl)
        faviconUrlCache.delete(oldestKey)
      }
      const colored = faviconSvg.replace(
        '<svg ',
        `<svg style="filter: hue-rotate(${hue})" `
      )
      const blob = new Blob([colored], { type: 'image/svg+xml' })
      url = URL.createObjectURL(blob)
      faviconUrlCache.set(hue, url)
    }
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/svg+xml'
    link.href = url
  }, [location.pathname, theme.baseHue])

  const activeDemo = demoItems.some(item => item.to === location.pathname)

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: `oklch(7% 0.018 ${theme.baseHue})` }}
    >
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/45 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
              <img
                src={FluxStackLogo}
                alt="FluxStack"
                className="h-6 w-6 transition-[filter] duration-500"
                style={{
                  filter: `hue-rotate(${theme.baseHue - 270}deg) drop-shadow(0 0 8px ${theme.primaryGlow})`,
                }}
              />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-white">
              FluxStack
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center md:flex">
            <div className="relative flex max-w-full items-center gap-1 rounded-lg border border-white/10 bg-white/[0.025] p-1">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ${
                      active
                        ? 'bg-white text-black shadow-sm'
                        : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDemosOpen(open => !open)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ${
                    activeDemo
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                  }`}
                  aria-expanded={demosOpen}
                >
                  Live Demos
                  <FaChevronDown className={`h-2.5 w-2.5 transition ${demosOpen ? 'rotate-180' : ''}`} />
                </button>

                {demosOpen && (
                  <div className="absolute left-1/2 top-11 z-50 w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-[#07070b]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Live Components</p>
                      <p className="mt-1 text-xs leading-5 text-gray-400">Demos de estado no servidor, salas e auth.</p>
                    </div>
                    <div className="mt-1 grid gap-1">
                      {demoItems.map((item) => {
                        const active = location.pathname === item.to
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            className={`rounded-md px-3 py-2 text-sm transition ${
                              active
                                ? 'bg-white text-black'
                                : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                          >
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <HeaderLink href="https://live-docs.marcosbrendon.com/">
              <FaBook className="h-3.5 w-3.5" />
              Live Docs
              <FaExternalLinkAlt className="h-2.5 w-2.5 opacity-60" />
            </HeaderLink>
            <HeaderLink href="/swagger" subtle>
              <FaBook className="h-3.5 w-3.5" />
              API
            </HeaderLink>
            <HeaderLink href="https://github.com/MarcosBrendonDePaula/FluxStack" subtle>
              <FaGithub className="h-3.5 w-3.5" />
              GitHub
            </HeaderLink>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-300 transition hover:bg-white/[0.06] hover:text-white md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-black/70 backdrop-blur-2xl md:hidden">
            <nav className="mx-auto grid max-w-7xl gap-1 px-4 py-3 sm:px-6">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-white text-black'
                        : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className="mt-2 border-t border-white/10 pt-3">
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Live Demos
                </p>
                <div className="grid gap-1">
                  {demoItems.map((item) => {
                    const active = location.pathname === item.to
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className={`rounded-lg px-3 py-2 text-sm transition ${
                          active
                            ? 'bg-white text-black'
                            : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
              <div className="mt-2 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-3">
                <a href="https://live-docs.marcosbrendon.com/" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-theme-active bg-theme-muted px-3 py-2 text-sm text-theme">
                  Live Docs
                </a>
                <a href="/swagger" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300">
                  API Docs
                </a>
                <a href="https://github.com/MarcosBrendonDePaula/FluxStack" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300">
                  GitHub
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="min-h-[calc(100vh-128px)]">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 bg-black/20 py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-center sm:flex-row sm:px-6 lg:px-8">
          <p className="text-xs text-gray-500">
            Built with <span style={{ color: theme.primary }}>FluxStack</span> - Bun + Elysia + React
          </p>
          <p className="text-xs text-gray-600">
            <span style={{ color: theme.primary }}>{theme.period}</span> palette
          </p>
        </div>
      </footer>

      {themeConfig.showPicker && <ThemePicker palette={theme} onOverride={setOverrideTheme} />}
    </div>
  )
}
