'use client'
// SHELL CLIENT PERSISTENTE — a "casca client" que nunca é destruída.
//
// Faz duas coisas:
// 1. Navegação sem reload: troca o CONTEÚDO via fetch do .rsc + startTransition,
//    mantendo o shell vivo (não recarrega a página).
// 2. ÂNCORA da conexão WebSocket: monta um LiveComponentsProvider invisível que
//    nunca desmonta. Como o connectionPool (singleton de módulo) é por-chave com
//    refcount, essa âncora mantém o refcount > 0 entre navegações → a conexão
//    NUNCA é descartada. As ilhas (com Providers próprios) reusam a MESMA conexão.
//
// Por que a âncora e não envolver o conteúdo? Porque o React Context client não
// atravessa a fronteira de serialização RSC: um Provider envolvendo o payload
// server não alcança as ilhas. Então o contexto fica nas ilhas; a âncora só
// segura a conexão no pool. É o modelo Next App Router adaptado ao live-react.
import { useEffect, useState, startTransition } from 'react'
import type { ReactNode } from 'react'
import { createFromFetch } from '@vitejs/plugin-rsc/browser'
import { LiveComponentsProvider } from '@/core/client'
import { setNavigate } from './navigation'

export function RootClient({ initialContent }: { initialContent: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(initialContent)

  // Navega buscando o payload RSC da rota (sem reload). Atualiza history.
  function navigate(href: string, push = true) {
    startTransition(async () => {
      const payload = await createFromFetch(fetch(href + '.rsc'))
      setContent(payload as ReactNode)
      if (push) window.history.pushState(null, '', href)
    })
  }

  // Registra o navigate no singleton de módulo (RscLink chama de lá — context
  // não atravessa a fronteira RSC). Botões voltar/avançar → re-fetch.
  useEffect(() => {
    setNavigate(navigate)
    const onPop = () => navigate(window.location.pathname, false)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      setNavigate(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* Âncora da conexão WS: Provider sem DOM (children null), só mantém o
          refcount do pool > 0 entre navegações. As ilhas reusam a conexão. */}
      <LiveComponentsProvider autoConnect reconnectInterval={1000} maxReconnectAttempts={5} heartbeatInterval={30000}>
        {null}
      </LiveComponentsProvider>
      {content}
    </>
  )
}
