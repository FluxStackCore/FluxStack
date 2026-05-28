// ENTRY BROWSER do FluxStack — controlador client puro do RSC.
// Roda UMA vez no load. Responsável por:
//  1. Hidratar o documento RSC inicial.
//  2. Registrar a navegação SPA (sem reload) no singleton — busca o .rsc da
//     rota e re-renderiza só o conteúdo, mantendo o processo client vivo.
//  3. Manter um keep-alive da conexão WebSocket fora da árvore RSC, num root
//     próprio que nunca é tocado pela navegação → 1 conexão para a sessão toda.
//
// Por que aqui e não no RootClient: o RootClient (client component dentro do
// payload RSC) não monta seu useEffect de forma confiável na hidratação. O
// entry.browser é client puro e SEMPRE roda — é o lugar certo para o controle.
import { createFromFetch } from '@vitejs/plugin-rsc/browser'
import { hydrateRoot, createRoot, type Root } from 'react-dom/client'
import { StrictMode, startTransition } from 'react'
import { LiveComponentsProvider } from '@/core/client'
import { setNavigate } from './navigation'

async function main() {
  // 1. Hidratação inicial do documento.
  const initial = await createFromFetch(fetch(window.location.href + '.rsc'))
  const documentRoot: Root = hydrateRoot(document, initial)

  // 2. Navegação SPA: re-renderiza o documento com o payload da nova rota.
  //    Como é o MESMO root React, o processo client (e o keep-alive) persistem.
  async function navigate(href: string, push = true) {
    const payload = await createFromFetch(fetch(href + '.rsc'))
    startTransition(() => documentRoot.render(payload))
    if (push) window.history.pushState(null, '', href)
  }
  setNavigate(navigate)
  window.addEventListener('popstate', () => navigate(window.location.pathname, false))

  // 3. Keep-alive da conexão WS — root separado, nunca tocado pela navegação.
  const keepAliveEl = document.createElement('div')
  keepAliveEl.style.display = 'none'
  keepAliveEl.setAttribute('data-ws-keepalive', '')
  document.body.appendChild(keepAliveEl)
  createRoot(keepAliveEl).render(
    <StrictMode>
      <LiveComponentsProvider autoConnect reconnectInterval={1000} heartbeatInterval={30000} />
    </StrictMode>,
  )
}

main()
