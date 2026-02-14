# Plano: Sistema de Login Inspirado no Laravel para FluxStack

## Filosofia

Seguir o padrão **Guard + Provider** do Laravel: o Guard sabe **COMO** autenticar (session? token? JWT?), o Provider sabe **ONDE** os usuários estão (banco? memória? LDAP?), e o Authenticatable define **O QUE** é um usuário. Os três são independentemente substituíveis via configuração.

## Arquitetura

```
app/server/auth/
├── contracts.ts           # Interfaces: Guard, UserProvider, Authenticatable
├── AuthManager.ts         # Orquestrador central (factory + cache de guards)
├── HashManager.ts         # Abstração de password hashing (bcrypt/argon2 via Bun)
├── RateLimiter.ts         # Rate limiting para login (anti brute-force)
├── guards/
│   ├── SessionGuard.ts    # Guard baseado em session/cookie (padrão web)
│   └── TokenGuard.ts      # Guard baseado em Bearer token (API)
├── providers/
│   └── InMemoryProvider.ts # Provider in-memory (dev/demo, substituível por DB)
├── sessions/
│   ├── SessionManager.ts  # Gerenciador de sessões (factory de drivers)
│   └── MemoryDriver.ts    # Driver de sessão in-memory (dev/testes)
├── middleware.ts           # Middlewares Elysia: auth(), guest()
└── index.ts               # Exports públicos

config/system/
├── auth.config.ts         # Config de guards, providers, passwords
└── session.config.ts      # Config de sessão (driver, lifetime, cookie)

app/server/routes/
└── auth.routes.ts         # Endpoints: POST /login, /register, /logout, GET /me
```

## Arquivos a Criar/Modificar

### 1. Contracts (interfaces) — `app/server/auth/contracts.ts`
- `Authenticatable` — interface que define o que é um "usuário autenticável"
  - `getAuthId()`, `getAuthPassword()`, `getRememberToken()`, etc.
- `Guard` — interface do guard
  - `check()`, `guest()`, `user()`, `id()`, `validate()`, `attempt()`, `login()`, `logout()`
- `UserProvider` — interface do provider de dados
  - `retrieveById()`, `retrieveByCredentials()`, `validateCredentials()`, `retrieveByToken()`, `updateRememberToken()`
- `SessionDriver` — interface do driver de sessão
  - `read()`, `write()`, `destroy()`, `gc()`

### 2. HashManager — `app/server/auth/HashManager.ts`
- Usa `Bun.password.hash()` e `Bun.password.verify()` nativos
- Suporta bcrypt e argon2id
- Método `needsRehash()` para migração transparente de algoritmos

### 3. RateLimiter — `app/server/auth/RateLimiter.ts`
- Rate limiting por chave (email+ip)
- `hit()`, `tooManyAttempts()`, `clear()`, `availableIn()`
- GC automático de entradas expiradas

### 4. Session System — `app/server/auth/sessions/`
- `MemoryDriver` — sessões in-memory (para dev/testes)
- `SessionManager` — factory de drivers, extensível com `extend()`

### 5. Guards — `app/server/auth/guards/`
- `SessionGuard` — autenticação via session cookie
  - `attempt(credentials, remember?)` — fluxo completo: busca user → valida password → cria sessão
  - `login(user)` — autentica programaticamente
  - `logout()` — destroi sessão
  - `user()` — resolve usuário da sessão (com cache per-request)
  - Regeneração de session ID após login (proteção session fixation)
- `TokenGuard` — autenticação via Bearer token (API)
  - Valida token no header Authorization
  - Busca user via provider

### 6. AuthManager — `app/server/auth/AuthManager.ts`
- Factory pattern com lazy resolution e cache
- `guard(name?)` — resolve guard por nome (ou default)
- `extend(driver, factory)` — registra guard driver customizado
- Configuração via `auth.config.ts`

### 7. Providers — `app/server/auth/providers/`
- `InMemoryProvider` — armazena usuários em memória (demo/dev)
  - Implementa `UserProvider`
  - CRUD básico para registro
  - Hash de passwords via HashManager

### 8. Middleware — `app/server/auth/middleware.ts`
- `auth(guardName?)` — middleware Elysia que requer autenticação
  - Resolve user via guard, retorna 401 se não autenticado
  - Injeta `user` no context via `derive()`
- `guest(guardName?)` — middleware que requer NÃO estar autenticado

### 9. Config — `config/system/auth.config.ts` e `config/system/session.config.ts`
- `auth.config.ts`:
  - `defaults.guard` — guard padrão ('session')
  - `guards` — mapa de guards configurados
  - `providers` — mapa de user providers
  - `passwords.hashAlgorithm` — bcrypt | argon2id
- `session.config.ts`:
  - `driver` — 'memory' (extensível para 'redis', 'database')
  - `lifetime` — tempo em minutos
  - `cookieName` — nome do cookie
  - `httpOnly`, `secure`, `sameSite`

### 10. Auth Routes — `app/server/routes/auth.routes.ts`
- `POST /api/auth/register` — registra novo usuário (name, email, password)
- `POST /api/auth/login` — login (email, password) → retorna session cookie + user data
- `POST /api/auth/logout` — destroi sessão
- `GET /api/auth/me` — retorna usuário autenticado
- Rate limiting no login
- TypeBox schemas para request/response + Swagger docs

### 11. Integrações — Modificar arquivos existentes
- `app/server/routes/index.ts` — registrar `authRoutes`
- `app/shared/types/index.ts` — adicionar tipos de auth (AuthUser, LoginRequest, RegisterRequest, etc.)
- `config/index.ts` — exportar `authConfig` e `sessionConfig`
- `app/server/index.ts` — importar e inicializar auth

## Fluxo de Login (Session Guard)

```
1. Client POST /api/auth/login { email, password }
2. RateLimiter verifica tentativas
3. SessionGuard.attempt(credentials):
   a. Provider.retrieveByCredentials({ email })  → busca user (SEM password)
   b. Provider.validateCredentials(user, { password })  → Hash.check()
   c. Se válido: cria sessão, seta cookie, retorna user
   d. Se inválido: RateLimiter.hit(), retorna 401
4. Em requests seguintes:
   a. Middleware auth() lê cookie
   b. SessionGuard.user() busca sessão → Provider.retrieveById()
   c. Injeta user no context
```

## O que o Dev pode customizar

1. **Trocar Guard**: Implementar interface `Guard`, registrar via `authManager.extend()`
2. **Trocar Provider**: Implementar interface `UserProvider` (ex: com Prisma, Drizzle, API externa)
3. **Trocar Session Driver**: Implementar interface `SessionDriver` (ex: Redis, Database)
4. **Trocar Hash Algorithm**: Mudar `AUTH_HASH_ALGORITHM` no .env
5. **Adicionar Guards**: Configurar múltiplos guards no `auth.config.ts`
6. **Customizar Rate Limiting**: Ajustar via env vars

## Ordem de Implementação

1. Contracts (interfaces)
2. HashManager
3. RateLimiter
4. Session system (driver + manager)
5. Guards (SessionGuard, TokenGuard)
6. AuthManager
7. InMemoryProvider
8. Middleware
9. Configs (auth.config.ts, session.config.ts)
10. Auth Routes
11. Shared types
12. Integrações (registrar rotas, exportar configs)
13. Inicialização no index.ts
