/**
 * Client Hydration Entry
 *
 * Uses hydrateRoot to attach event handlers to server-rendered HTML.
 * The DOM is NOT replaced — React recognizes the existing HTML and
 * just adds interactivity (click handlers, state, effects).
 */

import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { StrictMode } from 'react'
import App from './App'
import './index.css'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
