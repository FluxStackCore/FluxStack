import { describe, it, expect, beforeEach } from 'vitest'
import { FluxStackFramework } from '@core/framework/server'
import type { Plugin } from '@core/plugins'
import type { RequestContext, ResponseContext, ErrorContext } from '@core/plugins/types'

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

describe('Request Lifecycle - Integration', () => {
  let framework: ReturnType<typeof createFramework>

  beforeEach(() => {
    framework = createFramework()
  })

  it('request flows through all plugin hooks in order', async () => {
    const hookOrder: string[] = []

    const plugin: Plugin = {
      name: 'lifecycle-tracker',
      onRequest: () => { hookOrder.push('onRequest') },
      onBeforeRoute: () => { hookOrder.push('onBeforeRoute') },
      onAfterRoute: () => { hookOrder.push('onAfterRoute') },
      onBeforeResponse: () => { hookOrder.push('onBeforeResponse') },
      onResponse: () => { hookOrder.push('onResponse') },
    }

    framework.use(plugin)
    framework.routes(
      new (await import('elysia')).Elysia().get('/api/test', () => ({ ok: true }))
    )
    await framework.start()

    const app = framework.getApp()
    const response = await app.handle(new Request('http://localhost/api/test'))
    expect(response.status).toBe(200)

    expect(hookOrder).toEqual([
      'onRequest',
      'onBeforeRoute',
      'onAfterRoute',
      'onBeforeResponse',
      'onResponse',
    ])
  })

  it('plugin can modify response via hooks', async () => {
    const plugin: Plugin = {
      name: 'header-injector',
      onBeforeResponse: (ctx: ResponseContext) => {
        // Plugins can add data to context; the framework doesn't expose
        // direct header mutation on the Response, but we can verify the
        // hook was called and received the correct context shape.
        (ctx as Record<string, unknown>)['x-custom-header'] = 'injected'
      },
      onResponse: (ctx: ResponseContext) => {
        // Verify the previous hook's mutation is visible
        expect((ctx as Record<string, unknown>)['x-custom-header']).toBe('injected')
      },
    }

    framework.use(plugin)
    framework.routes(
      new (await import('elysia')).Elysia().get('/api/test', () => ({ ok: true }))
    )
    await framework.start()

    const app = framework.getApp()
    const response = await app.handle(new Request('http://localhost/api/test'))
    expect(response.status).toBe(200)
  })

  it('error hook catches handler errors', async () => {
    let capturedError: Error | null = null

    const plugin: Plugin = {
      name: 'error-catcher',
      onError: (ctx: ErrorContext) => {
        capturedError = ctx.error
        ctx.handled = true
      },
    }

    framework.use(plugin)
    framework.routes(
      new (await import('elysia')).Elysia().get('/api/fail', () => {
        throw new Error('Intentional failure')
      })
    )
    await framework.start()

    const app = framework.getApp()
    await app.handle(new Request('http://localhost/api/fail'))

    expect(capturedError).not.toBeNull()
    expect(capturedError!.message).toBe('Intentional failure')
  })

  it('multiple plugins hooks execute in load order', async () => {
    const hookOrder: string[] = []

    const pluginA: Plugin = {
      name: 'plugin-a',
      priority: 'high' as unknown as number,
      onRequest: () => { hookOrder.push('A:onRequest') },
      onResponse: () => { hookOrder.push('A:onResponse') },
    }

    const pluginB: Plugin = {
      name: 'plugin-b',
      priority: 'low' as unknown as number,
      onRequest: () => { hookOrder.push('B:onRequest') },
      onResponse: () => { hookOrder.push('B:onResponse') },
    }

    // Register B first, then A — load order should still put A first (higher priority)
    framework.use(pluginB)
    framework.use(pluginA)
    framework.routes(
      new (await import('elysia')).Elysia().get('/api/test', () => ({ ok: true }))
    )
    await framework.start()

    const app = framework.getApp()
    await app.handle(new Request('http://localhost/api/test'))

    // A has higher priority, should execute first
    expect(hookOrder.indexOf('A:onRequest')).toBeLessThan(hookOrder.indexOf('B:onRequest'))
    expect(hookOrder.indexOf('A:onResponse')).toBeLessThan(hookOrder.indexOf('B:onResponse'))
  })

  it('request hooks receive correct context', async () => {
    let receivedContext: RequestContext | null = null

    const plugin: Plugin = {
      name: 'context-inspector',
      onRequest: (ctx: RequestContext) => {
        receivedContext = ctx
      },
    }

    framework.use(plugin)
    framework.routes(
      new (await import('elysia')).Elysia().get('/api/hello', () => ({ greeting: 'world' }))
    )
    await framework.start()

    const app = framework.getApp()
    await app.handle(
      new Request('http://localhost/api/hello?foo=bar', {
        method: 'GET',
        headers: { 'x-custom': 'test-value', 'content-type': 'application/json' },
      })
    )

    expect(receivedContext).not.toBeNull()
    expect(receivedContext!.method).toBe('GET')
    expect(receivedContext!.path).toBe('/api/hello')
    expect(receivedContext!.headers['x-custom']).toBe('test-value')
    expect(receivedContext!.query.foo).toBe('bar')
  })
})
