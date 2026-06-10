# 03 — Sistema de Plugins do FluxStack

**Local:** `core/framework/server.ts`, `core/plugins/`, `core/server/live/`, `core/build/`, `core/cli/`, `config/system/plugins.config.ts`.
**Base:** `@fluxstack/plugin-kit` **0.4.0** (ver `../../fluxstack-live/specs/06-plugin-kit.md` para o runtime do toolkit).

Esta é a peça que o Marcos pediu em destaque: **o sistema de plugins do FluxStack**.

---

## 1. Conhecimento

### 1.1 Arquitetura em duas pontas

- **Toolkit** (`@fluxstack/plugin-kit`) — runtime genérico: `PluginManager`,
  `PluginExecutor` (topological sort + parallel groups), `PluginRegistry`,
  `PluginDiscovery`. Genérico sobre `TConfig`.
- **App side** (`FluxStack/core/plugins/`) — um **shim** (`types.ts`) que especializa
  os tipos contra `FluxStackConfig` (`type Plugin = BasePlugin<FluxStackConfig>`,
  `:33-38`), e `index.ts` re-exporta `PluginRegistry`/`PluginManager`/`PluginDiscovery`.
- **`FluxStackFramework`** (`core/framework/server.ts`) — orquestra tudo: registra
  plugins, instala os hooks no Elysia, faz error handling.

### 1.2 Registro de plugins — **MANUAL via `.use()`**

```ts
// app/server/index.ts
const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)
  .use(csrfProtectionPlugin)   // plugin externo (PLUGINS/csrf-protection)
framework.use(rscPlugin).use(vitePlugin)   // full-stack only
```

> **Mudança de era:** o **auto-discovery foi removido** no plugin-kit 0.4.0. Razão
> documentada no próprio código (`app/server/index.ts:21-25`): em bundle de produção
> `dist/node_modules/` não existe, então discovery por filesystem quebrava
> silenciosamente. **Todo plugin tem de ser importado + `.use()`-d explicitamente.**

### 1.3 Plugins built-in — `core/plugins/built-in/`

| Plugin | Papel | Notas |
|---|---|---|
| `vite` | dev (proxy) + prod (static) | auto-detecta ambiente, SPA fallback; priority 800 |
| `rsc` | SSR via React Server Components | **modo oficial**; priority 860 (antes do vite) |
| `ssr` | SSR auxiliar | — |
| `swagger` | docs automáticas (`@elysiajs/swagger`) | priority 500 |
| `monitoring` | métricas HTTP/sistema | exporters console/file/prometheus |
| `static` | arquivos estáticos | `public/`, `uploads/` |
| `live-components` | integra `@fluxstack/live` | ver 1.5 |

### 1.4 Hooks de lifecycle (reais, conferidos em `server.ts`)

**Boot:** `onConfigLoad` → `setup` → `onBeforeServerStart` → `onServerStart` →
`onAfterServerStart`.
**Request:** `onRequest` (`:373`) → `onRequestValidation` (`:381`) → [handler] →
`onResponseTransform` (`:458`) → `onResponse` (`:478`).
**Erro:** `onError` (`:621-637`).
**Shutdown:** `onBeforeServerStop` → `onServerStop`.
**Build:** `onBeforeBuild` → `onBuild` → `onBuildAsset` → `onBuildComplete`.

`PluginContext` passado aos hooks: `{ config: FluxStackConfig, logger, app: Elysia,
utils, clientHooks }` (`server.ts:141-149`). Prioridade: `highest(1000) > high(750)
> normal(500) > low(250) > lowest(0)` ou numérico; dependências resolvidas por
topological sort.

### 1.5 `liveComponentsPlugin` — ponte com o realtime — `core/server/live/websocket-plugin.ts:19-86`

`setup()`: em **dev** gera `auto-generated-components.ts` e auto-descobre `LiveRoom`
classes; em **prod** usa registro estático (`@app/server/live/rooms`). Cria o
`LiveServer` com `new ElysiaTransport(context.app)` (`:47`), e replaya os auth
providers pendentes (`registerAuthProvider`).

### 1.6 Config declarativa — `config/` + `config/system/`

`defineConfig({ key: config.string/number/boolean/array/enum(...) })` (Laravel-style),
de `@fluxstack/config`. Composição em `config/system/fluxstack.config.ts`
(`type FluxStackConfig = typeof fluxStackConfig`). Validação em boot; tipos literais
preservados.

A config de plugins (`config/system/plugins.config.ts`) **ainda declara**:
`autoDiscover`, `discoverProjectPlugins`, `discoverNpmPlugins`, `allowedPlugins`
(`PLUGINS_ALLOWED`). **Mas** — ver FP-1 — esses flags são **legados não-enforçados** hoje.

### 1.7 CLI — `core/cli/`

`command-registry.ts` (register com aliases/contexto) + comandos `plugin:add`
(install + audit + whitelist), `plugin:list`, `plugin:deps`, e generators. Plugin
commands descobertos dinamicamente.

---

## 2. Pontos de falha (confirmados)

### 🟠 FP-1 — "Segurança de plugins em camadas" anunciada, mas **não enforçada**  ✅ CORRIGIDO (2026-06-09)
> **Fix aplicado:** `PluginRegistry.registerSync()` agora chama `enforceWhitelist()` —
> um plugin **npm** (escopo `@.../` ou prefixo `fluxstack-plugin-*`, exceto
> `@fluxstack/live*` e `category:'built-in'`) que **não** esteja em `allowedPlugins`
> (`PLUGINS_ALLOWED`) é **rejeitado com `PLUGIN_NOT_WHITELISTED`**, inclusive via
> `.use()`. Opt-out: `enforceNpmWhitelist: false` (env `PLUGINS_ENFORCE_NPM_WHITELIST`).
> O `PluginRegistry` passou a receber `settings` no construtor (`server.ts:93`).
> Built-in e project plugins seguem confiáveis. `registry.ts:enforceWhitelist/isNpmPlugin`.
> **Nota:** a heurística usa o **nome** do plugin; plugins cujo `name` não segue a
> convenção npm são tratados como project (confiáveis) — ex.: o CSRF tem
> `name:'csrf-protection'` e passa sem whitelist.
> **Testes:** `plugin-kit/src/__tests__/registry.whitelist.test.ts` (7 casos; sanity
> TDD confirmou que falham sem o `enforceWhitelist`).

O `CLAUDE.md` e o `plugins.config.ts` prometem: NPM bloqueado por padrão, whitelist
`PLUGINS_ALLOWED` obrigatória, project plugins confiáveis. **Na prática, em runtime,
nada disso é checado:**
- `framework.use(plugin)` → `registerSync()` valida nome/versão/deps/priority, **mas
  não consulta `allowedPlugins`**. `isPluginAllowed()` só rodava na descoberta
  automática — que **não existe mais**.
- Logo, qualquer plugin NPM (ex.: `@fluxstack/plugin-csrf-protection`) pode ser
  `.use()`-d **sem** estar na whitelist, sem erro.
**Evidência:** `app/server/index.ts:26,44`; `core/framework/server.ts` (`use()` →
`registerSync`); `fluxstack-live/packages/plugin-kit/src/runtime/registry.ts:267-284,340-373`.
**Fix:** ou (A) o `use()` classifica a origem (built-in/project/npm) e enforça a
whitelist para npm; ou (B) remover a promessa de "whitelist obrigatória" da doc e
assumir o modelo "tudo manual = tudo confiado" (já que o dev importa explicitamente).

### 🟠 FP-2 — Erros de plugin podem derrubar o servidor
Nem todo `executePluginHooks` está protegido por try/catch; um plugin que lança no
hook errado pode crashar o boot. `onError` hooks também não são totalmente
catch-safe (se o próprio `onError` lança). **Fix:** try/catch por hook com log do nome
do plugin; isolar `onError`.

### 🟡 FP-3 — `initialize()` engole erros de plugin silenciosamente
`core/framework/server.ts:180-225` envolve a init de plugins num try/catch que loga
mas não falha → se alguém criar um plugin em `plugins/`/`node_modules/` esperando
auto-discovery, ele é **ignorado em silêncio** e o servidor sobe "ok". **Fix:** falhar
alto quando um plugin esperado não carrega, ou ao menos warning proeminente.

### 🟡 FP-4 — `requestTimings` Map sem cleanup → memory leak
Em apps de alta frequência, o map de timings cresce sem limpeza. **Fix:** timer que
limpa entradas > 60s, ou WeakMap.

### 🟡 FP-5 — Mensagem de erro ruim quando o build do client falta
`vitePlugin` em prod sem `dist/client/` dá erro pouco claro. **Fix:** check no startup
com guia ("rode `bun run build:frontend`").

---

## 3. O que precisa mudar

| Prio | Item | Ref |
|---|---|---|
| 🟠 | **Decidir o modelo de segurança de plugins e alinhar código↔doc↔config** | FP-1 — hoje há três fontes contraditórias (CLAUDE.md, config, runtime) |
| 🟠 | try/catch em todos os `executePluginHooks` + isolar `onError` | FP-2 |
| 🟡 | Falhar/avisar alto quando plugin esperado não carrega | FP-3 |
| 🟡 | Cleanup do `requestTimings` | FP-4 |
| 🟡 | Validar dependências declaradas após init (logar deps ausentes) | — |
| 🟡 | **Atualizar `LLMD/core/plugin-system.md`** — descreve auto-discovery em 3 camadas que não existe mais | doc |

---

## 4. Ideias de melhoria

| Impacto | Ideia |
|---|---|
| 🟡 | **Declarative mode** — `fluxstack.plugins: [...]` no `package.json`; o server importa e `.use()` automaticamente (elimina boilerplate em `index.ts`, sem reintroduzir filesystem discovery inseguro). |
| 🟡 | **Auto-detecção de manifest** no `.use()` — lê `plugin.json`/`package.json#fluxstack` (hooks/deps/priority). |
| 🟡 | **`plugin:graph`** na CLI — grafo de dependências (ASCII/JSON), detecta ciclos, debug de load order. |
| 🟡 | **`onBeforeShutdown`** hook — cleanup ordenado de recursos async antes de `onServerStop`. |
| 🟡 | **Config schema com Zod/Valibot** — melhores mensagens de erro/coerção vs `defineConfig` manual. |
| 🟡 | **Endpoint `GET /api/__plugins`** — JSON de plugins carregados, deps, hooks, métricas (monitoring/debug). |
| ⚪ | **Hook hot-reload** (`onConfigReload`) + **timeout por-plugin** (`timeout?: number`). |
| ⚪ | **Middleware chain** estilo Express por hook (`framework.hook('onRequest').use(...)`). |

---

## 5. Como adicionar um plugin (guia atual, pós-0.4.0)

```ts
// 1. instalar / ter o plugin (PLUGINS/ local ou npm)
// 2. importar e registrar EXPLICITAMENTE em app/server/index.ts:
import { meuPlugin } from '@fluxstack/plugin-meu'
framework.use(meuPlugin)
// 3. (NÃO depender de auto-discovery — ele foi removido)
```

A CLI `bun run fluxstack plugin:add <nome>` ainda existe (install + audit + adiciona à
whitelist), mas a whitelist **não é enforçada em runtime** (FP-1) — o passo que
realmente liga o plugin é o `.use()`.

---

## 6. Arquivos-chave

`core/framework/server.ts` · `core/plugins/{index,types}.ts` ·
`core/plugins/built-in/{rsc,ssr,vite,swagger,monitoring,static,live-components}/` ·
`core/server/live/websocket-plugin.ts` · `core/build/{bundler,vite-plugins,flux-plugins-generator,optimizer}.ts` ·
`core/cli/{index,command-registry,plugin-discovery}.ts` · `core/cli/commands/plugin-*.ts` ·
`config/system/{plugins,fluxstack}.config.ts`.
