# REST Tests

Arquivos `.http` para teste manual das APIs usando a extensão [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) do VSCode.

## Requisitos

- **VSCode** com extensão **REST Client** (`humao.rest-client`)
- **Servidor rodando**: `bun run dev`

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `auth.http` | Register, Login, Me, Logout e fluxos de erro |

## Como usar

1. Abra qualquer arquivo `.http` no VSCode
2. Clique em **"Send Request"** acima de cada bloco `###`
3. O response aparece numa aba lateral

## Fluxo de teste Auth

```
1. GET  /api/health          → Verificar servidor
2. POST /api/auth/register   → Criar usuário
3. POST /api/auth/login      → Obter cookie de sessão
4. GET  /api/auth/me          → Usar cookie para ver perfil
5. POST /api/auth/logout      → Encerrar sessão
```

> **Dica**: Após o login, copie o valor do cookie `fluxstack_session` do response e cole nos requests que precisam de autenticação.
