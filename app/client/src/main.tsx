import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')!

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// SSR Hydration Strategy:
// If root has SSR content, use createRoot (replace) instead of hydrateRoot.
// This avoids hydration mismatch errors since SSR pages (LandingPage, AboutPage)
// are different components than what App.tsx renders.
// The user sees SSR HTML instantly, then React replaces it with the full SPA.
// For true hydration (same component on server and client), the SSR page
// must render the exact same component tree as App.tsx.
const hasSSRContent = rootElement.hasAttribute('data-ssr') ||
  rootElement.innerHTML.trim().length > 0

if (hasSSRContent && rootElement.hasAttribute('data-ssr')) {
  // True hydration — SSR rendered the same component tree
  hydrateRoot(rootElement, app)
} else {
  // Replace mode — SSR content is different from client App, or no SSR
  createRoot(rootElement).render(app)
}
