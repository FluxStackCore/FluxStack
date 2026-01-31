# 🤖 FluxStack - AI Context Documentation

> **IMPORTANTE**: Esta documentação foi **reorganizada e modernizada** para melhor suporte a LLMs.

## 📖 **Nova Documentação AI**

👉 **Acesse a documentação completa em**: [`ai-context/`](./ai-context/)

### ⚡ **Início Rápido para LLMs**
- **[`ai-context/00-QUICK-START.md`](./ai-context/00-QUICK-START.md)** - Entenda tudo em 2 minutos
- **[`ai-context/README.md`](./ai-context/README.md)** - Navegação completa

### 🎯 **Documentos Principais**
- **[Development Patterns](./ai-context/development/patterns.md)** - Padrões e boas práticas
- **[Eden Treaty Guide](./ai-context/development/eden-treaty-guide.md)** - Guia completo Eden Treaty
- **[CRUD Example](./ai-context/examples/crud-complete.md)** - Exemplo prático completo
- **[Troubleshooting](./ai-context/reference/troubleshooting.md)** - Solução de problemas

### 🔥 **Mudanças Recentes**
- **[Eden Treaty Refactor](./ai-context/recent-changes/eden-treaty-refactor.md)** - Refatoração crítica
- **[Type Inference Fix](./ai-context/recent-changes/type-inference-fix.md)** - Correção de tipos

---

## 🚀 **FluxStack - Overview Atualizado**

**FluxStack** é um framework full-stack TypeScript moderno que combina:

### 🛠️ **Stack Tecnológica (Novembro 2024)**
- **Runtime**: Bun >= 1.2.0 (3x mais rápido que Node.js)
- **Backend**: Elysia.js 1.4.6 (ultra-performático)
- **Frontend**: React 19.1.0 + Vite 7.1.7
- **Language**: TypeScript 5.8.3 (100% type-safe)
- **Styling**: Tailwind CSS 4.1.13
- **Communication**: Eden Treaty 1.3.2 com inferência automática
- **Docs**: Swagger UI gerado automaticamente
- **Testing**: Vitest 3.2.4 + React Testing Library
- **Deploy**: Docker otimizado

### ✨ **Estado Atual (Validado)**
- **✅ Eden Treaty Nativo**: Type inference automática funcionando perfeitamente
- **✅ Zero Tipos Unknown**: Inferência corrigida após refatoração
- **✅ Monorepo Unificado**: Uma instalação, hot reload independente
- **✅ APIs Funcionando**: Health check e CRUD operacionais
- **✅ Frontend Ativo**: React 19 + Vite rodando na porta 5173
- **✅ Backend Ativo**: Elysia + Bun rodando na porta 3000

## 📁 **Arquitetura Atual Validada**

```
FluxStack/
├── core/                    # 🔒 FRAMEWORK (read-only)
│   ├── server/             # Framework Elysia + plugins
│   ├── config/             # Sistema base de configuração
│   ├── utils/              # Utilitários (env.ts, config-schema.ts)
│   ├── types/              # Types do framework
│   └── build/              # Sistema de build
├── config/                  # ⚙️ CONFIGURAÇÕES DA APLICAÇÃO
│   ├── app.config.ts        # Configuração da aplicação
│   ├── client.config.ts     # Configuração do cliente/frontend
│   ├── database.config.ts   # Banco de dados
│   ├── fluxstack.config.ts  # Configuração principal do FluxStack
│   ├── logger.config.ts     # Sistema de logs
│   ├── monitoring.config.ts # Monitoramento e métricas
│   ├── plugins.config.ts    # Configuração de plugins
│   ├── runtime.config.ts    # Configuração de runtime
│   ├── server.config.ts     # Servidor e CORS
│   ├── services.config.ts   # Configuração de serviços
│   ├── system.config.ts     # Informações do sistema
│   └── index.ts             # Exports centralizados
├── app/                     # 👨‍💻 CÓDIGO DA APLICAÇÃO
│   ├── server/             # Backend (controllers, routes)
│   │   ├── controllers/    # Lógica de negócio
│   │   ├── routes/         # Endpoints da API
│   │   └── app.ts          # Export do tipo para Eden Treaty
│   ├── client/             # Frontend (React + Vite)
│   │   ├── src/components/ # Componentes React
│   │   ├── src/lib/        # Cliente Eden Treaty
│   │   └── src/App.tsx     # Interface principal
│   └── shared/             # Types compartilhados
├── plugins/                 # 🔌 PLUGINS EXTERNOS
│   └── crypto-auth/        # Plugin de autenticação criptográfica
├── tests/                   # Testes do framework
└── ai-context/              # 📖 Documentação para LLMs
    ├── 00-QUICK-START.md   # Início rápido
    ├── README.md           # Navegação completa
    ├── development/        # Padrões e guias de desenvolvimento
    ├── examples/           # Exemplos práticos
    ├── project/            # Arquitetura e configuração
    ├── recent-changes/     # Mudanças recentes
    └── reference/          # Referência técnica
```

## 🔄 **Estado Atual da Interface**

### **Frontend Redesignado (App.tsx)**
- **Interface em abas integradas**: Demo interativo, API Docs, Tests
- **Demo CRUD**: Usuários usando Eden Treaty nativo
- **Swagger UI**: Documentação automática integrada
- **Type Safety**: Eden Treaty com inferência automática

### **Backend Robusto (Elysia + Bun)**
- **API RESTful**: Endpoints CRUD completos
- **Response Schemas**: Documentação automática via TypeBox
- **Error Handling**: Tratamento consistente de erros
- **Hot Reload**: Recarregamento automático

## 🎯 **Funcionalidades Implementadas (Validadas)**

### ✅ **1. Type Safety End-to-End**
```typescript
// ✅ Eden Treaty infere automaticamente após refatoração
const { data: user, error } = await api.users.post({
  name: "João",
  email: "joao@example.com"
})

// TypeScript sabe que:
// - user: UserResponse = { success: boolean; user?: User; message?: string }
// - error: undefined (em caso de sucesso)
```

### ✅ **2. Hot Reload Independente**
```bash
bun run dev          # ✅ Backend (3000) + Frontend (5173)
bun run dev          # ✅ Output automaticamente limpo em desenvolvimento
```

### ✅ **3. APIs Funcionais**
- **Health Check**: `GET /api/health` ✅
- **Users CRUD**: `GET|POST|PUT|DELETE /api/users` ✅
- **Swagger Docs**: `GET /swagger` ✅

### ✅ **4. Sistema de Configuração Declarativa (Laravel-inspired)**

FluxStack usa um sistema de configuração declarativa com validação automática e inferência de tipos completa.

#### 📁 **Estrutura de Configuração**
```
config/
├── app.config.ts         # Configuração da aplicação
├── client.config.ts      # Configuração do cliente/frontend
├── database.config.ts    # Configuração do banco de dados
├── fluxstack.config.ts   # Configuração principal do FluxStack
├── logger.config.ts      # Configuração de logs
├── monitoring.config.ts  # Configuração de monitoramento e métricas
├── plugins.config.ts     # Configuração de plugins
├── runtime.config.ts     # Configuração de runtime
├── server.config.ts      # Configuração do servidor
├── services.config.ts    # Configuração de serviços
├── system.config.ts      # Informações do sistema
└── index.ts             # Exports centralizados
```

#### 🎯 **Como Usar**

**1. Definir Schema de Configuração:**
```typescript
// config/app.config.ts
import { defineConfig, config } from '@/core/utils/config-schema'

const appConfigSchema = {
  name: config.string('APP_NAME', 'FluxStack', true),
  port: config.number('PORT', 3000, true),
  env: config.enum('NODE_ENV', ['development', 'production', 'test'] as const, 'development', true),
  debug: config.boolean('DEBUG', false),
} as const

export const appConfig = defineConfig(appConfigSchema)
```

**2. Usar Configuração com Type Safety:**
```typescript
import { appConfig } from '@/config/app.config'
import { appRuntimeConfig } from '@/config/runtime.config'

// ✅ Type inference automática
const name = appConfig.name        // string
const env = appConfig.env          // "development" | "production" | "test"
const debug = appRuntimeConfig.values.enableDebugMode  // boolean

// ✅ Validação em tempo de boot
if (appConfig.env === 'production') {
  // TypeScript sabe que env é exatamente 'production'
}
```

**3. Validação e Transformação:**
```typescript
const schema = {
  port: {
    type: 'number' as const,
    env: 'PORT',
    default: 3000,
    required: true,
    validate: (value: number) => {
      if (value < 1 || value > 65535) {
        return 'Port must be between 1 and 65535'
      }
      return true
    }
  }
}
```

#### ⚡ **Benefícios**
- ✅ **Type Safety Total**: Inferência automática de tipos literais
- ✅ **Validação em Boot**: Falha rápida com mensagens claras
- ✅ **Zero Tipos `any`**: TypeScript infere tudo corretamente
- ✅ **Hot Reload Seguro**: Configs podem ser recarregadas em runtime
- ✅ **Documentação Automática**: Schema serve como documentação

#### 🔧 **Helpers Disponíveis**
```typescript
import { config } from '@/core/utils/config-schema'

config.string(envVar, defaultValue, required)
config.number(envVar, defaultValue, required)
config.boolean(envVar, defaultValue, required)
config.array(envVar, defaultValue, required)
config.enum(envVar, values, defaultValue, required)
```

#### 🚫 **Não Fazer**
- ❌ Usar `process.env` diretamente no código da aplicação
- ❌ Acessar variáveis de ambiente sem validação
- ❌ Criar configs sem schema

#### ✅ **Sempre Fazer**
- ✅ Usar configs declarativos de `config/`
- ✅ Definir schemas com validação
- ✅ Usar helpers `config.*` para type safety
- ✅ Adicionar `as const` nos schemas para preservar tipos literais

### ✅ **5. Sistema de Segurança de Plugins (v1.9)**

FluxStack implementa **segurança em camadas** com **whitelist + opt-in** para proteger contra supply chain attacks.

#### 📁 **3 Camadas de Plugins**

```
1. Built-in Plugins (core/plugins/built-in)
   ✅ Manual registration via .use()
   ✅ Totalmente confiáveis

2. Project Plugins (plugins/)
   ✅ Auto-discovery ENABLED by default
   ✅ Seu código = confiável

3. NPM Plugins (node_modules/)
   🔒 Auto-discovery DISABLED by default
   🔒 Whitelist obrigatória
   ⚠️ Código de terceiros = não confiável
```

#### 🔒 **Configuração de Segurança**

```bash
# .env

# Discovery de plugins NPM (DESABILITADO por padrão)
PLUGINS_DISCOVER_NPM=false  # ❌ Seguro por padrão

# Discovery de plugins de projeto (HABILITADO por padrão)
PLUGINS_DISCOVER_PROJECT=true  # ✅ Seu código é confiável

# Whitelist de plugins NPM permitidos
# Apenas plugins nesta lista serão carregados
PLUGINS_ALLOWED=fluxstack-plugin-auth,@acme/fplugin-payments
```

#### ⚡ **Como Usar Plugins NPM com Segurança**

**Método Rápido (CLI Automatizado)**:
```bash
# Comando único que faz tudo automaticamente
bun run fluxstack plugin:add fluxstack-plugin-auth

# O comando faz:
# ✅ Valida nome do plugin
# 🔍 Audita segurança (npm audit)
# 📦 Instala plugin
# 🔧 Habilita NPM discovery
# 🛡️ Adiciona à whitelist
```

**Gerenciar Plugins via CLI**:
```bash
# Listar todos os plugins
bun run fluxstack plugin:list

# Remover plugin
bun run fluxstack plugin:remove fluxstack-plugin-auth
```

**Método Manual (se preferir)**:
```bash
# 1. Auditar plugin ANTES de instalar
npm view fluxstack-plugin-auth repository
npm audit fluxstack-plugin-auth

# 2. Habilitar discovery e adicionar à whitelist (.env)
PLUGINS_DISCOVER_NPM=true
PLUGINS_ALLOWED=fluxstack-plugin-auth

# 3. Instalar plugin
bun add fluxstack-plugin-auth

# 4. Verificar logs de segurança
bun run dev
# [INFO] Loading whitelisted npm plugin: fluxstack-plugin-auth
```

#### 🛡️ **Proteções Implementadas**
- ✅ NPM plugins **bloqueados por padrão**
- ✅ Whitelist **obrigatória** para plugins externos
- ✅ Logs de segurança **visíveis** sobre plugins bloqueados
- ✅ Opt-in **explícito** necessário

#### 🚫 **Regras de Segurança**
- ❌ NUNCA adicionar plugins sem auditar o código fonte
- ❌ NUNCA desabilitar segurança globalmente
- ❌ NUNCA confiar cegamente em packages populares
- ✅ SEMPRE auditar plugins antes de adicionar à whitelist
- ✅ SEMPRE usar versões exatas em package.json para plugins
- ✅ SEMPRE monitorar logs de segurança em produção

📖 **Documentação completa**: [`ai-context/reference/plugin-security.md`](./ai-context/reference/plugin-security.md)

## 🚨 **Regras Críticas (Atualizadas)**

### ❌ **NUNCA FAZER**
- Editar arquivos em `core/` (framework read-only)
- ~~Usar `apiCall()` wrapper~~ ✅ **REMOVIDO** - quebrava type inference
- Criar types manuais para Eden Treaty
- Ignorar response schemas nas rotas

### ✅ **SEMPRE FAZER**
- Trabalhar em `app/` (código da aplicação)
- **Usar Eden Treaty nativo**: `const { data, error } = await api.users.get()`
- Manter types compartilhados em `app/shared/`
- Definir response schemas para documentação automática
- Testar com `bun run dev`

## 🔧 **Verificação e Instalação do Bun**

### ⚠️ **REGRA CRÍTICA: Verificar Bun Antes de Executar Comandos**

**SEMPRE** que tentar executar um comando `bun` ou `bunx` e receber erro de "command not found", você **DEVE** instalar o Bun automaticamente.

### **1. Verificar se Bun está Instalado**
```bash
which bun || bun --version
```

### **2. Se Bun NÃO estiver instalado, instalar automaticamente:**

**Linux/macOS:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Após instalação, verificar:**
```bash
bun --version
```

### **3. Comportamento Esperado:**
- ✅ **Se `bun --version` funcionar**: Continuar com o comando original
- ❌ **Se `bun: command not found`**: Instalar Bun automaticamente e tentar novamente
- 🔄 **Após instalação**: Sempre verificar se funcionou antes de continuar

### **Exemplo de Fluxo:**
```bash
# Tentativa 1
bun run dev
# ❌ Error: bun: command not found

# Ação automática: Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Verificar instalação
bun --version
# ✅ Output: 1.2.20

# Tentativa 2 (agora funciona)
bun run dev
# ✅ Servidor iniciado com sucesso
```

### **💡 Dica Importante:**
- Bun é **ESSENCIAL** para FluxStack funcionar
- A instalação é rápida (< 1 minuto)
- Após instalar, pode ser necessário reiniciar o terminal ou executar: `source ~/.bashrc` (Linux) ou `source ~/.zshrc` (macOS)

## 🔧 **Comandos Validados**

```bash
# Desenvolvimento
bun run dev              # ✅ Full-stack (recomendado)
bun run dev              # ✅ Output automaticamente limpo
bun run dev:backend      # ✅ Backend apenas (porta 3001)
bun run dev:frontend     # ✅ Frontend apenas (porta 5173)

# Build e produção  
bun run build           # ✅ Build completo
bun run start           # ✅ Servidor de produção

# Testes e validação
bun run test            # ✅ Suite de testes
bunx tsc --noEmit       # ✅ Verificação TypeScript
curl http://localhost:3000/api/health  # ✅ Health check
```

## 📊 **URLs de Acesso (Validadas)**

- **🚀 Backend API**: http://localhost:3000
- **⚛️ Frontend React**: http://localhost:5173  
- **📋 Swagger Docs**: http://localhost:3000/swagger
- **🩺 Health Check**: http://localhost:3000/api/health
- **👥 Users API**: http://localhost:3000/api/users

## 🔥 **Mudanças Importantes v1.8→v1.9**

### **✅ Sistema de Segurança de Plugins (Janeiro 2025)**
- **Problema resolvido**: Auto-discovery de plugins NPM criava risco de supply chain attacks
- **Solução implementada**: Sistema de segurança em camadas com whitelist + opt-in
  - NPM plugin discovery **DESABILITADO por padrão** (secure by default)
  - Whitelist **obrigatória** para plugins NPM (`PLUGINS_ALLOWED`)
  - Project plugins (plugins/) continuam confiáveis e auto-discovered
  - Built-in plugins (core/) agora requerem registro manual via `.use()`
  - Logs de segurança visíveis sobre plugins bloqueados
- **Resultado**: Proteção robusta contra código malicioso sem comprometer DX
- **Configuração**:
  ```bash
  PLUGINS_DISCOVER_NPM=false      # ❌ NPM plugins bloqueados
  PLUGINS_DISCOVER_PROJECT=true   # ✅ Projeto confiável
  PLUGINS_ALLOWED=plugin-auth     # 🔒 Whitelist
  ```
- **Documentação**: [`ai-context/reference/plugin-security.md`](./ai-context/reference/plugin-security.md)

### **✅ Correção de Vazamento de Dados do Navegador (Novembro 2024)**
- **Problema resolvido**: Dados do navegador vazando no pacote npm
- **Solução implementada**: Correção de segurança aplicada
- **Resultado**: Pacote npm seguro e sem vazamento de dados

### **✅ Centralização da App Instance (v1.8)**
- **Problema resolvido**: Multiple exports da app instance causavam inconsistências
- **Solução implementada**: App instance como fonte única de verdade
- **Resultado**: Arquitetura mais limpa e previne bugs de sincronização

### **✅ CI/CD Arithmetic Safety (v1.8)**
- **Problema resolvido**: Exit codes inconsistentes em workflows
- **Solução implementada**: Arithmetic safety aplicado em todos os workflows CI/CD
- **Resultado**: Pipeline mais confiável e previsível

### **✅ Regra de Instalação Automática do Bun (v1.8)**
- **Problema resolvido**: LLMs não sabiam como proceder quando Bun não estava instalado
- **Solução implementada**: Instrução clara no CLAUDE.md para instalar Bun automaticamente
- **Resultado**: Onboarding mais fluido e menos erros de "command not found"

### **✅ Sistema de Versão Unificado Consolidado**
- **Aprimoramento**: Sistema de versão única de verdade completamente estável
- **Sincronização**: package.json ↔ version.ts funcionando perfeitamente
- **DX Melhorado**: Scripts `sync-version` integrados no workflow

---

## 📋 **Histórico de Versões Anteriores**

### **v1.5→v1.6 (v1.6)**

#### **✅ Limpeza e Organização do Projeto**
- **Problema resolvido**: Arquivos markdown duplicados e desorganizados na raiz
- **Solução implementada**: Consolidação em `ai-context/` e remoção de arquivos desnecessários
- **Resultado**: Estrutura limpa com apenas README.md e CLAUDE.md na raiz

#### **✅ Integração do Filtro de Bug do Elysia**
- **Problema resolvido**: Logs poluídos com erros HEAD do Elysia em desenvolvimento
- **Solução implementada**: Filtro integrado no core do framework
- **Resultado**: Logs limpos automaticamente, sem necessidade de scripts externos

#### **✅ Correção de Tipos TypeScript**
- **Problema resolvido**: Uso inadequado de tipos `any` e erros de compilação
- **Solução implementada**: Tipos específicos e interfaces apropriadas
- **Resultado**: Type safety melhorada e código mais robusto

#### **✅ Eden Treaty Refatoração**
- **Problema resolvido**: Wrapper `apiCall()` quebrava type inference
- **Solução implementada**: Eden Treaty nativo preserva tipos automáticos
- **Resultado**: Zero tipos `unknown`, autocomplete perfeito

#### **✅ Response Schemas Implementados**
- **Todas as rotas**: Schemas TypeBox para inferência
- **Documentação automática**: Swagger UI atualizado
- **Type inference**: Eden Treaty funcionando 100%

#### **✅ Monorepo Estabilizado**
- **Uma instalação**: `bun install` para todo o projeto
- **Hot reload independente**: Backend e frontend separados
- **Build otimizado**: Sistema unificado

#### **✅ Sistema de Configuração Declarativa**
- **Problema resolvido**: Uso direto de `process.env` sem validação
- **Solução implementada**: Sistema Laravel-inspired com schemas
- **Arquitetura**: 3 camadas (env loader → config schema → app configs)
- **Benefícios**:
  - ✅ Type inference completa com tipos literais
  - ✅ Validação em boot time com mensagens claras
  - ✅ Zero tipos `any` em configurações
  - ✅ Hot reload seguro de configs
  - ✅ Pasta `config/` centralizada e organizada
- **Build**: Pasta `config/` copiada automaticamente para produção
- **CLI**: `create-fluxstack` inclui configs automaticamente

## 🎯 **Próximos Passos Sugeridos**

### **Funcionalidades Pendentes**
1. **Database integration** - ORM nativo
2. **Authentication system** - Auth built-in
3. **Real-time features** - WebSockets/SSE
4. **API versioning** - Versionamento automático

### **Melhorias Técnicas**
- Middleware de validação avançado
- Cache de responses
- Bundle size optimization
- Monitoring e métricas

## 🆘 **Suporte e Troubleshooting**

1. **Erro específico?** → [`ai-context/reference/troubleshooting.md`](./ai-context/reference/troubleshooting.md)
2. **Como fazer X?** → [`ai-context/development/patterns.md`](./ai-context/development/patterns.md)
3. **Eden Treaty?** → [`ai-context/development/eden-treaty-guide.md`](./ai-context/development/eden-treaty-guide.md)
4. **Não entendo nada?** → [`ai-context/00-QUICK-START.md`](./ai-context/00-QUICK-START.md)

---

**🎯 Objetivo**: Capacitar LLMs a trabalhar eficientemente com FluxStack, seguindo padrões estabelecidos e garantindo código de alta qualidade com type safety automática.

**📅 Última atualização**: Novembro 2024 - v1.9.1 - Correção de vazamento de dados do navegador no pacote npm.