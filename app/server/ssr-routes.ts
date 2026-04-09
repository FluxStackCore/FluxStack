/**
 * SSR Routes Registration
 *
 * Register public pages that should be server-side rendered
 * for SEO and social sharing bots.
 *
 * These pages render HTML on the server when visited by bots
 * (Googlebot, Twitter, Discord, etc.) and fall through to SPA
 * for normal users.
 */

import { registerSSRRoute } from '@core/plugins/built-in/ssr'
import { createElement } from 'react'

// Simple SSR-compatible components (no hooks, no browser APIs)

function HomePage() {
  return createElement('div', { className: 'ssr-page' },
    createElement('header', { style: { padding: '2rem', textAlign: 'center' } },
      createElement('h1', null, '🔥 FluxStack'),
      createElement('p', null, 'Modern Full-Stack TypeScript Framework with Real-Time Components'),
    ),
    createElement('main', { style: { padding: '2rem', maxWidth: '800px', margin: '0 auto' } },
      createElement('section', null,
        createElement('h2', null, '⚡ Features'),
        createElement('ul', null,
          createElement('li', null, 'Bun Runtime — 3x faster than Node.js'),
          createElement('li', null, 'Elysia Backend — Ultra-performant HTTP + WebSocket'),
          createElement('li', null, 'React 19 Frontend — Latest features with Vite'),
          createElement('li', null, 'LiveComponents — Real-time server-client state sync'),
          createElement('li', null, 'Eden Treaty — End-to-end type safety'),
          createElement('li', null, 'Plugin System — Extensible with security'),
        ),
      ),
      createElement('section', null,
        createElement('h2', null, '🚀 Get Started'),
        createElement('pre', { style: { background: '#1a1a2e', color: '#e0e0e0', padding: '1rem', borderRadius: '8px' } },
          'bun create fluxstack my-app\ncd my-app\nbun run dev',
        ),
      ),
    ),
    createElement('footer', { style: { padding: '2rem', textAlign: 'center', color: '#888' } },
      createElement('p', null, 'Built with FluxStack — Open Source'),
    ),
  )
}

function AboutPage() {
  return createElement('div', { className: 'ssr-page' },
    createElement('h1', null, 'About FluxStack'),
    createElement('p', null, 'FluxStack is a modern full-stack TypeScript framework that combines the power of Bun, Elysia, React, and real-time WebSocket components into a cohesive development experience.'),
    createElement('h2', null, 'Why FluxStack?'),
    createElement('ul', null,
      createElement('li', null, 'Type-safe from backend to frontend via Eden Treaty'),
      createElement('li', null, 'LiveComponents for real-time features without Socket.io boilerplate'),
      createElement('li', null, 'Laravel-inspired configuration and plugin system'),
      createElement('li', null, 'Built-in CSRF protection with automatic token injection'),
    ),
  )
}

// Register SSR routes
registerSSRRoute('/', {
  component: () => HomePage,
  meta: {
    title: 'FluxStack — Modern Full-Stack TypeScript Framework',
    description: 'Build real-time web applications with Bun, Elysia, React 19, and LiveComponents. End-to-end type safety with Eden Treaty.',
    image: '/og-image.png',
    type: 'website',
  },
  cacheTtl: 3600, // 1 hour — landing page changes rarely
})

registerSSRRoute('/about', {
  component: () => AboutPage,
  meta: {
    title: 'About FluxStack — Why Choose FluxStack?',
    description: 'FluxStack combines Bun runtime, Elysia backend, React 19, and real-time LiveComponents into a cohesive TypeScript framework.',
    type: 'website',
  },
  cacheTtl: 3600,
})

export { HomePage, AboutPage }
