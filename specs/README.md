# Specs — FluxStack (app principal)

> **Fonte de verdade técnica da app FluxStack.**
> Gerada por varredura profunda do código real em **2026-06-09** (FluxStack **v1.22.1**).
> Substitui o conhecimento defasado em `FluxStack/CLAUDE.md` e `LLMD/` (datados de
> abril, descrevendo v1.19, "RSC como experimento", auto-discovery de plugins —
> tudo **superado**). Quando esta spec divergir daqueles, **esta vence**.

## Por que estas specs existem

O `CLAUDE.md` da app dizia **v1.19.0 / "Novembro 2024" / RSC experimental /
auto-discovery de plugins**; o código real é **v1.22.1 / RSC como modo SSR PADRÃO /
registro manual de plugins via `.use()`**. Veja `04-stale-knowledge.md` para o mapa
completo das divergências. Estas specs partem do **código**, com evidência `arquivo:linha`.

## Estrutura de uma spec

Cada documento traz: **Conhecimento** (como funciona), **Pontos de falha**
(confirmados no código), **O que precisa mudar**, **Ideias de melhoria** e **Evidência**.
Severidades: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low.

## Índice

| Spec | Cobre |
|---|---|
| [00-overview.md](00-overview.md) | Stack real, versões, modos, estrutura `app/`+`core/`, mapa de specs |
| [01-backend.md](01-backend.md) | Elysia, rotas REST, auth (guards/providers), cache, Live Components da app, typed rooms |
| [02-frontend-rsc.md](02-frontend-rsc.md) | **RSC como padrão**, roteamento file-based, SPA nav, keep-alive WS, CSRF via SSR, Eden |
| [03-plugin-system.md](03-plugin-system.md) | **Sistema de plugins** — hooks, 3 camadas, segurança, build, CLI, plugin-kit, plugins externos |
| [04-stale-knowledge.md](04-stale-knowledge.md) | Tudo que `CLAUDE.md`/`LLMD/` afirmam e o código contradiz |

> O monorepo `fluxstack-live` (Live Components) tem suas próprias specs em
> `../../fluxstack-live/specs/`. Esta pasta cobre a **app** e o **framework interno** (`core/`).

## Verdades de alto nível (validadas no código)

- **v1.22.1**. RSC (`@vitejs/plugin-rsc`, 3 ambientes rsc/ssr/client) é o **modo SSR
  oficial** — `RSC_ENABLED !== 'false'` por padrão (`vite.config.ts:17`). O "Caminho A"
  (AppShell/`renderToString`) foi **descontinuado**.
- **Plugins são registrados manualmente** via `framework.use(plugin)` em
  `app/server/index.ts` — **não há auto-discovery** (removido no plugin-kit 0.4.0).
- 8 Live Components registrados (não 9), 4 typed rooms.
- Configuração **declarativa** (Laravel-style) em `config/` + `config/system/`.

## ✅ Hardening aplicado (rev. 2026-06-10, com TDD)

| Item | Spec | Status |
|---|---|---|
| Plugin client-hooks `new Function` → integridade SRI via SSR | `02` FP-1 | ✅ |
| Whitelist de plugins NPM enforçada no `.use()` | `03` FP-1 | ✅ |
| `TokenGuard` token plain-text → one-shot | `01` FP-1 | ✅ |
| 2 testes obsoletos (timestamp no emit) atualizados | — | ✅ |

**App: 662 testes verdes.** **Ainda abertos** (não-críticos): consolidar roteamento
(`02` FP-2), CSRF no Eden (`02` FP-3), `sameSite` strict / `x-forwarded-for` /
cache `maxSize` (`01`), e os ⚪ de documentação. O monorepo Live tem seu próprio
hardening em `../../fluxstack-live/specs/README.md`.
