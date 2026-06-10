# Routing — file-based (RSC)

> ⚠️ **CORRIGIDO em 2026-06-09.** A versão anterior deste arquivo dizia "React Router v7"
> — isso está **errado** para o FluxStack atual (v1.22.1). O roteamento real é
> **file-based via RSC**. React Router (`App.tsx`/`main.tsx`) é **legado/dead code**
> quando RSC está ligado (o padrão). Fonte de verdade:
> [`../../specs/02-frontend-rsc.md`](../../specs/02-frontend-rsc.md).

## Como funciona (real)

FluxStack usa **roteamento file-based** dirigido por **React Server Components**
(`@vitejs/plugin-rsc`). RSC é o modo padrão: `RSC_ENABLED !== 'false'`
(`vite.config.ts:17`).

- Descoberta: `app/client/src/framework/routes.ts` lê `pages/*.tsx` via `import.meta.glob`.
- Convenção de nomes:
  - `index.tsx` → `/`
  - `about.tsx` → `/about`
  - `[slug].tsx` → `/:slug`
  - `[...rest].tsx` → `/*`
- As rotas viram matchers RegExp com grupos nomeados; o server component recebe `{ params }`.
- Navbar (`RscNav.tsx`) é gerada automaticamente das rotas descobertas.
- Navegação SPA sem reload via `RscLink` → `fetch('<href>.rsc')` + `startTransition`.

## Adicionar uma rota

1. Crie `app/client/src/pages/minha-pagina.tsx` exportando o componente (server por
   padrão; adicione `'use client'` só se precisar de interatividade local/Live).
2. Pronto — a rota `/minha-pagina` é descoberta automaticamente. Não edite `App.tsx`.

## Páginas com Live Components

Envolva com `LivePage` (faz `ClientOnly` + `ParamsProvider` + `LiveComponentsProvider`):
Live Components são `'use client'` e **deferidos no SSR** (renderizá-los no server
quebra hooks — segunda cópia de React). A conexão WebSocket é mantida viva por um
keep-alive root separado da navegação.

## Modo SPA (sem RSC)

`RSC_ENABLED=false` desliga o RSC. Nesse modo o React Router (`App.tsx`) volta a ser
relevante — mas o caminho suportado/padrão é o RSC file-based acima.
