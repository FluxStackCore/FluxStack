// File-based routing — descoberta automática de páginas (com rotas dinâmicas).
//
// O dev cria um arquivo em app/client/src/pages/ exportando default um componente
// React. Ele vira uma rota automaticamente. SEM editar RscRoot, entries, nav.
//
// Convenção de nomes (relativo a pages/):
//   index.tsx          -> /
//   sobre.tsx          -> /sobre
//   blog/index.tsx     -> /blog
//   blog/[slug].tsx    -> /blog/:slug        (dinâmica — params.slug)
//   user/[id].tsx      -> /user/:id          (dinâmica — params.id)
//   docs/[...rest].tsx -> /docs/*            (catch-all — params.rest = array)
//
// A página recebe `{ params }` como prop (funciona em server E client component).
// No client, também pode usar useParams() (ver ParamsContext).
//
// Metadata opcional: export const title = '...'; export const nav = false|'Label'.

import type { ComponentType } from 'react'

export type RouteParams = Record<string, string | string[]>

export interface PageProps {
  params: RouteParams
}

export interface PageModule {
  default: ComponentType<PageProps>
  title?: string
  nav?: boolean | string
}

export interface RouteEntry {
  /** path estilo express (ex: /blog/:slug, /docs/*) — só p/ exibição/debug */
  path: string
  Component: ComponentType<PageProps>
  title: string
  inNav: boolean
  navLabel: string
  /** regex que casa o pathname; grupos nomeados = params */
  matcher: RegExp
  /** nomes dos params na ordem (p/ catch-all marcamos com flag) */
  paramNames: { name: string; catchAll: boolean }[]
  /** true se a rota tem segmentos dinâmicos */
  dynamic: boolean
}

const allModules = import.meta.glob<PageModule>('../pages/**/*.tsx', { eager: true })

// Convenção: arquivos de ROTA são kebab-case/lowercase. PascalCase (HomePage.tsx)
// são COMPONENTES auxiliares, ignorados. [slug] começa com '[', também válido.
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([file]) => {
    const base = file.split('/').pop() ?? ''
    return !/^[A-Z]/.test(base)
  }),
)

/** Converte o caminho do arquivo no path estilo express. */
function fileToPath(file: string): string {
  let p = file.replace('../pages', '').replace(/\.tsx$/, '')
  p = p.replace(/\/index$/, '')
  if (p === '') p = '/'
  // [...rest] -> * (catch-all); [slug] -> :slug
  p = p.replace(/\[\.\.\.([^\]]+)\]/g, '*').replace(/\[([^\]]+)\]/g, ':$1')
  return p || '/'
}

/** Compila o path em regex + lista de params. */
function compile(path: string): { matcher: RegExp; paramNames: { name: string; catchAll: boolean }[] } {
  const paramNames: { name: string; catchAll: boolean }[] = []
  // capturar o nome original do arquivo p/ catch-all: refazemos a partir do file
  // mas aqui derivamos do próprio path: ':x' e '*' (catch-all usa nome 'rest' fixo
  // quando vier de [...rest]; preservamos abaixo no map principal).
  const pattern = path
    .split('/')
    .map((seg) => {
      if (seg === '*') {
        paramNames.push({ name: '*', catchAll: true })
        return '(?<catchall>.*)'
      }
      if (seg.startsWith(':')) {
        const name = seg.slice(1)
        paramNames.push({ name, catchAll: false })
        return `(?<${name}>[^/]+)`
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  const matcher = new RegExp(`^${pattern}/?$`)
  return { matcher, paramNames }
}

export const routes: RouteEntry[] = Object.entries(modules)
  .map(([file, mod]) => {
    const path = fileToPath(file)
    // nome real do catch-all vem do arquivo ([...rest] -> 'rest')
    const catchAllName = file.match(/\[\.\.\.([^\]]+)\]/)?.[1]
    const { matcher, paramNames } = compile(path)
    // substitui o placeholder '*' pelo nome real do catch-all
    for (const p of paramNames) if (p.catchAll && catchAllName) p.name = catchAllName
    const dynamic = paramNames.length > 0
    const title = mod.title ?? deriveTitle(path)
    const inNav = mod.nav !== false && !dynamic // rotas dinâmicas não vão na navbar por padrão
    const navLabel = typeof mod.nav === 'string' ? mod.nav : title
    return { path, Component: mod.default, title, inNav, navLabel, matcher, paramNames, dynamic }
  })
  // ESTÁTICAS antes de DINÂMICAS (senão /blog/novo casaria /blog/:slug antes de /blog/novo);
  // entre estáticas, / primeiro depois alfabético.
  .sort((a, b) => {
    if (a.dynamic !== b.dynamic) return a.dynamic ? 1 : -1
    if (a.path === '/') return -1
    if (b.path === '/') return 1
    return a.path.localeCompare(b.path)
  })

function deriveTitle(path: string): string {
  if (path === '/') return 'Home'
  const last = path.split('/').filter(Boolean).pop() ?? ''
  const clean = last.replace(/^[:*]/, '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export interface MatchResult {
  route: RouteEntry
  params: RouteParams
}

/** Procura a rota que casa com um pathname, extraindo os params. */
export function matchRoute(pathname: string): MatchResult | undefined {
  for (const route of routes) {
    const m = route.matcher.exec(pathname)
    if (!m) continue
    const params: RouteParams = {}
    for (const p of route.paramNames) {
      const raw = p.catchAll ? m.groups?.catchall : m.groups?.[p.name]
      if (raw === undefined) continue
      params[p.name] = p.catchAll ? raw.split('/').filter(Boolean) : raw
    }
    return { route, params }
  }
  return undefined
}
