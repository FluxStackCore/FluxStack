import { describe, it, expect, beforeEach } from 'vitest'
import { FluxStackFramework } from '@core/framework/server'
import type { Plugin } from '@core/plugins'
import type { PluginContext } from '@core/plugins/types'

function createFramework() {
  return new FluxStackFramework({
    server: {
      port: 0,
      host: 'localhost',
      apiPrefix: '/api',
      cors: { origins: ['*'], methods: ['GET', 'POST'], headers: ['Content-Type'], credentials: false, maxAge: 86400 },
      middleware: [],
      enableRequestLogging: false,
    },
  })
}

describe('Plugin Lifecycle - Integration', () => {
  let framework: ReturnType<typeof createFramework>

  beforeEach(() => {
    framework = createFramework()
  })

  it('plugin lifecycle hooks execute in correct order', async () => {
    const hookCalls: string[] = []

    const plugin: Plugin = {
      name: 'lifecycle-order',
      setup: () => { hookCalls.push('setup') },
      onBeforeServerStart: () => { hookCalls.push('onBeforeServerStart') },
      onServerStart: () => { hookCalls.push('onServerStart') },
      onAfterServerStart: () => { hookCalls.push('onAfterServerStart') },
    }

    framework.use(plugin)
    await framework.start()

    expect(hookCalls).toEqual([
      'setup',
      'onBeforeServerStart',
      'onServerStart',
      'onAfterServerStart',
    ])
  })

  it('plugin dependencies resolve correctly across start()', async () => {
    const setupOrder: string[] = []

    const pluginBase: Plugin = {
      name: 'base-plugin',
      setup: () => { setupOrder.push('base') },
    }

    const pluginDependent: Plugin = {
      name: 'dependent-plugin',
      dependencies: ['base-plugin'],
      setup: () => { setupOrder.push('dependent') },
    }

    // Register dependent first — framework should still resolve base before dependent
    framework.use(pluginDependent)
    framework.use(pluginBase)
    await framework.start()

    expect(setupOrder.indexOf('base')).toBeLessThan(setupOrder.indexOf('dependent'))
  })

  it('plugin with Elysia routes gets mounted', async () => {
    const { Elysia } = await import('elysia')

    const pluginRoutes = new Elysia().get('/api/plugin-route', () => ({
      source: 'plugin',
    }))

    const plugin: Plugin & { plugin: InstanceType<typeof Elysia> } = {
      name: 'route-plugin',
      plugin: pluginRoutes,
      setup: () => {},
    }

    framework.use(plugin)
    await framework.start()

    const app = framework.getApp()
    const response = await app.handle(
      new Request('http://localhost/api/plugin-route')
    )
    expect(response.status).toBe(200)

    const data = await response.json() as { source: string }
    expect(data.source).toBe('plugin')
  })

  it('plugin context provides correct utilities', async () => {
    let receivedContext: PluginContext | null = null

    const plugin: Plugin = {
      name: 'context-check',
      setup: (ctx: PluginContext) => {
        receivedContext = ctx
      },
    }

    framework.use(plugin)
    await framework.start()

    expect(receivedContext).not.toBeNull()

    // Verify logger exists
    expect(receivedContext!.logger).toBeDefined()

    // Verify app exists
    expect(receivedContext!.app).toBeDefined()

    // Verify config exists
    expect(receivedContext!.config).toBeDefined()
    expect(receivedContext!.config.server).toBeDefined()

    // Verify utils object with expected methods
    expect(receivedContext!.utils).toBeDefined()
    expect(typeof receivedContext!.utils.createTimer).toBe('function')
    expect(typeof receivedContext!.utils.isProduction).toBe('function')
    expect(typeof receivedContext!.utils.isDevelopment).toBe('function')
    expect(typeof receivedContext!.utils.getEnvironment).toBe('function')
    expect(typeof receivedContext!.utils.formatBytes).toBe('function')
    expect(typeof receivedContext!.utils.createHash).toBe('function')
    expect(typeof receivedContext!.utils.deepMerge).toBe('function')
    expect(typeof receivedContext!.utils.validateSchema).toBe('function')
  })
})
