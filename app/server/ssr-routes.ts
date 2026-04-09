/**
 * SSR Routes Registration
 *
 * Every route gets SSR — the server renders the layout shell instantly,
 * then React takes over and mounts the full interactive SPA.
 * Users see the page immediately while JS loads in the background.
 *
 * - / and /about have custom SSR content (landing page, about page)
 * - All other routes get the layout shell (header, nav, footer)
 */

import { registerSSRRoute } from '@core/plugins/built-in/ssr'
import { LandingPage } from './ssr/pages/LandingPage'
import { AboutPage } from './ssr/pages/AboutPage'
import { ShellPage } from './ssr/pages/ShellPage'
import { createElement } from 'react'

// Custom SSR pages — full content rendered on server
registerSSRRoute('/', {
  component: () => LandingPage,
  forceSSR: true,
  meta: {
    title: 'FluxStack — Modern Full-Stack TypeScript Framework',
    description: 'Build real-time web applications with Bun, Elysia, React 19, and LiveComponents.',
    image: '/og-image.png',
    type: 'website',
  },
  cacheTtl: 3600,
})

registerSSRRoute('/about', {
  component: () => AboutPage,
  forceSSR: true,
  meta: {
    title: 'About FluxStack — Architecture & Open Source',
    description: 'FluxStack combines Bun, Elysia, React 19, and LiveComponents into a cohesive TypeScript framework.',
  },
  cacheTtl: 3600,
})

// Shell SSR for SPA routes — layout loads instantly, React mounts content
const spaRoutes = [
  { path: '/counter', title: 'Counter — FluxStack' },
  { path: '/form', title: 'Form — FluxStack' },
  { path: '/upload', title: 'Upload — FluxStack' },
  { path: '/shared-counter', title: 'Shared Counter — FluxStack' },
  { path: '/room-chat', title: 'Room Chat — FluxStack' },
  { path: '/auth', title: 'Auth — FluxStack' },
  { path: '/ping-pong', title: 'Ping Pong — FluxStack' },
  { path: '/api-test', title: 'API Test — FluxStack' },
]

for (const route of spaRoutes) {
  registerSSRRoute(route.path, {
    component: () => () => createElement(ShellPage, { activeRoute: route.path }),
    forceSSR: true,
    meta: { title: route.title },
    cacheTtl: 300, // 5 min — shell doesn't change often
  })
}
