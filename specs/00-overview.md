# 00 — Overview da app FluxStack

**Versão real:** **v1.22.1** · varredura **2026-06-09**

## Stack real (corrigida)

| Camada | Tecnologia | Nota |
|---|---|---|
| Runtime | **Bun** | — |
| Backend | **Elysia 1.4.6** | HTTP + WebSocket |
| Frontend | **React 19** + **Vite** + **Tailwind 4.1** | RSC por padrão |
| SSR | **RSC** (`@vitejs/plugin-rsc`) | 3 ambientes rsc/ssr/client; modo oficial |
| Type-safety | **Eden Treaty** | server → client |
| Realtime | `@fluxstack/live` **0.10.0** | via `liveComponentsPlugin` + `ElysiaTransport` |
| Auth (REST) | Guards + Providers (Laravel-inspired) | SessionGuard + TokenGuard |
| Plugins | `@fluxstack/plugin-kit` **0.4.0** | registro manual `.use()` |

> ❗ `CLAUDE.md` ainda diz **v1.19.0 / "Novembro 2024"** e trata RSC como experimento.
> Está **defasado** — ver `04-stale-knowledge.md`.

## Modos de execução — `app/server/index.ts`

Via `FLUXSTACK_MODE` / `appConfig.mode`:
- **full-stack** (padrão) — Backend + Vite + RSC + LiveComponents.
- **backend-only** — Backend + LiveComponents (sem Vite/RSC).
- **frontend-only** — roda do core (`core/client/standalone-entry.ts`).

Bootstrap real (`app/server/index.ts:41-55`):
```ts
const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)
  .use(csrfProtectionPlugin)
if (appConfig.mode !== 'backend-only') {
  framework.use(rscPlugin)   // priority 860 — intercepta páginas antes do vite
  framework.use(vitePlugin)  // priority 800
}
framework.routes(appInstance)
await framework.listen()
```

## Estrutura real

```
FluxStack/
├── app/
│   ├── server/              # Backend Elysia → spec 01
│   │   ├── index.ts         # bootstrap + .use(plugins)
│   │   ├── app.ts           # instância Elysia + export do tipo (Eden)
│   │   ├── auth/            # AuthManager, guards/, providers/, sessions/, middleware
│   │   ├── cache/           # CacheManager + MemoryDriver
│   │   ├── controllers/     # users.controller
│   │   ├── live/            # 8 Live Components + rooms/ (4 typed rooms)
│   │   └── routes/          # auth / users / room
│   ├── client/src/          # Frontend → spec 02
│   │   ├── framework/       # entry.{rsc,ssr,browser}, RscRoot, routes (file-based), CSRF
│   │   ├── live/            # demos dos Live Components
│   │   ├── pages/           # páginas file-based
│   │   ├── lib/eden-api.ts  # Eden Treaty client
│   │   └── App.tsx          # ⚠️ React Router LEGADO (dead code em modo RSC)
│   └── shared/types/
├── core/                    # Framework interno → spec 03
│   ├── framework/server.ts  # FluxStackFramework (plugins, hooks, middleware)
│   ├── plugins/             # plugin-kit shim + built-in/{rsc,ssr,vite,swagger,monitoring,live-components,static}
│   ├── server/live/         # liveComponentsPlugin (integra @fluxstack/live)
│   ├── build/               # bundler, vite-plugins, flux-plugins-generator
│   └── cli/                 # comandos + generators + plugin discovery
├── config/                  # configs declarativas (+ config/system/)
└── LLMD/                    # ⚠️ docs p/ LLM DESATUALIZADAS (abril) → ver spec 04
```

## Onde olhar para cada coisa

- **"Como crio uma rota REST / uso o Eden?"** → `01-backend.md`.
- **"Como escrevo uma página? SSR ou SPA? como Live convive com server components?"** → `02-frontend-rsc.md`.
- **"Como funciona o sistema de plugins? como adiciono um plugin?"** → `03-plugin-system.md`.
- **"Por que o CLAUDE.md diz X mas o código faz Y?"** → `04-stale-knowledge.md`.
- **Live Components (o framework realtime em si)** → `../../fluxstack-live/specs/`.
