import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

// SSR + SPA hybrid:
// If server rendered a shell with #spa-outlet, mount React content there
// and skip the client-side AppLayout (SSR already has header/nav/footer).
const spaOutlet = document.getElementById('spa-outlet')
const mountTarget = spaOutlet || document.getElementById('root')!

// Tell App whether we're inside SSR shell (skip AppLayout) or standalone
;(window as any).__SSR_SHELL__ = !!spaOutlet

createRoot(mountTarget).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
