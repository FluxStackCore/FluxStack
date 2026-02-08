# 🔥 Eden Treaty - Guia Completo para FluxStack

> **Eden Treaty é o coração do FluxStack**: Type safety automática end-to-end sem declarações manuais

## 🎯 **Visão Geral**

Eden Treaty é um cliente HTTP que **automaticamente infere tipos** das rotas Elysia.js, eliminando duplicação de código e garantindo sincronização perfeita entre client e server.

### ✨ **Benefícios**
- **🔒 Type Safety**: Inferência automática de tipos
- **📖 Autocomplete**: IntelliSense perfeito no editor
- **🚀 Zero Config**: Funciona sem configuração manual
- **🔄 Sync Automático**: Mudanças no server refletem automaticamente no client
- **⚡ Performance**: Otimizado para aplicações modernas

## ❌ **Erro Comum: Wrapper que Quebra Tipos**

### 🚨 **PROBLEMA (Antes da Refatoração)**
```typescript
// ❌ Wrapper que quebrava a inferência automática
export async function apiCall(apiPromise: Promise<any>) {
  const { data, error } = await apiPromise
  if (error) throw new APIException(...)
  return data // ❌ Retorna 'any' - perdeu todos os tipos!
}

// ❌ Uso que perde type safety
const users = await apiCall(api.users.get())
// users é 'any' - perdeu autocomplete e verificação de tipos! 😞
```

### ✅ **SOLUÇÃO (Após Refatoração)**
```typescript
// ✅ Eden Treaty nativo - inferência perfeita!
const { data: users, error } = await api.users.get()

if (error) {
  // error tem tipo correto com status, message, etc.
  console.log(`API Error: ${error.status}`)
  return
}

// ✅ TypeScript sabe que users é: { users: User[] }
console.log(users.users.length)     // ✨ Autocomplete perfeito!
console.log(users.users[0].name)    // ✨ Type-safe!
```

## 🏗️ **Configuração Correta**

### **1. Server App Export (app/server/app.ts)**
```typescript
import { Elysia } from "elysia"
import { apiRoutes } from "./routes"

// ✅ Exportar tipo correto para Eden Treaty
const appInstance = new Elysia()
  .use(apiRoutes)

export type App = typeof appInstance
```

### **2. Cliente Eden Treaty (app/client/src/lib/eden-api.ts)**
```typescript
import { treaty } from '@elysiajs/eden'
import type { App } from '../../../server/app'

// ✅ Criar cliente com typing correto
const client = treaty<App>(getBaseUrl())

// ✅ Exportar API diretamente para inferência perfeita
export const api = client.api

// ✅ Export apenas para error handling (opcional)
export { getErrorMessage } from './error-utils'
```

### **3. Response Schemas (app/server/routes/*.ts)**
```typescript
import { Elysia, t } from "elysia"

export const usersRoutes = new Elysia({ prefix: "/users" })
  .get("/", () => UsersController.getUsers(), {
    // ✅ Schema de resposta para inferência automática
    response: t.Object({
      users: t.Array(t.Object({
        id: t.Number(),
        name: t.String(),
        email: t.String(),
        createdAt: t.Date()
      }))
    })
  })
  .post("/", async ({ body }) => {
    return await UsersController.createUser(body)
  }, {
    body: t.Object({
      name: t.String({ minLength: 2 }),
      email: t.String({ format: "email" })
    }),
    // ✅ Schema de resposta para POST
    response: t.Object({
      success: t.Boolean(),
      user: t.Optional(t.Object({
        id: t.Number(),
        name: t.String(),
        email: t.String(),
        createdAt: t.Date()
      })),
      message: t.Optional(t.String())
    })
  })
```

## 🔍 **Type Inference in Elysia**

Elysia.js leverages `TypeBox` for schema validation and generation, which in turn fuels Eden Treaty's type inference. Understanding how Elysia infers types is crucial for maximizing type safety and developer experience.

### **Como Funciona a Inferência**
1. **Schema Definition**: Ao definir rotas, você usa `t.Object`, `t.Array`, `t.String`, etc., do `TypeBox` para descrever a estrutura dos `body`, `params`, `query` e `response`.
2. **Elysia's Internal Type Generation**: Elysia usa esses schemas para gerar tipos TypeScript em tempo de compilação/desenvolvimento.
3. **Eden Treaty Consumption**: Eden Treaty consome esses tipos gerados pela Elysia para fornecer inferência automática no cliente.

### **Exemplo Prático de Inferência**

Considere o schema de resposta para a rota GET `/users`:

```typescript
// Server: app/server/routes/users.ts
.get("/", () => UsersController.getUsers(), {
  response: t.Object({
    users: t.Array(t.Object({
      id: t.Number(),
      name: t.String(),
      email: t.String(),
      createdAt: t.Date()
    }))
  })
})
```

Quando você chama essa rota no cliente via Eden Treaty:

```typescript
// Client: app/client/src/components/UserList.tsx
const { data, error } = await api.users.get();

if (data) {
  // `data` é inferido automaticamente como:
  // { users: Array<{ id: number; name: string; email: string; createdAt: Date; }> }
  data.users.forEach(user => {
    console.log(user.name); // `user.name` é inferido como `string`
    const userId: number = user.id; // `user.id` é inferido como `number`
  });
}
```

Isso demonstra como a inferência de tipo funciona de ponta a ponta, sem a necessidade de definir interfaces ou tipos duplicados manualmente no cliente.

## 💡 **Padrões de Uso Correto**

### **✅ Padrão 1: GET Simples**
```typescript
// Server Route
.get("/users", () => UsersController.getUsers())

// Client Usage - Eden Treaty nativo
const { data: response, error } = await api.users.get()

if (error) {
  console.log(`Erro: ${error.status} - ${error.message}`)
  return
}

// ✨ TypeScript infere: response = { users: User[] }
response.users.forEach(user => {
  console.log(user.name) // ✨ Autocomplete perfeito!
})
```

### **✅ Padrão 2: POST com Body**
```typescript
// Server Route
.post("/users", async ({ body }) => UsersController.createUser(body))

// Client Usage
const { data: result, error } = await api.users.post({
  name: "João Silva",
  email: "joao@example.com"
})

if (error) {
  console.log(`Erro na criação: ${error.status}`)
  return
}

// ✨ TypeScript infere: result = UserResponse
if (result.success && result.user) {
  console.log(`Usuário criado: ${result.user.name}`)
}
```

### **✅ Padrão 3: GET com Parâmetros**
```typescript
// Server Route  
.get("/:id", async ({ params: { id } }) => UsersController.getUserById(+id))

// Client Usage
const { data: response, error } = await api.users({ id: 123 }).get()

if (error) {
  console.log(`Usuário não encontrado: ${error.status}`)
  return
}

// ✨ TypeScript infere: response = { user: User }
console.log(`Nome: ${response.user.name}`)
```

### **✅ Padrão 4: DELETE**
```typescript
// Server Route
.delete("/:id", ({ params: { id } }) => UsersController.deleteUser(+id))

// Client Usage
const { data: result, error } = await api.users({ id: userId }).delete()

if (error) {
  console.log(`Erro ao deletar: ${error.status}`)
  return
}

// ✨ TypeScript infere: result = UserResponse
if (result.success) {
  console.log(`Usuário deletado: ${result.message}`)
}
```

## 🔧 **Error Handling Elegante**

### **✅ Padrão Global de Error Handling**
```typescript
// utils/api-helpers.ts
export function handleApiError(error: any, context: string) {
  console.error(`[${context}] API Error:`, {
    status: error.status,
    message: error.message,
    details: error.details
  })
  
  // Tratamento específico por status
  switch (error.status) {
    case 400: return "Dados inválidos fornecidos"
    case 401: return "Acesso não autorizado"
    case 404: return "Recurso não encontrado"
    case 500: return "Erro interno do servidor"
    default: return "Erro desconhecido"
  }
}

// Uso nos componentes
const { data: users, error } = await api.users.get()

if (error) {
  const userMessage = handleApiError(error, "Lista de Usuários")
  showToast("error", userMessage)
  return
}

// Continuar com dados válidos...
```

## 🎯 **Dicas Avançadas**

### **💡 Dica 1: Type Guards**
```typescript
// Verificar sucesso com type safety
const { data, error } = await api.users.post(userData)

if (error) return // Early return

// Aqui TypeScript sabe que data é o tipo de sucesso
if (data.success && data.user) {
  // data.user é garantidamente User
  updateUsersList(data.user)
}
```

### **💡 Dica 2: Loading States**
```typescript
const [loading, setLoading] = useState(false)
const [users, setUsers] = useState<User[]>([])

const loadUsers = async () => {
  setLoading(true)
  try {
    const { data, error } = await api.users.get()
    
    if (error) {
      showError(handleApiError(error, "Carregar Usuários"))
      return
    }
    
    setUsers(data.users) // ✨ Type-safe assignment
  } finally {
    setLoading(false)
  }
}
```

### **💡 Dica 3: Optimistic Updates**
```typescript
const deleteUser = async (userId: number) => {
  // Otimistic update
  setUsers(prev => prev.filter(u => u.id !== userId))
  
  try {
    const { error } = await api.users({ id: userId }).delete()
    
    if (error) {
      // Reverter mudança otimística
      loadUsers() // Recarregar estado real
      showError(handleApiError(error, "Deletar Usuário"))
    }
  } catch (err) {
    loadUsers() // Recarregar em caso de erro de rede
  }
}
```

## ⚠️ **Problemas Comuns & Soluções**

### **❌ Problema: Tipos `unknown`**
```typescript
// Se você vir isso:
const { data, error } = await api.users.get()
// data é 'unknown' em vez do tipo correto
```

**✅ Soluções:**
1. **Verificar response schema** nas rotas do servidor
2. **Confirmar export** do tipo App correto
3. **Reiniciar** TypeScript server no editor
4. **Verificar** se não há conflitos de tipos

### **❌ Problema: Error 'Property does not exist'**
```typescript
// Erro: Property 'users' does not exist on type 'unknown'
console.log(data.users) // ❌
```

**✅ Solução:**
```typescript
// Verificar schema da rota:
response: t.Object({
  users: t.Array(/* User schema */)
})
```

### **❌ Problema: Parâmetros não funcionam**
```typescript
// ❌ Sintaxe incorreta
await api.users[userId].get() // Error!

// ✅ Sintaxe correta
await api.users({ id: userId }).get()
```

## 🧪 **Testing com Eden Treaty**

### **✅ Teste de Integração**
```typescript
// tests/api.test.ts
import { describe, it, expect } from 'vitest'
import { api } from '../app/client/src/lib/eden-api'

describe('Users API', () => {
  it('should create and fetch user', async () => {
    // Criar usuário
    const { data: createResult, error: createError } = await api.users.post({
      name: "Test User",
      email: "test@example.com"
    })
    
    expect(createError).toBeUndefined()
    expect(createResult.success).toBe(true)
    expect(createResult.user).toBeDefined()
    
    // Buscar usuário criado
    const { data: getResult, error: getError } = await api.users({ 
      id: createResult.user!.id 
    }).get()
    
    expect(getError).toBeUndefined()
    expect(getResult.user.name).toBe("Test User")
  })
})
```

## 📚 **Recursos Adicionais**

- **[Eden Treaty Docs](https://elysiajs.com/eden/overview.html)** - Documentação oficial
- **[Elysia Validation](https://elysiajs.com/validation/overview.html)** - Schemas TypeBox
- **[TypeScript Inference](https://www.typescriptlang.org/docs/handbook/type-inference.html)** - Como funciona

---

**🎯 Com Eden Treaty nativo, você tem type safety total, autocomplete perfeito e zero duplicação de código entre client e server!**