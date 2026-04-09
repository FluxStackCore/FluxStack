import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')!

// Check if this page was server-side rendered
const isSSRPage = rootElement.children.length > 0

// SSR pages: the server already rendered the HTML.
// Don't replace it with the SPA — let the static HTML stay.
// Only mount React on non-SSR routes (SPA pages like /counter, /form, etc.)
// Navigation from SSR page to SPA page will do a full page load (normal <a> tags).
if (!isSSRPage) {
  const app = (
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  )
  createRoot(rootElement).render(app)
}
