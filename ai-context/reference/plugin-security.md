# 🔒 Plugin Security Guide

## Overview

FluxStack implementa um **sistema de segurança em camadas** para proteger contra ataques de supply chain através de plugins maliciosos. O sistema usa **whitelist + opt-in** como estratégia principal.

## 🎯 Modelo de Segurança

### 3 Camadas de Plugins

```
┌─────────────────────────────────────────┐
│  1. Built-in Plugins (core/plugins/)    │  ✅ Totalmente confiáveis
│     - Manual registration via .use()     │  ✅ Desenvolvedor escolhe
│     - Parte do framework                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  2. Project Plugins (plugins/)           │  ✅ Confiáveis (seu código)
│     - Auto-discovery ENABLED by default  │  ✅ Opt-out disponível
│     - Código da aplicação                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  3. NPM Plugins (node_modules/)          │  ⚠️ Não confiáveis
│     - Auto-discovery DISABLED by default │  🔒 Whitelist obrigatória
│     - Código de terceiros                │  🔒 Opt-in necessário
└─────────────────────────────────────────┘
```

## 🔒 Configuração de Segurança

### Variáveis de Ambiente

```bash
# .env

# 🔍 Auto-discovery (APENAS descobre plugins, NÃO carrega automaticamente)
PLUGINS_AUTO_DISCOVER=true

# 🔒 Descoberta de plugins NPM (DESABILITADO por padrão)
PLUGINS_DISCOVER_NPM=false  # ❌ Seguro por padrão

# ✅ Descoberta de plugins de projeto (HABILITADO por padrão)
PLUGINS_DISCOVER_PROJECT=true  # ✅ Seu código é confiável

# 🛡️ Whitelist de plugins NPM permitidos
# Formato: lista separada por vírgulas
# Exemplo:
PLUGINS_ALLOWED=fluxstack-plugin-auth,@acme/fplugin-payments
```

### Configuração em Código

```typescript
// config/system/plugins.config.ts
export const pluginsConfig = defineConfig({
  // Auto-discovery (APENAS encontra, NÃO carrega)
  autoDiscover: config.boolean('PLUGINS_AUTO_DISCOVER', true),

  // 🔒 SECURITY: Controle de descoberta
  discoverNpmPlugins: config.boolean('PLUGINS_DISCOVER_NPM', false),
  discoverProjectPlugins: config.boolean('PLUGINS_DISCOVER_PROJECT', true),

  // 🛡️ SECURITY: Whitelist obrigatória para NPM
  allowedPlugins: config.array('PLUGINS_ALLOWED', []),
})
```

## ⚠️ Riscos de Segurança

### Supply Chain Attacks

**Problema**: Plugins NPM podem conter código malicioso ou dependências comprometidas.

**Exemplos reais**:
- Packages typosquatting (nomes similares a populares)
- Dependências transitivas comprometidas
- Maintainer account hijacking
- Malicious code injection em updates

**Proteção do FluxStack**:
1. ✅ NPM discovery **DESABILITADO por padrão**
2. ✅ Whitelist **obrigatória** para habilitar plugins NPM
3. ✅ Logs de segurança **visíveis** sobre plugins bloqueados
4. ✅ Opt-in **explícito** necessário

## 📖 Como Usar Plugins NPM com Segurança

### ⚡ Método Rápido (CLI Automatizado)

**Recomendado**: Use o comando `plugin:add` que faz tudo automaticamente:

```bash
# Instalar e whitelist plugin em um comando
bun run fluxstack plugin:add fluxstack-plugin-auth

# O comando irá:
# 1. ✅ Validar nome do plugin
# 2. 🔍 Auditar segurança (npm audit)
# 3. 📦 Instalar plugin
# 4. 🔧 Habilitar NPM discovery (PLUGINS_DISCOVER_NPM=true)
# 5. 🛡️ Adicionar à whitelist (PLUGINS_ALLOWED)
# 6. ✅ Confirmar sucesso

# Pular confirmação (CI/CD)
bun run fluxstack plugin:add fluxstack-plugin-auth --skip-confirmation

# Pular audit (não recomendado)
bun run fluxstack plugin:add fluxstack-plugin-auth --skip-audit
```

### 🔧 Gerenciar Plugins via CLI

```bash
# Listar todos os plugins
bun run fluxstack plugin:list

# Listar apenas instalados
bun run fluxstack plugin:list --installed

# Listar apenas whitelistados
bun run fluxstack plugin:list --whitelisted

# Output JSON
bun run fluxstack plugin:list --json

# Remover plugin
bun run fluxstack plugin:remove fluxstack-plugin-auth

# Remover da whitelist mas manter instalado
bun run fluxstack plugin:remove fluxstack-plugin-auth --keep-installed
```

### 📋 Método Manual (Passo a Passo)

Se preferir fazer manualmente:

#### Passo 1: Avaliar o Plugin

Antes de adicionar qualquer plugin NPM, **SEMPRE**:

```bash
# 1. Verificar repositório oficial
npm view fluxstack-plugin-auth repository

# 2. Auditar dependências
npm view fluxstack-plugin-auth dependencies

# 3. Verificar issues de segurança
npm audit fluxstack-plugin-auth

# 4. Ler código fonte (GitHub)
# - Verificar commits recentes
# - Verificar maintainers
# - Ler código do plugin.ts
```

#### Passo 2: Habilitar Plugin Específico

```bash
# .env

# Habilitar discovery de NPM plugins
PLUGINS_DISCOVER_NPM=true

# Adicionar plugin à whitelist (OBRIGATÓRIO)
PLUGINS_ALLOWED=fluxstack-plugin-auth,@acme/fplugin-payments
```

#### Passo 3: Instalar Plugin

```bash
# Instalar apenas plugins auditados
bun add fluxstack-plugin-auth
```

#### Passo 4: Verificar Logs de Segurança

```bash
# Iniciar servidor e verificar logs
bun run dev

# ✅ Logs esperados:
# [INFO] Loading whitelisted npm plugin: fluxstack-plugin-auth

# ❌ Se plugin não estiver na whitelist:
# [WARN] NPM plugin 'malicious-plugin' blocked: Not in whitelist
# [INFO] 🔒 Security: Blocked 1 npm plugin(s) not in whitelist
```

## 🚫 O Que NÃO Fazer

### ❌ NUNCA Desabilitar Segurança Globalmente

```bash
# ❌ PERIGO: Isso permite TODOS os plugins NPM sem validação
PLUGINS_DISCOVER_NPM=true
PLUGINS_ALLOWED=  # Whitelist vazia = TODOS bloqueados (seguro)
```

### ❌ NUNCA Adicionar Plugins Sem Auditar

```bash
# ❌ PERIGO: Plugin não auditado
PLUGINS_ALLOWED=random-npm-plugin-i-found

# ✅ CORRETO: Apenas após auditoria completa
# 1. Ler código fonte
# 2. Verificar maintainers
# 3. npm audit
# 4. Testar em ambiente isolado
```

### ❌ NUNCA Confiar Cegamente em Packages Populares

```bash
# ❌ "Este package tem 10k downloads, deve ser seguro"
# ⚠️ Packages populares TAMBÉM podem ser comprometidos
# ✅ Sempre auditar, independente da popularidade
```

## ✅ Boas Práticas

### 1. Princípio do Menor Privilégio

```bash
# Habilitar APENAS os plugins que você realmente precisa
PLUGINS_ALLOWED=fluxstack-plugin-auth  # Apenas este

# NÃO adicionar "just in case"
PLUGINS_ALLOWED=plugin1,plugin2,plugin3,plugin4  # ❌ Muito amplo
```

### 2. Manter Whitelist Atualizada

```bash
# Remover plugins que não usa mais
# ANTES:
PLUGINS_ALLOWED=plugin-old,plugin-auth,plugin-unused

# DEPOIS:
PLUGINS_ALLOWED=plugin-auth  # Apenas o que está em uso
```

### 3. Logs de Segurança

```bash
# Sempre usar LOG_LEVEL=debug em produção inicial
LOG_LEVEL=debug bun run dev

# Monitorar logs de segurança
# [WARN] NPM plugin 'X' blocked: Not in whitelist
```

### 4. Versionamento de Plugins

```json
// package.json
{
  "dependencies": {
    // ✅ Versão exata para plugins críticos
    "fluxstack-plugin-auth": "1.2.3",

    // ❌ NUNCA usar ranges em plugins
    "fluxstack-plugin-payments": "^1.0.0"  // ❌ Perigoso
  }
}
```

## 🛡️ Defesa em Profundidade

### Camada 1: Discovery Control
- NPM plugins discovery **disabled by default**
- Project plugins discovery **enabled** (código confiável)

### Camada 2: Whitelist Enforcement
- Plugin não na whitelist = **bloqueado**
- Logs claros sobre plugins **rejeitados**

### Camada 3: Explicit Opt-in
- Developer must **explicitly enable** npm plugins
- Developer must **explicitly whitelist** each plugin

### Camada 4: Security Logging
- **Visible warnings** for blocked plugins
- **Audit trail** of plugin loading

## 📊 Exemplos de Configuração

### Desenvolvimento (Padrão Seguro)

```bash
# .env.development
PLUGINS_DISCOVER_NPM=false      # ❌ Sem plugins NPM
PLUGINS_DISCOVER_PROJECT=true   # ✅ Apenas projeto
PLUGINS_ALLOWED=                # Whitelist vazia
```

### Produção (Com Plugin Auditado)

```bash
# .env.production
PLUGINS_DISCOVER_NPM=true       # ✅ Com NPM (controlado)
PLUGINS_DISCOVER_PROJECT=true   # ✅ Projeto
PLUGINS_ALLOWED=fluxstack-plugin-auth  # ✅ Apenas auditado
```

### CI/CD (Teste de Segurança)

```bash
# .env.ci
PLUGINS_DISCOVER_NPM=true       # ✅ Testar discovery
PLUGINS_DISCOVER_PROJECT=true   # ✅ Projeto
PLUGINS_ALLOWED=malicious-test  # ✅ Testar blocking
LOG_LEVEL=debug                 # ✅ Ver logs de segurança
```

## 🔍 Troubleshooting

### Plugin NPM Não Carrega

**Sintoma**:
```
[WARN] NPM plugin 'my-plugin' blocked: Not in whitelist
```

**Solução**:
```bash
# 1. Verificar se discovery está habilitado
PLUGINS_DISCOVER_NPM=true

# 2. Adicionar plugin à whitelist
PLUGINS_ALLOWED=my-plugin

# 3. Reiniciar servidor
bun run dev
```

### Nenhum Plugin NPM Aparece

**Sintoma**:
```
[INFO] 🔒 NPM plugin discovery disabled for security
```

**Solução**:
```bash
# Habilitar discovery
PLUGINS_DISCOVER_NPM=true

# Configurar whitelist
PLUGINS_ALLOWED=fluxstack-plugin-auth
```

### Plugin de Projeto Não Carrega

**Sintoma**:
```
[DEBUG] Project plugin discovery is disabled
```

**Solução**:
```bash
# Habilitar project plugins
PLUGINS_DISCOVER_PROJECT=true
```

## 📚 Recursos Adicionais

- [OWASP Top 10 - Supply Chain](https://owasp.org/www-project-top-ten/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [FluxStack Plugin Development Guide](./plugin-development.md)

---

**🎯 Resumo**: FluxStack usa **whitelist + opt-in** para proteger contra plugins maliciosos. NPM plugins são **bloqueados por padrão** e requerem **aprovação explícita**. Sempre **audite plugins** antes de adicionar à whitelist.
