/**
 * Plugins Configuration
 * Declarative plugin management configuration
 */

import { defineConfig, config } from '@fluxstack/config'
import { FLUXSTACK_VERSION } from '@core/utils/version'

const defaultPluginConfigs = {
  swagger: {
    title: 'FluxStack API',
    version: FLUXSTACK_VERSION,
    description: 'API documentation for FluxStack application',
    path: '/swagger'
  },
  staticFiles: {
    publicDir: 'public',
    uploadsDir: 'uploads'
  }
}

export const pluginsConfig = defineConfig({
  enabled: config.array(
    'FLUXSTACK_PLUGINS_ENABLED',
    ['logger', 'swagger', 'vite', 'cors', 'static-files']
  ),

  disabled: config.array('FLUXSTACK_PLUGINS_DISABLED', []),

  autoDiscover: config.boolean('PLUGINS_AUTO_DISCOVER', true),

  pluginsDir: config.string('PLUGINS_DIR', 'plugins'),

  discoverNpmPlugins: config.boolean('PLUGINS_DISCOVER_NPM', false),
  discoverProjectPlugins: config.boolean('PLUGINS_DISCOVER_PROJECT', true),

  allowedPlugins: config.array('PLUGINS_ALLOWED', []),

  // Enforça a whitelist de plugins npm no registro (.use()), não só na descoberta.
  // Secure-by-default: um plugin npm (escopo @.../ ou fluxstack-plugin-*) precisa
  // estar em PLUGINS_ALLOWED. false = confia em todo plugin .use()-d (monorepo interno).
  enforceNpmWhitelist: config.boolean('PLUGINS_ENFORCE_NPM_WHITELIST', true),
  config: {
    type: 'object' as const,
    default: defaultPluginConfigs
  },

  loggerEnabled: config.boolean('LOGGER_PLUGIN_ENABLED', true),

  swaggerEnabled: config.boolean('SWAGGER_ENABLED', true),
  swaggerTitle: config.string('SWAGGER_TITLE', 'FluxStack API'),
  swaggerVersion: config.string('SWAGGER_VERSION', FLUXSTACK_VERSION),
  swaggerDescription: config.string(
    'SWAGGER_DESCRIPTION',
    'API documentation for FluxStack application'
  ),
  swaggerPath: config.string('SWAGGER_PATH', '/swagger'),

  swaggerExcludePaths: config.array('SWAGGER_EXCLUDE_PATHS', []),

  swaggerServers: config.string('SWAGGER_SERVERS', ''),

  swaggerPersistAuthorization: config.boolean('SWAGGER_PERSIST_AUTH', true),
  swaggerDisplayRequestDuration: config.boolean('SWAGGER_DISPLAY_DURATION', true),
  swaggerEnableFilter: config.boolean('SWAGGER_ENABLE_FILTER', true),
  swaggerShowExtensions: config.boolean('SWAGGER_SHOW_EXTENSIONS', true),
  swaggerTryItOutEnabled: config.boolean('SWAGGER_TRY_IT_OUT', true),

  swaggerAuthEnabled: config.boolean('SWAGGER_AUTH_ENABLED', false),
  swaggerAuthUsername: config.string('SWAGGER_AUTH_USERNAME', 'admin'),
  swaggerAuthPassword: config.string('SWAGGER_AUTH_PASSWORD', ''),

  staticFilesEnabled: config.boolean('STATIC_FILES_ENABLED', true),
  staticPublicDir: config.string('STATIC_PUBLIC_DIR', 'public'),
  staticUploadsDir: config.string('STATIC_UPLOADS_DIR', 'uploads'),
  staticCacheMaxAge: config.number('STATIC_CACHE_MAX_AGE', 31536000),
  staticEnableUploads: config.boolean('STATIC_ENABLE_UPLOADS', true),
  staticEnablePublic: config.boolean('STATIC_ENABLE_PUBLIC', true),

  viteEnabled: config.boolean('VITE_PLUGIN_ENABLED', true),
  viteExcludePaths: config.array('VITE_EXCLUDE_PATHS', [
    '/api',
    '/swagger',
    '/ssr-demo',
    '/ssr'
  ]),

  // SSR (server-side rendering das rotas de página). Off por padrão: ligar
  // troca o SPA vazio do `/` por HTML pré-renderizado + hydration.
  // RSC (React Server Components) — modo de renderização PADRÃO do FluxStack.
  // Server components (0 JS) + client islands (Live Components) servidos pelo
  // proxy interno. Para usar SPA puro, defina RSC_ENABLED=false no .env.
  // Requer o rsc() no vite.config (também lê RSC_ENABLED). Ver core/plugins/built-in/rsc.
  rscEnabled: config.boolean('RSC_ENABLED', true),

  // Cache de página do SSR/RSC — evita re-renderizar a mesma rota a cada request.
  // Model Next: o HTML é user-agnostic (token só no cookie) → cacheável em CDN.
  // O STORAGE é PROGRAMÁVEL pelo dev: implemente `CacheDriver` (qualquer storage
  // que quiser) e injete via setRscCacheDriver(new SeuDriver()) antes de .use().
  // Sem driver programado → usa o de cache padrão do app (memory). O framework
  // é neutro: não conhece Redis/etc. Bypass: query, sessão autenticada, e DEV.
  // Ligado por padrão em produção. Ver core/plugins/built-in/rsc + RscPageCache.
  rscCacheEnabled: config.boolean('RSC_CACHE_ENABLED', true),
  rscCacheTtl: config.number('RSC_CACHE_TTL', 60),            // segundos (server + s-maxage CDN)
  rscCacheSwr: config.number('RSC_CACHE_SWR', 60),            // stale-while-revalidate (CDN)
  rscCacheMaxEntryBytes: config.number('RSC_CACHE_MAX_ENTRY_BYTES', 1000000),
  rscCacheBrowserMaxAge: config.number('RSC_CACHE_BROWSER_MAX_AGE', 0) // 0 = browser revalida via ETag
})

export type PluginsConfig = typeof pluginsConfig

export default pluginsConfig
