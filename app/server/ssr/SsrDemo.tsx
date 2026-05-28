/**
 * Componente de demonstração SSR-safe.
 *
 * Renderiza igual no servidor e no client (sem acesso a window/document
 * no primeiro render) — pré-requisito para hydration sem mismatch.
 *
 * O badge "client" só aparece após hydration via useEffect, provando
 * visualmente a transição SSR -> interativo.
 */

import { useState, useEffect } from 'react'

export interface SsrDemoProps {
  renderedAt: string
  counter: number
}

export function SsrDemo({ renderedAt, counter: initialCounter }: SsrDemoProps) {
  const [counter, setCounter] = useState(initialCounter)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <div>
      <h1>⚡ FluxStack SSR</h1>
      <p>
        Status:{' '}
        {hydrated ? (
          <span className="badge hydrated">hidratado (interativo)</span>
        ) : (
          <span className="badge ssr">SSR (HTML estático)</span>
        )}
      </p>
      <p>Renderizado no servidor em: <strong>{renderedAt}</strong></p>
      <p>
        Contador: <strong>{counter}</strong>{' '}
        <button onClick={() => setCounter((c) => c + 1)}>+1</button>
      </p>
      <p style={{ color: '#888', fontSize: '.85rem' }}>
        O botão só funciona após a hydration. O número e o texto acima já vieram
        prontos do servidor — é o "melhor dos dois mundos": HTML imediato + React interativo.
      </p>
    </div>
  )
}
