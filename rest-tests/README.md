# REST Tests

Arquivos `.http` para teste manual das APIs usando a extensão [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) do VSCode.

## Requisitos

- **VSCode** com extensão **REST Client** (`humao.rest-client`)
- **Servidor rodando**: `bun run dev`

## Arquivos

| Arquivo | Guard | Descrição |
|---------|-------|-----------|
| `auth.http` | Session (cookie) | Register, Login, Me, Logout |
| `auth-token.http` | Token (Bearer) | Register, Login, Me, Logout |
| `users-token.http` | Token (Bearer) | CRUD de usuários |
| `rooms-token.http` | Token (Bearer) | Mensagens e eventos de salas |

## Configuração do Guard

Os arquivos `*-token.http` requerem o guard de token. Configure no `.env`:

```bash
AUTH_DEFAULT_GUARD=token
```

Os arquivos sem sufixo usam o guard de sessão (padrão).

## Como usar

1. Abra qualquer arquivo `.http` no VSCode
2. Clique em **"Send Request"** acima de cada bloco `###`
3. O response aparece numa aba lateral

## Fluxo de teste (Token)

```
1. GET  /api/health          → Verificar servidor
2. POST /api/auth/register   → Criar usuário (retorna token)
3. POST /api/auth/login      → Login (retorna token)
4. GET  /api/auth/me          → Bearer token no header
5. POST /api/auth/logout      → Revogar token
```

> **Dica**: Nos arquivos `*-token.http`, o token do login é capturado automaticamente via `@name login` e injetado nos requests seguintes com `{{login.response.body.token}}`.

## Fluxo de teste (Session)

```
1. GET  /api/health          → Verificar servidor
2. POST /api/auth/register   → Criar usuário
3. POST /api/auth/login      → Obter cookie de sessão
4. GET  /api/auth/me          → Usar cookie para ver perfil
5. POST /api/auth/logout      → Encerrar sessão
```

> **Dica**: Após o login, copie o valor do cookie `fluxstack_session` do response e cole nos requests que precisam de autenticação.
