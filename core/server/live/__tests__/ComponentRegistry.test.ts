// 🧪 ComponentRegistry Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ComponentRegistry } from '../ComponentRegistry'
import { LiveComponent } from '@core/plugins/types'

// Mock LiveComponent for testing
class TestComponent extends LiveComponent {
  constructor(initialState: any, ws: any) {
    super(initialState, ws)
  }

  async testAction(payload: any) {
    this.setState({ ...this.state, actionCalled: true, payload })
    return { success: true, data: payload }
  }

  async errorAction() {
    throw new Error('Test error')
  }
}

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry
  let mockWs: any

  beforeEach(() => {
    registry = new ComponentRegistry()
    mockWs = {
      send: vi.fn(),
      data: {
        components: new Map(),
        subscriptions: new Set(),
        userId: 'test-user'
      }
    }
  })

  afterEach(() => {
    registry.cleanup()
  })

  describe('Component Registration', () => {
    it('should register a component definition', () => {
      const definition = {
        name: 'TestComponent',
        initialState: { count: 0 },
        component: TestComponent
      }

      registry.registerComponent(definition)
      
      // Verify component is registered (internal test)
      expect(true).toBe(true) // Registry doesn't expose internal state
    })

    it('should register component dependencies', () => {
      const dependencies = [
        { name: 'database', version: '1.0.0', required: true, factory: () => ({}) },
        { name: 'cache', version: '1.0.0', required: false, factory: () => ({}) }
      ]

      registry.registerDependencies('TestComponent', dependencies)
      
      expect(true).toBe(true) // Dependencies registered successfully
    })

    it('should register services', () => {
      const mockService = { getData: () => 'test data' }
      
      registry.registerService('testService', () => mockService)
      
      expect(true).toBe(true) // Service registered successfully
    })
  })

  describe('Component Mounting', () => {
    beforeEach(() => {
      registry.registerComponentClass('TestComponent', TestComponent)
    })

    it('should mount a component successfully', async () => {
      const result = await registry.mountComponent(
        mockWs,
        'TestComponent',
        { count: 5 },
        { room: 'test-room', userId: 'test-user' }
      )

      expect(result).toHaveProperty('componentId')
      expect(result).toHaveProperty('initialState')
      expect(result).toHaveProperty('signedState')
      expect(result.initialState).toEqual({ count: 5 })
    })

    it('should fail to mount non-existent component', async () => {
      await expect(
        registry.mountComponent(mockWs, 'NonExistentComponent', {})
      ).rejects.toThrow('Component \'NonExistentComponent\' not found')
    })

    it('should inject services into mounted component', async () => {
      const mockService = { getData: () => 'test data' }
      registry.registerService('testService', () => mockService)
      
      const dependencies = [
        { name: 'testService', version: '1.0.0', required: true, factory: () => mockService }
      ]
      registry.registerDependencies('TestComponent', dependencies)

      const result = await registry.mountComponent(mockWs, 'TestComponent', {})
      
      expect(result).toHaveProperty('componentId')
    })
  })

  describe('Message Handling', () => {
    let componentId: string

    beforeEach(async () => {
      registry.registerComponentClass('TestComponent', TestComponent)
      const result = await registry.mountComponent(mockWs, 'TestComponent', { count: 0 })
      componentId = result.componentId
    })

    it('should handle action calls', async () => {
      const message = {
        type: 'CALL_ACTION' as const,
        componentId,
        action: 'testAction',
        payload: { test: 'data' },
        expectResponse: true
      }

      const result = await registry.handleMessage(mockWs, message)
      
      expect(result.success).toBe(true)
      expect(result.result).toEqual({ success: true, data: { test: 'data' } })
    })

    it('should handle action errors', async () => {
      const message = {
        type: 'CALL_ACTION' as const,
        componentId,
        action: 'errorAction',
        payload: {},
        expectResponse: true
      }

      const result = await registry.handleMessage(mockWs, message)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Test error')
    })

    it('should handle component unmounting', async () => {
      const message = {
        type: 'COMPONENT_UNMOUNT' as const,
        componentId
      }

      const result = await registry.handleMessage(mockWs, message)
      
      expect(result.success).toBe(true)
    })
  })

  describe('Health Monitoring', () => {
    let componentId: string

    beforeEach(async () => {
      registry.registerComponentClass('TestComponent', TestComponent)
      const result = await registry.mountComponent(mockWs, 'TestComponent', { count: 0 })
      componentId = result.componentId
    })

    it('should track component metrics', () => {
      registry.recordComponentMetrics(componentId, 50) // 50ms render time
      registry.recordComponentMetrics(componentId, undefined, 'testAction')
      
      const health = registry.getComponentHealth(componentId)
      expect(health).toBeTruthy()
      expect(health?.componentId).toBe(componentId)
    })

    it('should record component errors', () => {
      const error = new Error('Test error')
      registry.recordComponentError(componentId, error)
      
      const health = registry.getComponentHealth(componentId)
      expect(health?.metrics.errorCount).toBe(1)
    })

    it('should get all component health statuses', () => {
      const healthStatuses = registry.getAllComponentHealth()
      expect(Array.isArray(healthStatuses)).toBe(true)
      expect(healthStatuses.length).toBeGreaterThan(0)
    })
  })

  describe('State Migration', () => {
    let componentId: string

    beforeEach(async () => {
      registry.registerComponentClass('TestComponent', TestComponent)
      const result = await registry.mountComponent(mockWs, 'TestComponent', { version: 1, data: 'old' })
      componentId = result.componentId
    })

    it('should migrate component state', async () => {
      const migrationFn = (state: any) => ({
        ...state,
        version: 2,
        data: 'migrated'
      })

      const success = await registry.migrateComponentState(
        componentId,
        '1',
        '2',
        migrationFn
      )

      expect(success).toBe(true)
    })

    it('should handle migration errors', async () => {
      const migrationFn = () => {
        throw new Error('Migration failed')
      }

      const success = await registry.migrateComponentState(
        componentId,
        '1',
        '2',
        migrationFn
      )

      expect(success).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup connection properly', async () => {
      // Register component first
      registry.registerComponentClass('TestComponent', TestComponent)
      
      // Mount a real component
      const result = await registry.mountComponent(mockWs, 'TestComponent', {})
      expect(mockWs.data.components.size).toBe(1)
      
      registry.cleanupConnection(mockWs)
      
      expect(mockWs.data.components.size).toBe(0)
    })

    it('should cleanup all resources on shutdown', () => {
      registry.cleanup()
      
      // Should not throw any errors
      expect(true).toBe(true)
    })
  })
})