/**
 * Entry de HYDRATION do modo SSR.
 *
 * O SERVER renderiza o AppShell (estático + placeholders de ilha Live, sem
 * WebSocket). O CLIENT hidrata o App REAL — com LiveComponentsProvider e os
 * componentes Live de verdade, que conectam ao WebSocket após montar.
 *
 * Reconciliação na hydration:
 * - Layout, Home e rotas estáticas: markup idêntico → casa sem mismatch.
 * - Rotas Live: o placeholder do server != Live real do client → o React
 *   regenera apenas aquela subárvore (mismatch local, esperado e aceitável).
 *
 * main.tsx (SPA puro, createRoot) segue intocado como caminho sem-SSR.
 */
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

const rootEl = document.getElementById('root')!

hydrateRoot(
  rootEl,
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
