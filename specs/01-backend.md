# 01 — Backend (Elysia, Auth, Cache, Live, Rooms, Routes)

**Local:** `app/server/`
**Cobre:** rotas REST, sistema de auth (Laravel-inspired), cache, Live Components da app, typed rooms.

---

## 1. Conhecimento

### 1.1 Rotas REST — `app/server/routes/`

| Método | Rota | Notas |
|---|---|---|
| GET | `/api/health` | health check |
| GET | `/users` · `/users/:id` | listar/buscar |
| POST | `/users` | criar (name min 2, email válido) |
| DELETE | `/users/:id` | deletar |
| POST | `/auth/register` | registrar + auto-login |
| POST | `/auth/login` | **rate limited 5/60s** por email+ip |
| POST | `/auth/logout` | requer auth |
| GET | `/auth/me` | usuário autenticado |
| POST | `/rooms/:roomId/messages` · `/rooms/:roomId/emit` · GET `/rooms/.../stats` | HTTP API p/ rooms (webhooks/bots) |

Todas com schemas TypeBox → Swagger automático + inferência Eden. **Evidência:**
`routes/{auth,users,room}.routes.ts`, `routes/index.ts`.

### 1.2 Auth (Laravel-inspired) — `app/server/auth/`

- **`AuthManager`** (`AuthManager.ts:50-237`) — factory de guards/providers com cache
  (LRU 100). `guard(name?)`, `freshGuard(name?, ctx?)`, `extend(driver, factory)`.
- **`SessionGuard`** (`guards/SessionGuard.ts:21-167`) — sessão via cookie
  (httpOnly/secure/sameSite); **regenera session no login** (anti-fixation); cache por request.
- **`TokenGuard`** (`guards/TokenGuard.ts:29-205`) — Bearer token; gera 256-bit,
  **armazena só o SHA256** no cache com TTL; comparação constant-time; multi-token por usuário.
- **`SessionManager`** — abstração sobre `CacheDriver` (cookieName, lifetime 30min,
  httpOnly, sameSite **'lax'**). `create/put/read/regenerate/destroy`.
- **`RateLimiter`** (`RateLimiter.ts:23-106`) — brute-force via cache: `hit`, `tooManyAttempts`,
  `availableIn`, `clear`. Login usa max 5 / decay 60s.
- **`middleware.ts`** — `auth()`, `guest()`, `authOptional()` (401/409). `buildRequestContext`
  resolve IP por `x-forwarded-for` > `x-real-ip` > socket.
- **`DevAuthProvider`** — provider de **desenvolvimento** com tokens hardcoded
  (`admin-token`/`user-token`/`mod-token`). **Trocar por DB em produção.**
- **`InMemoryProvider`** — provider demo de usuários.

### 1.3 Cache — `app/server/cache/`

`CacheManager` (factory `driver()`, extensível via `extend()`) + `MemoryDriver`
(Map + expiry por `Date.now()`). Interface `CacheDriver`:
`get/set/has/delete/increment/decrement/remember/gc`. Usado por TokenGuard,
RateLimiter, SessionManager (backend swappável para Redis etc).

### 1.4 Live Components da app (8) — `app/server/live/`

Registrados em `auto-generated-components.ts:5-24`:

| Componente | Destaque |
|---|---|
| `LiveCounter` | room events `counter:updated`, `presence:changed`; cleanup no `destroy()` |
| `LiveLocalCounter` | sem room; demonstra proxy reativo (`this.count++`) |
| `LiveSharedCounter` | usa `CounterRoom` tipada + presença |
| `LiveForm` | `validate()/reset()/submit()`, `$field` binding |
| `LiveRoomChat` | multi-sala via `ChatRoom` + `DirectoryRoom` (senha + cleanup) |
| `LiveProtectedChat` | **auth required** + per-action permission `chat.admin` |
| `LiveAdminPanel` | `static auth = { roles:['admin'] }` + `actionAuth` (`users.delete`), audit trail |
| `LivePingPong` | latência via `PingRoom` com codec msgpack binário |

> ⚠️ Docs antigas (`fluxstack-app.md`) listam **9** componentes — só existem **8**.

### 1.5 Typed Rooms (4) — `app/server/live/rooms/`

- `CounterRoom` — increment/decrement/reset + `onlineCount`.
- `ChatRoom` — **senha hasheada (SHA256+salt)**, auth no `onJoin`, limite 100 membros, eventos.
- `DirectoryRoom` — registry de salas custom (`addRoom`/`removeRoom`).
- `PingRoom` — usado pelo LivePingPong.

Padrão `$room`: `this.$room(ChatRoom, roomId).join()`; `room.on(event, cb)` retorna
unsubscribe; `room.emit(event, data)`. Unsubs guardados em maps e limpos no `destroy()`.

### 1.6 Eden Treaty (type-safe REST)

`app.ts` exporta o tipo da app; `lib/eden-api.ts` infere tudo.
```ts
const { data, error } = await api.users.get()
const { data } = await api.users.post({ name, email })
```

---

## 2. Pontos de falha (confirmados)

### 🟠 FP-1 — `TokenGuard` guarda o token plain-text na instância  ✅ CORRIGIDO (2026-06-09)
> **Fix aplicado:** `getLastGeneratedToken()` agora é **one-shot** (retorna e zera
> `_lastGeneratedToken`); `setRequest()` também limpa o token de requests anteriores.
> O token plain-text não permanece residente após o consumo. `TokenGuard.ts:54-57,175-184`.
> **Testes:** `tests/unit/app/auth/guards.test.ts` (one-shot + limpeza em setRequest;
> sanity TDD confirmou que falham sem o fix).

`login()` gera o token (`:121`), guarda só o hash no cache (`:130`), **mas** mantém a
cópia **plain-text** em `this._lastGeneratedToken` (`:142`) para devolver via
`getLastGeneratedToken()`. Se uma exceção ocorrer entre `login()` e o controller ler
o getter, o token vaza; e fica acessível a debuggers/memory dumps até o fim da request.
**Evidência:** `TokenGuard.ts:40,119-143,176-178`.
**Fix:** retornar o token diretamente no `login()` (via return/response builder), sem armazenar.

### 🟡 FP-2 — `SessionManager.regenerate()` não destrói a sessão antiga
Cria novo ID mas não chama `destroy(oldId)` → vazamento de memória no cache + risco
residual de fixation. **Fix:** `destroy(oldId)` após criar o novo.

### 🟡 FP-3 — `ChatRoom.verifyPassword()` com possível timing attack
Comparação não constant-time / early-exit quando salt ausente. **Fix:** comparação
constant-time + resultado fixo `false` mesmo sem salt.

### 🟡 FP-4 — `sameSite: 'lax'` por padrão em cookie de sessão
Permite alguns cenários de CSRF cross-site. **Fix:** default `'strict'` com override por env.

### 🟡 FP-5 — `x-forwarded-for` confiado sem validar proxy
IP do rate-limit pode ser **spoofado** forjando o header. **Fix:** só confiar em
`x-forwarded-for` de proxies confiáveis (configurável em `auth.config`).

### 🟡 FP-6 — `MemoryDriver`/`CacheManager` sem limite de tamanho
Crescimento ilimitado → DoS por cache. **Fix:** `maxSize` + eviction (LRU/FIFO) + métricas.

### ⚪ FP-7 — Actions de Live Component sem try/catch estruturado
Erro no handler pode derrubar/desconectar em vez de retornar erro estruturado ao client.
(O **core** já isola muita coisa; aqui é sobre o contrato da app.) **Fix:** envelopar e
retornar erro estruturado.

---

## 3. O que precisa mudar

| Prio | Item | Ref |
|---|---|---|
| 🟠 | Não armazenar token plain-text no `TokenGuard` | FP-1 |
| 🟠 | `regenerate()` destruir sessão antiga | FP-2 |
| 🟠 | Garantir que `toJSON()` do user **nunca** inclua `passwordHash`/`remember_token` (allowlist de campos) | — |
| 🟡 | constant-time em `verifyPassword` | FP-3 |
| 🟡 | `sameSite` default 'strict' | FP-4 |
| 🟡 | Validar `x-forwarded-for` | FP-5 |
| 🟡 | `maxSize`/eviction em cache | FP-6 |
| 🟡 | LRU real no cache de guards do `AuthManager` (hoje evicta o primeiro inserido, não o LRU) | — |

---

## 4. Ideias de melhoria

| Impacto | Ideia |
|---|---|
| 🟠 | **Middleware de validação precoce** — Content-Type, payload máx, padrões de ataque antes das rotas. |
| 🟠 | **Audit logging** no AuthManager/guards (login/logout/falhas com ts/IP/userId). |
| 🟡 | **Token rotation** no `TokenGuard` (após N requests/tempo T). |
| 🟡 | **OAuth2/OIDC guard** via `guard.extend()` (Google/GitHub) — exemplo. |
| 🟡 | **Session activity tracking** + auto-logout por inatividade. |
| ⚪ | **WebAuthn/FIDO2** guard (passwordless). |
| ⚪ | **Distributed tracing** (X-Request-ID) propagado nos fluxos de auth. |

---

## 5. Arquivos-chave

`server/index.ts` · `server/app.ts` · `routes/{index,auth,users,room}.routes.ts` ·
`auth/{AuthManager,RateLimiter,DevAuthProvider,HashManager,middleware,index}.ts` ·
`auth/guards/{SessionGuard,TokenGuard}.ts` · `auth/providers/InMemoryProvider.ts` ·
`auth/sessions/SessionManager.ts` · `cache/{CacheManager,MemoryDriver,contracts}.ts` ·
`controllers/users.controller.ts` · `live/*.ts` · `live/rooms/*.ts`.
