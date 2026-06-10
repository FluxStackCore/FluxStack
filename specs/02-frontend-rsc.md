# 02 — Frontend & SSR/RSC

**Local:** `app/client/src/` + `vite.config.ts`
**Verdade central:** **RSC (React Server Components) é o modo de renderização PADRÃO.**

A confusão histórica (uma ADR dizia "Caminho A SSR clássico, RSC é experimento";
outra dizia "RSC virou padrão") está **resolvida pelo código**: RSC venceu. O
`vite.config.ts:17` liga RSC sempre que `RSC_ENABLED !== 'false'`, e
`app/server/index.ts:46-52` registra o `rscPlugin` (priority 860) antes do `vitePlugin`.
O "Caminho A" (AppShell + `renderToString`) foi **removido**.

---

## 1. Conhecimento

### 1.1 Pipeline RSC (3 ambientes)

`@vitejs/plugin-rsc` adiciona 3 ambientes ao Vite, com 3 entries:

| Entry | Papel | Arquivo |
|---|---|---|
| **rsc** | gera o RSC payload + SSR HTML; injeta CSRF | `framework/entry.rsc.tsx:6-34` |
| **ssr** | converte o stream RSC em HTML + bootstrap script | `framework/entry.ssr.tsx` |
| **browser** | hidrata, registra SPA nav, mantém WS keep-alive | `framework/entry.browser.tsx:20-47` |

`RscRoot.tsx` monta a navbar + o componente de página conforme o pathname.

### 1.2 Roteamento file-based — `framework/routes.ts:48-143`

Rotas **auto-descobertas** de `pages/*.tsx` via `import.meta.glob`. Convenção:
`index.tsx → /`, `about.tsx → /about`, `[slug].tsx → /:slug`, `[...rest].tsx → /*`.
Compiladas para matchers RegExp com grupos nomeados. O server component da rota
recebe `{ params }`. `RscNav` é gerada das rotas descobertas.

> ⚠️ **`App.tsx`/`main.tsx` (React Router) são LEGADO** — dead code quando RSC está
> ligado (o padrão). Um dev novo pode editar `App.tsx` esperando que funcione e não
> vê efeito. Ver "o que precisa mudar".

### 1.3 SPA navigation (sem reload) — `RscLink.tsx`, `entry.browser.tsx:27-34`

`RscLink` intercepta cliques (safe a ctrl/cmd/shift/alt) e chama `navigate()`, que
faz `fetch('<href>.rsc')`, deserializa o payload e renderiza na **raiz existente**
via `startTransition`. URL atualizada por `pushState`. Função global em `window.__rscNavigate`.

### 1.4 Live Components no RSC — `LivePage.tsx`, `ClientOnly.tsx`

Live Components são `'use client'` e chamam `Live.use(...)`. São **deferidos no SSR**
via `<ClientOnly>` (renderizá-los no server daria erro — segunda cópia de React quebra
hooks; ver memória `project-ssr-dual-react`). `LivePage` envolve com `ClientOnly` +
`ParamsProvider` + `LiveComponentsProvider`.

### 1.5 Keep-alive WebSocket — `entry.browser.tsx:37-47`

Um nó DOM oculto (`data-ws-keepalive`) monta o `LiveComponentsProvider` num **root
React dedicado**, **nunca tocado pela navegação** (a raiz do documento é separada).
→ **uma única conexão WS** sobrevive a todas as transições de página SPA.

### 1.6 CSRF via SSR (zero round-trip) — `framework/csrf.ts`, `entry.rsc.tsx:14-34`

O token CSRF é gerado **no SSR**, embutido como `<meta name="csrf-token">` no `<head>`
e setado como cookie `XSRF-TOKEN` (não-httpOnly). O client nasce com o token — sem o
`fetch('/api/__csrf')` extra. Padrão Rails/Laravel/Livewire.

### 1.7 Eden Treaty + plugin client-hooks — `lib/eden-api.ts`, `lib/plugin-hooks.ts`

`eden-api.ts:34-78` cria o client tipado e executa hooks `onEdenInit`. O endpoint
`/api/__plugins/client-hooks` devolve **strings de JS** registradas por plugins do
server, cacheadas por page-load e executadas via `new Function()` — ver ponto de
falha 🔴 FP-1.

---

## 2. Pontos de falha (confirmados)

### 🔴 FP-1 — Plugin client-hooks executam código arbitrário via `new Function()`  ✅ CORRIGIDO (2026-06-10)
Defesa em **duas camadas**, ambas testadas:
> **1. Integridade SRI-style (canal confiável):** o SSR embute
> `<meta name="plugin-hooks-hash" content="sha256-...">` com o hash dos hooks
> **legítimos**. O client busca os hooks por HTTP, **recomputa o hash** (Web Crypto) e
> **recusa executar** se não bater com o do SSR. Uma resposta HTTP adulterada não
> consegue forjar o hash embutido no HTML (que vem do canal SSR já confiável — mesmo
> padrão do CSRF-via-SSR). Sem SSR (SPA puro), cai no nível 2.
> **Detalhe de arquitetura:** o entry RSC roda num **ambiente Vite isolado** onde o
> singleton `pluginClientHooks` está vazio; por isso o hash é computado no **rscPlugin**
> (processo Elysia, onde os hooks estão registrados) e passado ao entry via header
> `x-plugin-hooks-hash`. Server (`crypto`) e client (Web Crypto) produzem o **mesmo**
> `sha256-<hex>` de `JSON.stringify(hooks)`.
> **2. Allowlist + type guard:** `sanitizeHooks()` só aceita hook names conhecidos
> (`onEdenInit`/`onLiveConnect`) com entradas string; `executeHook` recusa nomes fora dela.
>
> Arquivos: `framework/pluginHooksHash.ts` (server), `framework/RscRoot.tsx` (meta),
> `core/plugins/built-in/rsc/index.ts` (hash via header), `lib/plugin-hooks.ts`
> (`computeHooksHash` + verificação). **Testes:** `plugin-hooks-client.test.ts`
> (server↔client hash agreement, tampering muda o hash, allowlist) + **e2e validado**:
> `<meta>` do SSR == hash do endpoint `/api/__plugins/client-hooks`.
> **Evolução opcional:** trocar o hash por assinatura **Ed25519** (o plugin `crypto-auth`
> já tem a base) protege também sem SSR e contra server parcialmente comprometido.

`plugin-hooks.ts:74-79` faz `new Function(...keys, code); fn(...values)` com `code`
vindo de `/api/__plugins/client-hooks` (`:30`), **sem validação nem sandbox**, no
escopo global do client e com acesso a valores de contexto que podem conter dados
sensíveis (eden client, websocket, etc.). É um vetor de execução tipo-`eval`.
**Severidade:** 🔴 — se o endpoint puder ser influenciado (plugin comprometido,
MITM sem TLS, plugin npm malicioso), é RCE no browser do usuário.
**Fix:** restringir o contexto a um subconjunto seguro (sem tokens/API client);
assinar+verificar o código; ou substituir o mecanismo "código como string" por
hooks declarativos/registrados em build.

### 🟠 FP-2 — Dois sistemas de roteamento coexistem (RSC file-based + React Router)
`App.tsx`/`main.tsx` (React Router) e `framework/routes.ts` (file-based RSC) **ambos
existem**. Em modo RSC (padrão), o React Router é **dead code**. Devs podem editar
`App.tsx` à toa. **Fix:** remover `App.tsx`/`main.tsx` e documentar file-based como
padrão, **ou** prover flag explícita p/ modo SPA-React-Router.

### 🟠 FP-3 — Eden client não injeta o header CSRF automaticamente
`csrf.ts` gera o token (e o `<meta>`), mas `eden-api.ts` **não** lê o `<meta
name="csrf-token">` para adicionar `X-CSRF-Token` nas requests. Há um gap entre gerar
o token e assiná-lo. (O plugin csrf patcha `window.fetch`, mas convém o Eden também
fazer explicitamente.) **Fix:** interceptor no `createEdenClient()`.

### 🟡 FP-4 — `Live.use()` nos demos sem error boundary
Falha de mount do componente derruba a página silenciosamente. **Fix:** envolver em
error boundary / fallback gracioso.

### 🟡 FP-5 — `window.__rscNavigate` sem garantia de disponibilidade
Race se navegação dispara antes do registro. **Fix:** promise/flag de "loaded" +
fallback a full reload + estado de loading enquanto o `.rsc` é buscado.

---

## 3. O que precisa mudar

| Prio | Item | Ref |
|---|---|---|
| ✅ | ~~**Fechar o vetor `new Function()`**~~ | FP-1 — **CORRIGIDO**: integridade SRI-style (hash via SSR) + allowlist. |
| 🟠 | Consolidar roteamento (remover/realçar React Router como legado) | FP-2 |
| 🟠 | Injeção automática de header CSRF no Eden | FP-3 |
| 🟠 | **Atualizar `LLMD/reference/routing.md`** — afirma "React Router v7" como sistema de rotas; o real é **file-based RSC** | doc |
| 🟡 | Error boundaries em torno de `Live.use()` | FP-4 |
| 🟡 | Coordenação robusta da SPA nav | FP-5 |

---

## 4. Ideias de melhoria

| Impacto | Ideia |
|---|---|
| 🟡 | **Prefetch do `.rsc` no hover** do `RscLink` (reduz latência percebida). |
| 🟡 | **Tipagem de params por rota** — passo de build gera `RouteParams` por rota → `useParams<T>()` tipado. |
| 🟡 | **Route change hooks** (`onBeforeNav`/`onAfterNav`) p/ plugins (analytics, auth, scroll). |
| 🟡 | **Manifest de rotas em build** (JSON) p/ validação/tipos/analytics. |
| ⚪ | **Restauração de scroll** na SPA nav. |
| ⚪ | **HOC `withLiveRecovery`** — envolve `Live.use()` com boundary + reconnect. |

---

## 5. Arquivos-chave

`framework/entry.{rsc,ssr,browser}.tsx` · `framework/{RscRoot,RscNav,RscLink,LivePage,ClientOnly}.tsx` ·
`framework/{routes.ts,navigation.ts,params.tsx,csrf.ts}` · `lib/{eden-api,plugin-hooks}.ts` ·
`live/*.tsx` · `vite.config.ts` · `App.tsx`/`main.tsx` (legado).
