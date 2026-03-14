/**
 * Tests for Plugin Registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PluginRegistry } from '../registry'
import type { Plugin, PluginManifest } from '../types'
import type { Logger } from '@core/utils/logger/index'

// Mock fs module with proper default export
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
    readdirSync: vi.fn(() => [])
  },
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  readdirSync: vi.fn(() => [])
}))

vi.mock('fs/promises', () => ({
  default: {},
  readdir: vi.fn(() => Promise.resolve([])),
  readFile: vi.fn(() => Promise.resolve('{}'))
}))

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
  time: vi.fn(),
  timeEnd: vi.fn(),
  request: vi.fn()
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = new PluginRegistry({ logger: mockLogger })
    vi.clearAllMocks()
  })

  describe('Plugin Registration', () => {
    it('should register a plugin successfully', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0'
      }

      await registry.register(plugin)
      expect(registry.get('test-plugin')).toBe(plugin)
      expect(registry.has('test-plugin')).toBe(true)
    })

    it('should register a plugin with manifest', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0'
      }

      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        author: 'Test Author',
        license: 'MIT',
        keywords: ['test'],
        dependencies: {},
        fluxstack: {
          version: '1.0.0',
          hooks: ['setup']
        }
      }

      await registry.register(plugin, manifest)
      expect(registry.getManifest('test-plugin')).toBe(manifest)
    })

    it('should throw error when registering duplicate plugin', async () => {
      const plugin: Plugin = {
        name: 'duplicate-plugin'
      }

      await registry.register(plugin)
      await expect(registry.register(plugin)).rejects.toThrow("Plugin 'duplicate-plugin' is already registered")
    })

    it('should validate plugin structure', async () => {
      const invalidPlugin = {
        // Missing name property
        version: '1.0.0'
      } as Plugin

      await expect(registry.register(invalidPlugin)).rejects.toThrow('Plugin must have a valid name property')
    })

    it('should unregister a plugin successfully', async () => {
      const plugin: Plugin = {
        name: 'removable-plugin'
      }

      await registry.register(plugin)
      expect(registry.get('removable-plugin')).toBe(plugin)

      registry.unregister('removable-plugin')
      expect(registry.get('removable-plugin')).toBeUndefined()
      expect(registry.has('removable-plugin')).toBe(false)
    })

    it('should throw error when unregistering non-existent plugin', () => {
      expect(() => registry.unregister('non-existent')).toThrow("Plugin 'non-existent' is not registered")
    })

    it('should prevent unregistering plugin with dependents', async () => {
      const pluginA: Plugin = { name: 'plugin-a' }
      const pluginB: Plugin = { name: 'plugin-b', dependencies: ['plugin-a'] }

      await registry.register(pluginA)
      await registry.register(pluginB)

      expect(() => registry.unregister('plugin-a')).toThrow(
        "Cannot unregister plugin 'plugin-a' because it is required by: plugin-b"
      )
    })
  })

  describe('Plugin Retrieval', () => {
    it('should get all registered plugins', async () => {
      const plugin1: Plugin = { name: 'plugin-1' }
      const plugin2: Plugin = { name: 'plugin-2' }

      await registry.register(plugin1)
      await registry.register(plugin2)

      const allPlugins = registry.getAll()
      expect(allPlugins).toHaveLength(2)
      expect(allPlugins).toContain(plugin1)
      expect(allPlugins).toContain(plugin2)
    })

    it('should return undefined for non-existent plugin', () => {
      expect(registry.get('non-existent')).toBeUndefined()
    })

    it('should get plugin dependencies', async () => {
      const plugin: Plugin = {
        name: 'plugin-with-deps',
        dependencies: ['dep1', 'dep2']
      }

      await registry.register(plugin)
      expect(registry.getDependencies('plugin-with-deps')).toEqual(['dep1', 'dep2'])
    })

    it('should get plugin dependents', async () => {
      const pluginA: Plugin = { name: 'plugin-a' }
      const pluginB: Plugin = { name: 'plugin-b', dependencies: ['plugin-a'] }
      const pluginC: Plugin = { name: 'plugin-c', dependencies: ['plugin-a'] }

      await registry.register(pluginA)
      await registry.register(pluginB)
      await registry.register(pluginC)

      const dependents = registry.getDependents('plugin-a')
      expect(dependents).toContain('plugin-b')
      expect(dependents).toContain('plugin-c')
    })

    it('should get registry statistics', async () => {
      const plugin1: Plugin = { name: 'plugin-1' }
      const plugin2: Plugin = { name: 'plugin-2' }

      await registry.register(plugin1)
      await registry.register(plugin2)

      const stats = registry.getStats()
      expect(stats.totalPlugins).toBe(2)
      expect(stats.loadOrder).toBe(2)
    })
  })

  describe('Dependency Management', () => {
    it('should validate dependencies successfully', async () => {
      const pluginA: Plugin = {
        name: 'plugin-a'
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a']
      }

      await registry.register(pluginA)
      await registry.register(pluginB)

      expect(() => registry.validateDependencies()).not.toThrow()
    })

    it('should throw error for missing dependencies', async () => {
      const pluginWithMissingDep: Plugin = {
        name: 'plugin-with-missing-dep',
        dependencies: ['non-existent-plugin']
      }

      await registry.register(pluginWithMissingDep)
      expect(() => registry.validateDependencies()).toThrow(
        "Plugin dependency validation failed"
      )
    })

    it('should detect circular dependencies', async () => {
      const pluginA: Plugin = {
        name: 'plugin-a',
        dependencies: ['plugin-b']
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a']
      }

      await registry.register(pluginA)
      
      await expect(registry.register(pluginB)).rejects.toThrow('Circular dependency detected')
    })
  })

  describe('Load Order', () => {
    it('should determine correct load order based on dependencies', async () => {
      const pluginA: Plugin = {
        name: 'plugin-a'
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a']
      }

      const pluginC: Plugin = {
        name: 'plugin-c',
        dependencies: ['plugin-b']
      }

      await registry.register(pluginA)
      await registry.register(pluginB)
      await registry.register(pluginC)

      const loadOrder = registry.getLoadOrder()
      
      expect(loadOrder.indexOf('plugin-a')).toBeLessThan(loadOrder.indexOf('plugin-b'))
      expect(loadOrder.indexOf('plugin-b')).toBeLessThan(loadOrder.indexOf('plugin-c'))
    })

    it('should respect plugin priorities', async () => {
      const lowPriorityPlugin: Plugin = {
        name: 'low-priority',
        priority: 1
      }

      const highPriorityPlugin: Plugin = {
        name: 'high-priority',
        priority: 10
      }

      await registry.register(lowPriorityPlugin)
      await registry.register(highPriorityPlugin)

      const loadOrder = registry.getLoadOrder()
      
      expect(loadOrder.indexOf('high-priority')).toBeLessThan(loadOrder.indexOf('low-priority'))
    })

    it('should handle plugins without priorities', async () => {
      const pluginWithoutPriority: Plugin = {
        name: 'no-priority'
      }

      const pluginWithPriority: Plugin = {
        name: 'with-priority',
        priority: 5
      }

      await registry.register(pluginWithoutPriority)
      await registry.register(pluginWithPriority)

      const loadOrder = registry.getLoadOrder()
      
      expect(loadOrder.indexOf('with-priority')).toBeLessThan(loadOrder.indexOf('no-priority'))
    })
  })

  describe('Plugin Discovery', () => {
    it('should discover plugins from directories', async () => {
      // This would require mocking the filesystem
      // For now, just test that the method exists and returns an array
      const results = await registry.discoverPlugins({
        directories: ['non-existent-dir']
      })
      
      expect(Array.isArray(results)).toBe(true)
    })

    it('should load plugin from path', async () => {
      // This would require mocking the filesystem and import
      // For now, just test that the method exists
      const result = await registry.loadPlugin('non-existent-path')
      
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(false)
      expect(result).toHaveProperty('error')
    })
  })

  describe('Plugin Configuration', () => {
    it('should validate plugin configuration', async () => {
      const plugin: Plugin = {
        name: 'config-plugin',
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string' }
          },
          required: ['apiKey']
        }
      }

      const config = {
        plugins: {
          enabled: ['config-plugin'],
          disabled: [],
          config: {
            'config-plugin': {
              apiKey: 'test-key'
            }
          }
        }
      }

      const registryWithConfig = new PluginRegistry({ 
        logger: mockLogger,
        config: config as unknown as import('@config').FluxStackConfig
      })

      await registryWithConfig.register(plugin)
      expect(registryWithConfig.get('config-plugin')).toBe(plugin)
    })
  })
})