/**
 * Plugin de Exemplo com Dependências
 * Demonstra como usar dependências externas em plugins
 */

import type { Plugin, PluginContext, RequestContext, ResponseContext } from "@core/plugins/types"
import axios from 'axios'
import { debounce } from 'lodash'
import { format } from 'date-fns'

export const examplePlugin: Plugin = {
  name: "example-plugin",
  version: "1.0.0",
  description: "Plugin de exemplo que demonstra uso de dependências externas",
  author: "FluxStack Team",
  priority: "normal",
  category: "utility",
  tags: ["http", "utility", "example"],
  dependencies: [], // Dependências de outros plugins (se houver)
  
  configSchema: {
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
        description: "Habilitar plugin de exemplo"
      },
      apiUrl: {
        type: "string",
        description: "URL da API externa para integração"
      },
      debounceMs: {
        type: "number",
        minimum: 100,
        description: "Tempo de debounce em millisegundos"
      },
      logRequests: {
        type: "boolean",
        description: "Logar requisições processadas"
      }
    },
    additionalProperties: false
  },
  
  defaultConfig: {
    enabled: true,
    apiUrl: "https://api.example.com",
    debounceMs: 1000,
    logRequests: true
  },

  setup: async (context: PluginContext) => {
    const config = getPluginConfig(context)
    
    if (!config.enabled) {
      context.logger.info('Plugin de exemplo desabilitado por configuração')
      return
    }

    // Configurar axios com base URL
    const apiClient = axios.create({
      baseURL: config.apiUrl,
      timeout: 5000,
      headers: {
        'User-Agent': 'FluxStack-Example-Plugin/1.0.0'
      }
    })

    // Armazenar cliente no contexto para uso posterior
    ;(context as any).apiClient = apiClient

    // Criar função debounced para logging
    const debouncedLog = debounce((message: string, data: any) => {
      context.logger.info(message, data)
    }, config.debounceMs)

    ;(context as any).debouncedLog = debouncedLog

    context.logger.info("Plugin de exemplo inicializado com sucesso", {
      apiUrl: config.apiUrl,
      debounceMs: config.debounceMs,
      logRequests: config.logRequests
    })

    // Testar conectividade com API externa (opcional)
    try {
      await apiClient.get('/health', { timeout: 2000 })
      context.logger.info("Conectividade com API externa verificada")
    } catch (error) {
      context.logger.warn("Não foi possível conectar com API externa", {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  },

  onRequest: async (context: RequestContext) => {
    const pluginContext = (context as any).pluginContext
    const config = getPluginConfig(pluginContext)
    
    if (!config.enabled || !config.logRequests) return

    // Usar date-fns para formatação de data
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    
    // Usar lodash debounce para evitar spam de logs
    const debouncedLog = pluginContext?.debouncedLog
    if (debouncedLog) {
      debouncedLog("Requisição processada", {
        timestamp,
        method: context.method,
        path: context.path,
        userAgent: context.headers['user-agent']
      })
    }

    // Adicionar timestamp customizado ao contexto
    ;(context as any).exampleTimestamp = timestamp
  },

  onResponse: async (context: ResponseContext) => {
    const pluginContext = (context as any).pluginContext
    const config = getPluginConfig(pluginContext)
    
    if (!config.enabled) return

    // Exemplo de integração com API externa
    if (context.statusCode >= 500) {
      const apiClient = pluginContext?.apiClient
      if (apiClient) {
        try {
          // Enviar erro para API externa (exemplo)
          await apiClient.post('/errors', {
            timestamp: (context as any).exampleTimestamp,
            method: context.method,
            path: context.path,
            statusCode: context.statusCode,
            duration: context.duration,
            error: "Server error occurred"
          })
        } catch (error) {
          pluginContext?.logger?.warn("Erro ao enviar dados para API externa", { error })
        }
      }
    }

    // Usar lodash para processar dados de resposta
    const responseData = {
      method: context.method,
      path: context.path,
      statusCode: context.statusCode,
      duration: context.duration,
      timestamp: (context as any).exampleTimestamp
    }

    // Exemplo de uso do lodash
    const processedData = {
      ...responseData,
      pathSegments: context.path.split('/').filter(Boolean),
      isSuccess: context.statusCode < 400,
      isError: context.statusCode >= 400,
      responseTime: `${context.duration}ms`
    }

    pluginContext?.logger?.debug("Resposta processada", processedData)
  }
}

// Helper function para obter configuração do plugin
function getPluginConfig(context: any) {
  const pluginConfig = context?.config?.plugins?.config?.['example-plugin'] || {}
  return { ...examplePlugin.defaultConfig, ...pluginConfig }
}

export default examplePlugin