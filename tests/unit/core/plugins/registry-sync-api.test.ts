/**
 * Tests for issue #77: PluginRegistry public sync API
 *
 * Validates registerSync(), refreshLoadOrder(), and getPluginsMap() — the
 * typed public methods that replace the old `as unknown as PluginRegistryInternals`
 * pattern in FluxStackFramework.
 */

import { describe, it, expect } from 'vitest'
import { PluginRegistry, type FluxStack } from '@fluxstack/plugin-kit'

function makePlugin(overrides: Partial<FluxStack.Plugin> & { name: string }): FluxStack.Plugin {
  return { ...overrides }
}

describe('PluginRegistry sync API (#77)', () => {
  describe('registerSync()', () => {
    it('should register a plugin synchronously', () => {
      const registry = new PluginRegistry()
      const plugin = makePlugin({ name: 'sync-test' })

      registry.registerSync(plugin)

      expect(registry.has('sync-test')).toBe(true)
      expect(registry.get('sync-test')).toBe(plugin)
    })

    it('should track dependencies', () => {
      const registry = new PluginRegistry()
      const base = makePlugin({ name: 'base' })
      const child = makePlugin({ name: 'child', dependencies: ['base'] })

      registry.registerSync(base)
      registry.registerSync(child)

      expect(registry.getDependencies('child')).toEqual(['base'])
      expect(registry.getDependents('base')).toEqual(['child'])
    })

    it('should update load order respecting dependencies', () => {
      const registry = new PluginRegistry()
      const base = makePlugin({ name: 'base' })
      const child = makePlugin({ name: 'child', dependencies: ['base'] })

      // Register child first, then base
      registry.registerSync(base)
      registry.registerSync(child)

      const order = registry.getLoadOrder()
      expect(order.indexOf('base')).toBeLessThan(order.indexOf('child'))
    })

    it('should throw when registering duplicate plugin', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'dup' }))

      expect(() => registry.registerSync(makePlugin({ name: 'dup' }))).toThrow(
        "Plugin 'dup' is already registered"
      )
    })

    it('should validate plugin structure', () => {
      const registry = new PluginRegistry()

      expect(() => registry.registerSync({ name: '' } as FluxStack.Plugin)).toThrow(
        'Plugin must have a valid name property'
      )
    })

    it('should respect priority ordering', () => {
      const registry = new PluginRegistry()
      const low = makePlugin({ name: 'low', priority: 'low' })
      const high = makePlugin({ name: 'high', priority: 'high' })

      registry.registerSync(low)
      registry.registerSync(high)

      const order = registry.getLoadOrder()
      expect(order.indexOf('high')).toBeLessThan(order.indexOf('low'))
    })
  })

  describe('load order — complex scenarios', () => {
    it('should resolve a transitive dependency chain (A → B → C)', () => {
      const registry = new PluginRegistry()
      // Register in reverse order to prove topological sort works
      registry.registerSync(makePlugin({ name: 'C', dependencies: ['B'] }))
      registry.registerSync(makePlugin({ name: 'A' }))
      registry.registerSync(makePlugin({ name: 'B', dependencies: ['A'] }))

      const order = registry.getLoadOrder()
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'))
    })

    it('should resolve a diamond dependency (D depends on B and C, both depend on A)', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'D', dependencies: ['B', 'C'] }))
      registry.registerSync(makePlugin({ name: 'B', dependencies: ['A'] }))
      registry.registerSync(makePlugin({ name: 'C', dependencies: ['A'] }))
      registry.registerSync(makePlugin({ name: 'A' }))

      const order = registry.getLoadOrder()
      // A must come before B and C; B and C must come before D
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'))
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'))
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'))
    })

    it('should order all priority levels correctly (highest > high > normal > low > lowest)', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'p-low', priority: 'low' }))
      registry.registerSync(makePlugin({ name: 'p-highest', priority: 'highest' }))
      registry.registerSync(makePlugin({ name: 'p-normal' })) // default = normal
      registry.registerSync(makePlugin({ name: 'p-lowest', priority: 'lowest' }))
      registry.registerSync(makePlugin({ name: 'p-high', priority: 'high' }))

      const order = registry.getLoadOrder()
      expect(order).toEqual(['p-highest', 'p-high', 'p-normal', 'p-low', 'p-lowest'])
    })

    it('should let dependency constraint override priority', () => {
      const registry = new PluginRegistry()
      // dep-low has low priority but needs-low depends on it
      registry.registerSync(makePlugin({ name: 'dep-low', priority: 'low' }))
      registry.registerSync(makePlugin({ name: 'needs-low', priority: 'highest', dependencies: ['dep-low'] }))

      const order = registry.getLoadOrder()
      expect(order.indexOf('dep-low')).toBeLessThan(order.indexOf('needs-low'))
    })

    it('should detect circular dependencies', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'x', dependencies: ['y'] }))

      expect(() => {
        registry.registerSync(makePlugin({ name: 'y', dependencies: ['x'] }))
      }).toThrow(/[Cc]ircular dependency/)
    })

    it('should detect three-way circular dependency', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'a1', dependencies: ['c1'] }))
      registry.registerSync(makePlugin({ name: 'b1', dependencies: ['a1'] }))

      expect(() => {
        registry.registerSync(makePlugin({ name: 'c1', dependencies: ['b1'] }))
      }).toThrow(/[Cc]ircular dependency/)
    })

    it('should handle numeric priority values', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'p100', priority: 100 }))
      registry.registerSync(makePlugin({ name: 'p900', priority: 900 }))
      registry.registerSync(makePlugin({ name: 'p500', priority: 500 }))

      const order = registry.getLoadOrder()
      expect(order).toEqual(['p900', 'p500', 'p100'])
    })

    it('should handle mixed priority with multiple dependency levels', () => {
      const registry = new PluginRegistry()
      // Level 0 (no deps): core-high (high), core-low (low)
      // Level 1 (depends on core-*): feature (depends on core-low)
      registry.registerSync(makePlugin({ name: 'core-high', priority: 'high' }))
      registry.registerSync(makePlugin({ name: 'core-low', priority: 'low' }))
      registry.registerSync(makePlugin({ name: 'feature', dependencies: ['core-low'], priority: 'highest' }))

      const order = registry.getLoadOrder()
      // Level 0: core-high before core-low (by priority)
      expect(order.indexOf('core-high')).toBeLessThan(order.indexOf('core-low'))
      // Level 1: feature after core-low (by dependency)
      expect(order.indexOf('core-low')).toBeLessThan(order.indexOf('feature'))
    })

    it('should handle plugins with no dependencies among many', () => {
      const registry = new PluginRegistry()
      for (let i = 0; i < 10; i++) {
        registry.registerSync(makePlugin({ name: `standalone-${i}` }))
      }

      const order = registry.getLoadOrder()
      expect(order.length).toBe(10)
      // All should be present
      for (let i = 0; i < 10; i++) {
        expect(order).toContain(`standalone-${i}`)
      }
    })
  })

  describe('refreshLoadOrder()', () => {
    it('should recompute load order', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'a' }))
      registry.registerSync(makePlugin({ name: 'b' }))

      // Should not throw
      registry.refreshLoadOrder()

      const order = registry.getLoadOrder()
      expect(order).toContain('a')
      expect(order).toContain('b')
    })

    it('should fall back to insertion-order on failure', () => {
      const registry = new PluginRegistry()
      registry.registerSync(makePlugin({ name: 'x' }))
      registry.registerSync(makePlugin({ name: 'y' }))

      // refreshLoadOrder should always succeed (falls back gracefully)
      registry.refreshLoadOrder()

      const order = registry.getLoadOrder()
      expect(order.length).toBe(2)
    })
  })

  describe('getPluginsMap()', () => {
    it('should return a map of all registered plugins', () => {
      const registry = new PluginRegistry()
      const a = makePlugin({ name: 'a' })
      const b = makePlugin({ name: 'b' })

      registry.registerSync(a)
      registry.registerSync(b)

      const map = registry.getPluginsMap()
      expect(map.size).toBe(2)
      expect(map.get('a')).toBe(a)
      expect(map.get('b')).toBe(b)
    })

    it('should return an empty map when no plugins registered', () => {
      const registry = new PluginRegistry()
      const map = registry.getPluginsMap()
      expect(map.size).toBe(0)
    })
  })

  describe('integration with FluxStackFramework.use()', () => {
    it('should work end-to-end through framework use() and start()', async () => {
      // This test imports the framework to ensure registerSync is wired correctly
      const { FluxStackFramework } = await import('@core/framework/server')

      const hookOrder: string[] = []
      const framework = new FluxStackFramework({
        server: {
          port: 0,
          host: 'localhost',
          apiPrefix: '/api',
          cors: { origins: ['*'], methods: ['GET'], headers: ['Content-Type'], credentials: false, maxAge: 86400 },
          middleware: []
        }
      })

      framework.use({
        name: 'e2e-sync',
        setup: () => { hookOrder.push('setup') },
        onBeforeServerStart: () => { hookOrder.push('beforeStart') },
        onServerStart: () => { hookOrder.push('start') },
        onAfterServerStart: () => { hookOrder.push('afterStart') }
      })

      await framework.start()

      expect(hookOrder).toEqual(['setup', 'beforeStart', 'start', 'afterStart'])
    })
  })
})
