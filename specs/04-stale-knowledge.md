# 04 — Conhecimento defasado (CLAUDE.md / LLMD / .ai-notes)

Mapa das divergências entre o conhecimento escrito e o **código real (2026-06-09,
v1.22.1)**. Cada linha foi confirmada lendo o código. Use isto para corrigir as docs
(ou simplesmente apontar o leitor para estas specs).

## A. `FluxStack/CLAUDE.md`

| Afirma | Realidade |
|---|---|
| **v1.19.0**, "Última atualização: Abril 2026", "Stack (Novembro 2024)" | **v1.22.1** |
| `@fluxstack/live 0.7.2` | **0.10.0** |
| RSC = "experimento à parte", "Caminho A (SSR clássico)" é a visão | **RSC é o modo SSR PADRÃO**; AppShell removido (`vite.config.ts:17`, `app/server/index.ts:46-52`) |
| "Auto-discovery de plugins NPM HABILITADO/whitelist OBRIGATÓRIA" | **Auto-discovery removido** (plugin-kit 0.4.0); registro manual `.use()`; whitelist **não enforçada** (spec 03 FP-1) |
| "Próximos passos: Authentication system, Real-time features" como pendentes | **Já existem** (auth Laravel-inspired + Live Components) |
| Frontend na porta **5173** / "Novembro 2024" | RSC dirige tudo pela **3000** (Elysia); Vite é proxied |
| Plugin docs apontam para `ai-context/reference/plugin-security.md` | Pasta renomeada para `LLMD/` |

## B. `FluxStack/LLMD/`

| Doc | Afirma | Realidade |
|---|---|---|
| `INDEX.md` | "Version 1.19.0 \| @fluxstack/live 0.7.2" | **v1.22.1 / live 0.10.0** |
| `reference/routing.md` | "FluxStack usa **React Router v7**; rotas em `App.tsx`" | Roteamento é **file-based RSC** (`framework/routes.ts`); `App.tsx` é **legado/dead code** (spec 02 FP-2) |
| `core/plugin-system.md` | "3 camadas com auto-discovery (project auto, npm whitelist)" | **Tudo manual `.use()`**; sem auto-discovery; whitelist legada (spec 03) |
| `MIGRATION.md` | "Reactive State Proxy (v1.12) — `this.state.count++`" | Verdade **no server-side** (`@fluxstack/live`); **não** descreve o client RSC |
| geral | não menciona | **RSC, keep-alive WS, CSRF via SSR, plugin client-hooks** — features atuais |

## C. `fluxstack-live/llms.txt` & `.ai-notes/docs/`

| Doc | Afirma | Realidade |
|---|---|---|
| `llms.txt` | tabela de pacotes termina em `redis` | faltam **`cli`, `spatial-room`, `plugin-kit`** |
| `.ai-notes/docs/fluxstack-app.md` | **9** Live Components | são **8** (`auto-generated-components.ts:5-24`) |
| `.ai-notes/docs/fluxstack-live-packages.md` | descreve live 0.7.x; "DOM patching" no client | **0.10.0**; **não há DOM patching** (state sync puro) |
| `.ai-notes/docs/project-overview.md` | v1.20.0 / Elysia 1.4.6 | v1.22.1 |
| `.ai-notes/bugs/2026-04-10-...` | 16 bugs "confirmados sem fix" | **maioria CORRIGIDA** — ver `../../fluxstack-live/specs/99-status-bugs-historicos.md` |

## D. Bugs históricos tratados como abertos

As `.ai-notes/bugs` listam como abertos vários bugs que **já foram corrigidos com
teste de regressão** (replay nonce, `$auth.session` freeze, lifecycle try/catch+await,
`setState({x:null})`, componentId>255). O status verificado vive em
[`fluxstack-live/specs/99-status-bugs-historicos.md`](../../fluxstack-live/specs/99-status-bugs-historicos.md).
**Não retrabalhe esses itens.**

## E. O que continua verdadeiro (não mexer)

- Regra de **rebuild** após editar `fluxstack-live/packages/*/src` (Bun usa `dist/`).
- `build:adapters` falha no Windows (POSIX `&`) → buildar adapters individual.
- Junctions via `dev-link.ps1` para editar sources e refletir no app (`bun link`
  instável no Windows). Ver memórias `project-packaging-links`.
- Reconexão resiliente do client (não passar `maxReconnectAttempts` — default `Infinity`).
