import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { FaBook, FaGithub, FaBars, FaTimes } from 'react-icons/fa'
// SSR-compatible: use public URL instead of module import
// (module imports resolve to filesystem paths on the server)
const FluxStackLogo = '/_assets/fluxstack.svg'
// Favicon SVG loaded at runtime for dynamic hue-rotate
let faviconSvg = ''
if (typeof window !== 'undefined') {
  fetch('/_assets/fluxstack-static.svg').then(r => r.text()).then(t => { faviconSvg = t })
}
import { useThemeClock } from '../hooks/useThemeClock'
import { ThemePicker } from './ThemePicker'
import type { ColorPalette } from '../lib/theme-clock'
import { themeConfig } from '../config/theme.config'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/counter', label: 'Counter' },
  { to: '/form', label: 'Form' },
  { to: '/upload', label: 'Upload' },
  { to: '/shared-counter', label: 'Shared Counter' },
  { to: '/room-chat', label: 'Room Chat' },
  { to: '/auth', label: 'Auth' },
  { to: '/ping-pong', label: 'Ping Pong' },
  { to: '/api-test', label: 'API Test' }
]

const routeFlameHue: Record<string, string> = {
  '/': '0deg',              // roxo original
  '/counter': '180deg',     // ciano
  '/form': '300deg',        // rosa
  '/upload': '60deg',       // amarelo
  '/shared-counter': '120deg', // verde
  '/room-chat': '240deg',   // azul
  '/auth': '330deg',        // vermelho
  '/ping-pong': '200deg',   // ciano-azul
  '/api-test': '90deg',     // lima
}

// Cache favicon blob URLs by hue to avoid recreating blobs on every navigation.
// Limited to MAX_FAVICON_CACHE entries; old blob URLs are revoked to prevent leaks.
const MAX_FAVICON_CACHE = 20
const faviconUrlCache = new Map<string, string>()

export function AppLayout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const autoTheme = useThemeClock()
  const [overrideTheme, setOverrideTheme] = useState<ColorPalette | null>(null)
  const theme = overrideTheme || autoTheme

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const current = navItems.find(item => item.to === location.pathname)
    document.title = current ? `${current.label} - FluxStack` : 'FluxStack'

    // Dynamic favicon with hue-rotate based on theme clock
    const hue = `${Math.round(theme.baseHue - 270)}deg`
    let url = faviconUrlCache.get(hue)
    if (!url) {
      // Evict oldest entry if cache is full, revoking blob URL to free memory
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

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ backgroundColor: `oklch(8% 0.02 ${theme.baseHue})` }}>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a1a]/80 border-b border-white/[0.06]">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-wide">
            <img
              src={FluxStackLogo}
              alt="FluxStack"
              className="w-9 h-9 transition-[filter] duration-500"
              style={{
                filter: `hue-rotate(${theme.baseHue - 270}deg) drop-shadow(0 0 8px ${theme.primaryGlow})`,
              }}
            />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: theme.gradientPrimary }}
            >
              FluxStack
            </span>
          </Link>

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
                      ? 'font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                  style={active ? {
                    backgroundColor: theme.primaryMuted,
                    color: theme.textPrimary,
                  } : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://live-docs.marcosbrendon.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/20 text-purple-300 rounded-xl text-sm hover:bg-purple-500/30 transition-all"
            >
              <FaBook />
              Live Docs
            </a>
            <a
              href="/swagger"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-gray-400 rounded-xl text-sm hover:bg-white/[0.06] hover:text-white transition-all"
            >
              <FaBook />
              API Docs
            </a>
            <a
              href="https://github.com/MarcosBrendonDePaula/FluxStack"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-gray-400 rounded-xl text-sm hover:bg-white/[0.06] hover:text-white transition-all"
            >
              <FaGithub />
              GitHub
            </a>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#0a0a1a]/90 backdrop-blur-xl">
            <nav className="container mx-auto px-4 py-3 flex gap-4 relative">
              <div className="flex flex-col gap-1 flex-1">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      active
                        ? 'font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                    style={active ? {
                      backgroundColor: theme.primaryMuted,
                      color: theme.textPrimary,
                    } : undefined}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/[0.06]">
                <a
                  href="https://live-docs.marcosbrendon.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/20 text-purple-300 rounded-xl text-sm hover:bg-purple-500/30 transition-all"
                >
                  <FaBook />
                  Live Docs
                </a>
                <a
                  href="/swagger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] text-gray-400 rounded-xl text-sm hover:bg-white/[0.06] hover:text-white transition-all"
                >
                  <FaBook />
                  API Docs
                </a>
                <a
                  href="https://github.com/MarcosBrendonDePaula/FluxStack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] text-gray-400 rounded-xl text-sm hover:bg-white/[0.06] hover:text-white transition-all"
                >
                  <FaGithub />
                  GitHub
                </a>
              </div>
              </div>

              {/* Logo floating right */}
              <img
                src={FluxStackLogo}
                alt=""
                className="absolute right-4 top-1/2 -translate-y-1/2 w-40 h-40 opacity-15 pointer-events-none transition-[filter] duration-500"
                style={{ filter: `hue-rotate(${routeFlameHue[location.pathname] || '0deg'})` }}
              />
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.06] py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500 text-sm">
            Built with <span style={{ color: theme.primary }}>FluxStack</span> — Bun + Elysia + React
          </p>
          <p className="text-gray-600 text-xs mt-1">
            🎨 <span style={{ color: theme.primary }}>{theme.period}</span> palette — colors shift with the time of day
          </p>
        </div>
      </footer>

      {/* ThemePicker mounts after hydration to avoid SSR mismatch
          (showPicker depends on import.meta.env.DEV which differs server/client) */}
      {mounted && themeConfig.showPicker && <ThemePicker palette={theme} onOverride={setOverrideTheme} />}
    </div>
  )
}