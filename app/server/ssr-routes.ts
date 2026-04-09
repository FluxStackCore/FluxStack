/**
 * SSR Routes Registration
 *
 * Layout is rendered on the server (header, nav, footer, feature cards).
 * Interactive components (LiveCounter, forms) mount client-side via ClientSlot.
 */

import { registerSSRRoute } from '@core/plugins/built-in/ssr'
import { LandingPage } from './ssr/pages/LandingPage'
import { AboutPage } from './ssr/pages/AboutPage'

registerSSRRoute('/', {
  component: () => LandingPage,
  forceSSR: true,
  meta: {
    title: 'FluxStack — Modern Full-Stack TypeScript Framework',
    description: 'Build real-time web applications with Bun, Elysia, React 19, and LiveComponents. End-to-end type safety with Eden Treaty.',
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
    type: 'website',
  },
  cacheTtl: 3600,
})
