/**
 * 🔧 Environment Test Route
 * Displays current configuration for debugging purposes
 */

import { Elysia, t } from 'elysia'
import { appConfig, serverConfig, loggerConfig, appRuntimeConfig } from '@/config'
import { helpers } from '@/core/utils/env'

// Response schema for environment test
const EnvTestResponseSchema = t.Object({
  message: t.String(),
  timestamp: t.String(),
  serverConfig: t.Object({
    port: t.Number(),
    host: t.String(),
    apiPrefix: t.String(),
    appName: t.String(),
    appVersion: t.String(),
    cors: t.Object({
      origins: t.Array(t.String()),
      methods: t.Array(t.String()),
      credentials: t.Boolean()
    }),
    client: t.Object({
      port: t.Number(),
      target: t.String(),
      sourceMaps: t.Boolean()
    }),
    features: t.Object({
      enableSwagger: t.Boolean(),
      enableMetrics: t.Boolean(),
      enableMonitoring: t.Boolean()
    })
  }),
  environment: t.Object({
    NODE_ENV: t.String(),
    DEBUG: t.Boolean(),
    LOG_LEVEL: t.String()
  }),
  urls: t.Object({
    server: t.String(),
    client: t.String(),
    swagger: t.String()
  }),
  system: t.Object({
    version: t.String(),
    features: t.Array(t.String())
  })
}, {
  description: 'Environment and configuration information for debugging'
})

/**
 * Environment test endpoint
 * Shows declarative config system information
 */
export const envTestRoute = new Elysia({ prefix: '/api', tags: ['Development'] })
  .get('/env-test', () => {
    return {
      message: '⚡ Declarative Config System!',
      timestamp: new Date().toISOString(),
      serverConfig: {
        port: serverConfig.server.port,
        host: serverConfig.server.host,
        apiPrefix: serverConfig.server.apiPrefix,
        appName: appConfig.name,
        appVersion: appConfig.version,
        cors: {
          origins: serverConfig.cors.origins,
          methods: serverConfig.cors.methods,
          credentials: serverConfig.cors.credentials
        },
        client: {
          port: serverConfig.server.backendPort,
          target: 'es2020',
          sourceMaps: false
        },
        features: {
          enableSwagger: appRuntimeConfig.values.enableSwagger,
          enableMetrics: appRuntimeConfig.values.enableMetrics,
          enableMonitoring: appRuntimeConfig.values.enableMonitoring
        }
      },
      environment: {
        NODE_ENV: appConfig.env,
        DEBUG: appRuntimeConfig.values.enableDebugMode,
        LOG_LEVEL: loggerConfig.level
      },
      urls: {
        server: helpers.getServerUrl(),
        client: helpers.getClientUrl(),
        swagger: `${helpers.getServerUrl()}/swagger`
      },
      system: {
        version: 'declarative-config',
        features: ['type-safe', 'validated', 'declarative', 'runtime-reload']
      }
    }
  }, {
    detail: {
      summary: 'Environment Configuration Test',
      description: 'Returns current environment configuration, server settings, and runtime features for debugging and validation',
      tags: ['Development', 'Configuration', 'Debug']
    },
    response: EnvTestResponseSchema
  })
