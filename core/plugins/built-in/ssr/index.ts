/**
 * FluxStack SSR Plugin — Server-Side Rendering for public pages
 *
 * Renders React components to HTML on the server for:
 * - SEO (search engine bots get real HTML)
 * - Social sharing (og:tags visible to Twitter/Discord/WhatsApp bots)
 * - Fast first paint on public/static pages
 *
 * LiveComponents and authenticated routes stay as SPA (client-rendered).
 *
 * Usage:
 * ```ts
 * import { ssrPlugin } from '@core/plugins/built-in/ssr'
 * framework.use(ssrPlugin)
 * ```
 *
 * Register SSR routes in your app:
 * ```ts
 * import { registerSSRRoute } from '@core/plugins/built-in/ssr'
 *
 * registerSSRRoute('/', {
 *   component: () => import('./pages/Home'),
 *   meta: { title: 'FluxStack — Build Real-time Apps', description: '...' }
 * })
 * ```
 */

import type { FluxStack, PluginContext } from "@core/plugins/types"
import { FLUXSTACK_VERSION } from "@core/utils/version"
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'

type Plugin = FluxStack.Plugin

export interface SSRMeta {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: string
  /** Extra meta tags as key-value pairs */
  extra?: Record<string, string>
}

export interface SSRRouteConfig {
  /** React component to render (lazy import or direct reference) */
  component: () => Promise<{ default: React.ComponentType<any> }> | React.ComponentType<any>
  /** Meta tags for SEO/social sharing */
  meta?: SSRMeta
  /** Cache TTL in seconds. 0 = no cache. Default: 300 (5 min) */
  cacheTtl?: number
}

// Registry of SSR routes
const ssrRoutes = new Map<string, SSRRouteConfig>()

// HTML render cache: path → { html, expiry }
const renderCache = new Map<string, { html: string; expiry: number }>()

/**
 * Register a route for SSR rendering.
 * Call this from your app's server-side code.
 */
export function registerSSRRoute(path: string, config: SSRRouteConfig): void {
  ssrRoutes.set(path, config)
}

/**
 * Check if a request is from a bot/crawler
 */
function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false
  const botPatterns = [
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
    'yandexbot', 'facebot', 'facebookexternalhit', 'twitterbot',
    'linkedinbot', 'whatsapp', 'telegrambot', 'discordbot',
    'slackbot', 'applebot', 'pinterestbot', 'redditbot',
  ]
  const ua = userAgent.toLowerCase()
  return botPatterns.some(bot => ua.includes(bot))
}

/**
 * Generate meta tags HTML string
 */
function renderMetaTags(meta: SSRMeta, path: string): string {
  const tags: string[] = []
  const title = meta.title || 'FluxStack App'
  const description = meta.description || ''

  // Basic meta
  tags.push(`<title>${escapeHtml(title)}</title>`)
  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}" />`)
  }

  // Open Graph
  tags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`)
  if (description) {
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`)
  }
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`)
  }
  if (meta.url) {
    tags.push(`<meta property="og:url" content="${escapeHtml(meta.url)}" />`)
  }
  tags.push(`<meta property="og:type" content="${escapeHtml(meta.type || 'website')}" />`)

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`)
  tags.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`)
  if (description) {
    tags.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`)
  }
  if (meta.image) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`)
  }

  // Extra meta tags
  if (meta.extra) {
    for (const [name, content] of Object.entries(meta.extra)) {
      tags.push(`<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`)
    }
  }

  return tags.join('\n    ')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Build full HTML page with SSR content
 */
function buildSSRPage(bodyHtml: string, meta: SSRMeta, cssLinks: string[] = []): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    ${renderMetaTags(meta, '')}
    ${cssLinks.map(href => `<link rel="stylesheet" href="${href}" />`).join('\n    ')}
    <meta name="generator" content="FluxStack ${FLUXSTACK_VERSION}" />
  </head>
  <body>
    <div id="root">${bodyHtml}</div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
}

export const ssrPlugin: Plugin = {
  name: 'ssr',
  version: '1.0.0',
  description: 'Server-Side Rendering for public pages — SEO, social sharing, bots',
  author: 'FluxStack Team',
  priority: 850, // Before Vite (800) so SSR routes take precedence
  category: 'rendering',
  tags: ['ssr', 'seo', 'rendering'],
  dependencies: [],

  setup: async (context: PluginContext) => {
    context.logger.info(`SSR plugin loaded (${ssrRoutes.size} routes registered)`)
  },

  // Use onBeforeRoute hook — runs BEFORE Vite proxy in the FluxStack pipeline
  // SSR plugin has priority 850 > Vite 800, so this runs first
  onBeforeRoute: async (ctx: any) => {
    if (ssrRoutes.size === 0) return

    const path = ctx.path
    const routeConfig = ssrRoutes.get(path)
    if (!routeConfig) {
      return
    }

    // Headers may be Record<string, string> or Headers object
    const headers = ctx.headers || {}
    const userAgent = headers['user-agent'] || headers['User-Agent'] || ''
    const forceSSR = (routeConfig as any).forceSSR === true

    if (!forceSSR && !isBot(userAgent)) return

    // Check cache
    const cached = renderCache.get(path)
    if (cached && cached.expiry > Date.now()) {
      ctx.handled = true
      ctx.response = new Response(cached.html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-SSR': 'cached' },
      })
      return
    }

    try {
      const componentResult = routeConfig.component()
      let Component: React.ComponentType<any>

      if (componentResult instanceof Promise) {
        const mod = await componentResult
        Component = (mod as any).default || mod
      } else {
        Component = componentResult as React.ComponentType<any>
      }

      const element = createElement(Component)
      const bodyHtml = renderToString(element)
      const meta = routeConfig.meta || {}
      const fullHtml = buildSSRPage(bodyHtml, meta)

      const cacheTtl = routeConfig.cacheTtl ?? 300
      if (cacheTtl > 0) {
        renderCache.set(path, { html: fullHtml, expiry: Date.now() + cacheTtl * 1000 })
      }

      ctx.handled = true
      ctx.response = new Response(fullHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-SSR': 'rendered',
          'Cache-Control': cacheTtl > 0 ? `public, max-age=${cacheTtl}` : 'no-cache',
        },
      })
    } catch (error: any) {
      console.warn(`[SSR] Failed to render ${path}: ${error.message}`)
    }
  },
}

/** Get registered SSR routes (for debugging/monitoring) */
export function getSSRRoutes(): Map<string, SSRRouteConfig> {
  return new Map(ssrRoutes)
}

/** Clear the SSR render cache */
export function clearSSRCache(): void {
  renderCache.clear()
}

export default ssrPlugin
