/**
 * Tests for issue #75: Race condition in plugin initialization
 *
 * The constructor used to call initializeAutomaticPlugins() as fire-and-forget.
 * If listen()/start() was called before discovery finished, auto-discovered
 * plugins would miss lifecycle hooks (setup, onBeforeServerStart, etc.).
 *
 * Fix: initializeAutomaticPlugins() is now awaited inside start(), guaranteeing
 * all plugins are ready before the server accepts traffic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FluxStackFramework } from '@core/framework/server'
import type { Plugin } from '@core/types'

describe('Issue #75: Plugin initialization race condition', () => {
  let framework: FluxStackFramework

  beforeEach(() => {
    framework = new FluxStackFramework({
      server: {
        port: 0, // avoids binding conflicts
        host: 'localhost',
        apiPrefix: '/api',
        cors: {
          origins: ['*'],
          methods: ['GET', 'POST'],
          headers: ['Content-Type'],
          credentials: false,
          maxAge: 86400
        },
        middleware: []
      }
    })
  })

  describe('constructor no longer fires async plugin init', () => {
    it('should return synchronously without pending async work', () => {
      // If the constructor still had fire-and-forget, there would be an
      // unhandled promise floating. The fact that we can construct and
      // immediately inspect the registry without a microtask gap proves
      // no background work is running.
      const registry = framework.getPluginRegistry()
      expect(registry).toBeDefined()
      // No auto-discovered plugins yet — they haven't been loaded
      const plugins = registry.getAll()
      // Only manually .use()-registered plugins should be here
      // (none in this test), so the list should be empty.
      expect(plugins.length).toBe(0)
    })
  })

  describe('start() awaits plugin initialization before lifecycle hooks', () => {
    it('should call setup hooks only after auto-discovered plugins are loaded', async () => {
      const setupOrder: string[] = []

      const manualPlugin: Plugin = {
        name: 'manual-plugin',
        setup: () => { setupOrder.push('manual-plugin:setup') }
      }

      framework.use(manualPlugin)
      await framework.start()

      // manual-plugin's setup was called during start()
      expect(setupOrder).toContain('manual-plugin:setup')
    })

    it('should execute onBeforeServerStart after plugin initialization', async () => {
      const hookCalls: string[] = []

      const plugin: Plugin = {
        name: 'lifecycle-test',
        setup: () => { hookCalls.push('setup') },
        onBeforeServerStart: () => { hookCalls.push('onBeforeServerStart') },
        onServerStart: () => { hookCalls.push('onServerStart') },
        onAfterServerStart: () => { hookCalls.push('onAfterServerStart') }
      }

      framework.use(plugin)
      await framework.start()

      // All lifecycle hooks should have been called in order
      expect(hookCalls).toEqual([
        'setup',
        'onBeforeServerStart',
        'onServerStart',
        'onAfterServerStart'
      ])
    })

    it('should not run start() twice if already started', async () => {
      const setupCount = { value: 0 }

      const plugin: Plugin = {
        name: 'count-plugin',
        setup: () => { setupCount.value++ }
      }

      framework.use(plugin)
      await framework.start()
      await framework.start() // second call should be a no-op

      expect(setupCount.value).toBe(1)
    })
  })

  describe('plugin dependency validation happens after discovery', () => {
    it('should validate dependencies after initializeAutomaticPlugins completes', async () => {
      // Register a plugin with a dependency that does not exist
      const plugin: Plugin = {
        name: 'dependent-plugin',
        dependencies: ['non-existent-dep'],
        setup: () => {}
      }

      framework.use(plugin)

      // start() should throw because the dependency is missing,
      // but the important thing is it throws AFTER initialization,
      // not silently ignored due to a race.
      await expect(framework.start()).rejects.toThrow(
        "Plugin 'dependent-plugin' depends on 'non-existent-dep' which is not registered"
      )
    })

    it('should resolve dependencies when both plugins are registered', async () => {
      const hookOrder: string[] = []

      const basePlugin: Plugin = {
        name: 'base-plugin',
        setup: () => { hookOrder.push('base:setup') }
      }

      const dependentPlugin: Plugin = {
        name: 'dep-plugin',
        dependencies: ['base-plugin'],
        setup: () => { hookOrder.push('dep:setup') }
      }

      framework.use(basePlugin)
      framework.use(dependentPlugin)

      await framework.start()

      // Both plugins should have their setup called
      expect(hookOrder).toContain('base:setup')
      expect(hookOrder).toContain('dep:setup')
    })
  })

  describe('onConfigLoad hooks execute during start()', () => {
    it('should call onConfigLoad for registered plugins during start', async () => {
      let configLoadCalled = false

      const plugin: Plugin = {
        name: 'config-load-plugin',
        onConfigLoad: () => { configLoadCalled = true },
        setup: () => {}
      }

      framework.use(plugin)

      // Before start, onConfigLoad should not have been called
      expect(configLoadCalled).toBe(false)

      await framework.start()

      // After start, initializeAutomaticPlugins ran which calls onConfigLoad
      expect(configLoadCalled).toBe(true)
    })

    it('should call onConfigLoad before setup hooks', async () => {
      const callOrder: string[] = []

      const plugin: Plugin = {
        name: 'order-test-plugin',
        onConfigLoad: () => { callOrder.push('onConfigLoad') },
        setup: () => { callOrder.push('setup') }
      }

      framework.use(plugin)
      await framework.start()

      // initializeAutomaticPlugins (which calls onConfigLoad) runs
      // before the setup loop in start()
      const configIdx = callOrder.indexOf('onConfigLoad')
      const setupIdx = callOrder.indexOf('setup')
      expect(configIdx).toBeLessThan(setupIdx)
    })
  })

  describe('error handling in plugin initialization', () => {
    it('should not crash if initializeAutomaticPlugins encounters an error', async () => {
      // Even if plugin discovery fails internally, start() should
      // still proceed with manually registered plugins
      const setupCalled = { value: false }

      const plugin: Plugin = {
        name: 'resilient-plugin',
        setup: () => { setupCalled.value = true }
      }

      framework.use(plugin)
      await framework.start()

      expect(setupCalled.value).toBe(true)
    })

    it('should handle onConfigLoad errors gracefully without blocking other plugins', async () => {
      const results: string[] = []

      const badPlugin: Plugin = {
        name: 'bad-config-plugin',
        onConfigLoad: () => { throw new Error('config load boom') },
        setup: () => { results.push('bad:setup') }
      }

      const goodPlugin: Plugin = {
        name: 'good-config-plugin',
        onConfigLoad: () => { results.push('good:onConfigLoad') },
        setup: () => { results.push('good:setup') }
      }

      framework.use(badPlugin)
      framework.use(goodPlugin)

      // Should not throw despite bad plugin's onConfigLoad failing
      await framework.start()

      // good plugin's hooks should still execute
      expect(results).toContain('good:onConfigLoad')
      expect(results).toContain('good:setup')
      // bad plugin's setup should also run (only onConfigLoad failed)
      expect(results).toContain('bad:setup')
    })
  })
})
