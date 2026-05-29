'use client'
// ClientOnly — adia a renderização dos filhos até DEPOIS da hidratação.
// Os Live Components (@fluxstack/live-react) usam Live.use(), que não suporta
// render no SSR (server.edge). Então no server/SSR mostramos um placeholder e
// só montamos o Live no client após o mount. Isso evita o erro de SSR e mantém
// o resto da página (server components) renderizando normalmente.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <>{mounted ? children : fallback}</>
}
