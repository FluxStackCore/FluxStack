// File-based routing — descoberta automática de páginas.
//
// O dev cria um arquivo em app/client/src/pages/ exportando default um componente
// React. Ele vira uma rota automaticamente. SEM editar RscRoot, entries, nav.
//
// Convenção de nomes (relativo a pages/):
//   index.tsx        -> /
//   sobre.tsx        -> /sobre
//   counter.tsx      -> /counter
//   blog/index.tsx   -> /blog
//   blog/post.tsx    -> /blog/post
//
// Metadata opcional: a página pode exportar `title` e `nav` (boolean/string)
// para aparecer na navbar. Ex: export const title = 'Sobre'

import type { ComponentType } from 'react'

export interface PageModule {
  default: ComponentType
  /** Título exibido na navbar (se nav !== false) */
  title?: string
  /** false esconde da navbar; string sobrescreve o label */
  nav?: boolean | string
}

export interface RouteEntry {
  path: string
  Component: ComponentType
  title: string
  /** aparece na navbar? */
  inNav: boolean
  navLabel: string
}

// Eager glob: todas as páginas no bundle do server (RSC renderiza no server).
// Caminho relativo a ESTE arquivo (framework/) -> ../pages/
const allModules = import.meta.glob<PageModule>('../pages/**/*.tsx', { eager: true })

// Convenção: arquivos de ROTA são kebab-case/lowercase (sobre.tsx, room-chat.tsx,
// index.tsx). Arquivos PascalCase (HomePage.tsx) são COMPONENTES, não rotas —
// ignorados aqui. Permite ter componentes auxiliares dentro de pages/ sem que
// virem rotas acidentais.
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([file]) => {
    const base = file.split('/').pop() ?? ''
    return !/^[A-Z]/.test(base) // ignora PascalCase
  }),
)

/** Converte o caminho do arquivo na rota. */
function fileToRoute(file: string): string {
  // file ex: '../pages/blog/index.tsx'
  let p = file.replace('../pages', '').replace(/\.tsx$/, '')
  p = p.replace(/\/index$/, '') // index -> pasta
  if (p === '') p = '/'
  return p || '/'
}

function deriveTitle(route: string): string {
  if (route === '/') return 'Home'
  const last = route.split('/').filter(Boolean).pop() ?? ''
  return last.charAt(0).toUpperCase() + last.slice(1)
}

export const routes: RouteEntry[] = Object.entries(modules)
  .map(([file, mod]) => {
    const path = fileToRoute(file)
    const title = mod.title ?? deriveTitle(path)
    const inNav = mod.nav !== false
    const navLabel = typeof mod.nav === 'string' ? mod.nav : title
    return { path, Component: mod.default, title, inNav, navLabel }
  })
  // ordena: / primeiro, depois alfabético
  .sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)))

/** Procura a rota que casa com um pathname. */
export function matchRoute(pathname: string): RouteEntry | undefined {
  return routes.find((r) => r.path === pathname)
}
