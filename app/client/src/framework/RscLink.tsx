'use client'
// Link client-side para navegação RSC sem reload. Intercepta o clique e usa
// o navigate do RootClient (fetch do .rsc + transition). Cai pra <a> normal
// em ctrl/cmd-click, target _blank, ou links externos.
import type { ReactNode, MouseEvent } from 'react'
import { navigate } from './navigation'

export function RscLink({
  href,
  className,
  children,
  external,
}: {
  href: string
  className?: string
  children: ReactNode
  external?: boolean
}) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (external) return // deixa o browser tratar (ex: /swagger, target _blank)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigate(href)
  }

  return (
    <a href={href} className={className} onClick={onClick} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  )
}
