// 🧪 Integration Tests for Live Components System

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ComponentRegistry } from '../ComponentRegistry'
import { WebSocketConnectionManager } from '../WebSocketConnectionManager'
import { LiveComponentPerformanceMonitor } from '../LiveComponentPerformanceMonitor'
import { FileUploadManager } from '../FileUploadManager'
import { StateSignature } from '../StateSignature'
import { LiveComponent } from '@core/plugins/types'
import { createMockWebSocket, createTestState, waitFor } from './setup'

// Test component for integration tests
class IntegrationTestComponent extends LiveComponent {
  constructor(initialState: any, ws: any) {
    super(initialState, ws)
  }

  async incrementCounter() {
    this.setState({ 
      count: (this.state.count || 0) + 1,
      lastUpdated: Date.now()
    })
    return { success: true, newCount: this.state.count }
  }

  async slowAction() {
    // Simulate slow operation
    await new Promise(resolve => setTimeout(resolve, 100))
    this.setState({ slowActionCalled: true })
    return { success: true }
  }

  async errorAction() {
    throw new Error('Integration test error')
  }
}

describe('Live Components System Integration', () => {
  let registry: ComponentRegistry
  let connectionManager: WebSocketConnectionManager
  let performanceMonitor: LiveComponentPerformanceMonitor
  let uploadManager: FileUploadManager
  let stateSignature: StateSignature
  let mockWs: any

  beforeEach(() => {
    registry = new ComponentRegistry()
    connectionManager = new WebSocketConnectionManager({
      maxConnections: 10,
      heartbeatInterval: 1000,
      healthCheckInterval: 2000
    })
    performanceMonitor = new LiveComponentPerformanceMonitor({
      enabled: true,
      sampleRate: 1.0,
      renderTimeThreshold: 50,
      actionTimeThreshold: 200
    })
    uploadManager = new FileUploadManager()
    stateSignature = new StateSignature('integration-test-key')
    mockWs = createMockWebSocket()

    // Register test component
    registry.registerComponentClass('IntegrationTestComponent', IntegrationTestComponent)
  })

  afterEach(() => {
    registry.cleanup()
    connectionManager.shutdown()
    performanceMonitor.shutdown()
  })

  describe('Component Lifecycle Integration', () => {
    it('should handle complete component lifecycle with monitoring', async () => {
      // Register connection
      const connectionId = 'integration-test-connection'
      connectionManager.registerConnection(mockWs, connectionId, 'test-pool')

      // Mount component with performance monitoring
      const mountResult = await registry.mountComponent(
        mockWs,
        'IntegrationTestComponent',
        { count: 0 },
        { room: 'test-room', userId: 'test-user' }
      )

      expect(mountResult.componentId).toBeTruthy()
      expect(mountResult.initialState).toEqual({ count: 0 })

      // Verify performance monitoring was initialized
      const metrics = performanceMonitor.getComponentMetrics(mountResult.componentId)
      expect(metrics).toBeTruthy()
      expect(metrics?.componentName).toBe('IntegrationTestComponent')

      // Execute action and verify monitoring
      const actionMessage = {
        type: 'CALL_ACTION' as const,
        componentId: mountResult.componentId,
        action: 'incrementCounter',
        payload: {},
        expectResponse: true
      }

      const actionResult = await registry.handleMessage(mockWs, actionMessage)
      expect(actionResult.success).toBe(true)
      expect(actionResult.result.newCount).toBe(1)

      // Verify action was recorded in performance monitoring
      const updatedMetrics = performanceMonitor.getComponentMetrics(mountResult.componentId)
      expect(updatedMetrics?.actionMetrics.totalActions).toBe(1)

      // Cleanup
      await registry.handleMessage(mockWs, {
        type: 'COMPONENT_UNMOUNT',
        componentId: mountResult.componentId
      })

      // Verify cleanup
      const metricsAfterCleanup = performanceMonitor.getComponentMetrics(mountResult.componentId)
      expect(metricsAfterCleanup).toBeNull()
    })

    it('should handle state signing and validation throughout lifecycle', async () => {
      // Mount component
      const mountResult = await registry.mountComponent(
        mockWs,
        'IntegrationTestComponent',
        { count: 5, data: 'test' }
      )

      // Verify signed state
      expect(mountResult.signedState).toBeTruthy()
      expect(mountResult.signedState.componentId).toBe(mountResult.componentId)

      // Validate the signed state
      const validation = await stateSignature.validateState(mountResult.signedState)
      expect(validation.valid).toBe(true)

      // Extract and verify data
      const extractedData = await stateSignature.extractData(mountResult.signedState)
      expect(extractedData).toEqual({ count: 5, data: 'test' })
    })
  })

  describe('Performance Monitoring Integration', () => {
    let componentId: string

    beforeEach(async () => {
      const mountResult = await registry.mountComponent(
        mockWs,
        'IntegrationTestComponent',
        { count: 0 }
      )
      componentId = mountResult.componentId
    })

    it('should monitor slow actions and generate alerts', async () => {
      // Execute slow action
      const actionMessage = {
        type: 'CALL_ACTION' as const,
        componentId,
        action: 'slowAction',
        payload: {},
        expectResponse: true
      }

      const result = await registry.handleMessage(mockWs, actionMessage)
      expect(result.success).toBe(true)

      // Check if alert was generated for slow action
      await waitFor(100) // Give time for monitoring to process

      const alerts = performanceMonitor.getComponentAlerts(componentId)
      const slowActionAlert = alerts.find(alert => 
        alert.category === 'action' && alert.message.includes('slowAction')
      )
      expect(slowActionAlert).toBeTruthy()
    })

    it('should generate optimization suggestions', async () => {
      // Execute multiple slow renders to trigger suggestions
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordRenderTime(componentId, 80) // Consistently slow
      }

      const suggestions = performanceMonitor.getComponentSuggestions(componentId)
      expect(suggestions.length).toBeGreaterThan(0)

      const renderSuggestion = suggestions.find(s => s.type === 'render')
      expect(renderSuggestion).toBeTruthy()
      expect(renderSuggestion?.priority).toBeTruthy()
    })

    it('should create comprehensive dashboard', async () => {
      // Generate some activity
      performanceMonitor.recordRenderTime(componentId, 30)
      performanceMonitor.recordActionTime(componentId, 'testAction', 150)
      performanceMonitor.recordMemoryUsage(componentId, 20 * 1024 * 1024)
      performanceMonitor.recordUserInteraction(componentId, 'click', 100)

      const dashboard = performanceMonitor.generateDashboard()

      expect(dashboard.overview.totalComponents).toBe(1)
      expect(dashboard.overview.healthyComponents).toBe(1)
      expect(dashboard.topPerformers.length).toBeGreaterThan(0)
      expect(dashboard.trends).toBeTruthy()
    })
  })

  describe('Connection Management Integration', () => {
    it('should handle connection pooling with load balancing', async () => {
      const poolId = 'integration-test-pool'
      const connections = []

      // Create multiple connections in the same pool
      for (let i = 0; i < 3; i++) {
        const ws = createMockWebSocket()
        const connectionId = `connection-${i}`
        connectionManager.registerConnection(ws, connectionId, poolId)
        connections.push({ ws, connectionId })
      }

      // Send messages to the pool
      const messages = [
        { type: 'test1', data: 'message1' },
        { type: 'test2', data: 'message2' },
        { type: 'test3', data: 'message3' }
      ]

      for (const message of messages) {
        const success = await connectionManager.sendMessage(message, { poolId })
        expect(success).toBe(true)
      }

      // Verify load balancing distributed messages
      const poolStats = connectionManager.getPoolStats(poolId)
      expect(poolStats?.totalConnections).toBe(3)
      expect(poolStats?.activeConnections).toBe(3)
    })

    it('should handle connection failures gracefully', async () => {
      const connectionId = 'failing-connection'
      const failingWs = {
        ...createMockWebSocket(),
        send: vi.fn().mockImplementation(() => {
          throw new Error('Connection failed')
        })
      }

      connectionManager.registerConnection(failingWs, connectionId)

      // Try to send message to failing connection
      const success = await connectionManager.sendMessage(
        { type: 'test', data: 'fail' },
        { connectionId }
      )

      expect(success).toBe(false)
    })
  })

  describe('File Upload Integration', () => {
    it('should handle complete file upload workflow', async () => {
      const uploadId = 'integration-upload'
      
      // Start upload
      const startResult = await uploadManager.startUpload({
        type: 'FILE_UPLOAD_START',
        componentId: 'test-component',
        uploadId,
        filename: 'integration-test.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        chunkSize: 512
      })

      expect(startResult.success).toBe(true)

      // Send chunks
      const chunk1Result = await uploadManager.receiveChunk({
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 0,
        totalChunks: 2,
        data: Buffer.from('first chunk').toString('base64')
      }, mockWs)

      expect(chunk1Result?.progress).toBe(50)

      const chunk2Result = await uploadManager.receiveChunk({
        type: 'FILE_UPLOAD_CHUNK',
        componentId: 'test-component',
        uploadId,
        chunkIndex: 1,
        totalChunks: 2,
        data: Buffer.from('second chunk').toString('base64')
      }, mockWs)

      expect(chunk2Result?.progress).toBe(100)

      // Complete upload
      const completeResult = await uploadManager.completeUpload({
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: 'test-component',
        uploadId
      })

      expect(completeResult.success).toBe(true)
      expect(completeResult.fileUrl).toBeTruthy()
    })
  })

  describe('Error Handling Integration', () => {
    let componentId: string

    beforeEach(async () => {
      const mountResult = await registry.mountComponent(
        mockWs,
        'IntegrationTestComponent',
        { count: 0 }
      )
      componentId = mountResult.componentId
    })

    it('should handle component errors with monitoring', async () => {
      const errorMessage = {
        type: 'CALL_ACTION' as const,
        componentId,
        action: 'errorAction',
        payload: {},
        expectResponse: true
      }

      const result = await registry.handleMessage(mockWs, errorMessage)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Integration test error')

      // Verify error was recorded in performance monitoring
      const metrics = performanceMonitor.getComponentMetrics(componentId)
      expect(metrics?.actionMetrics.failedActions).toBe(1)

      // Verify error was recorded in component health
      const health = registry.getComponentHealth(componentId)
      expect(health?.metrics.errorCount).toBe(1)
    })

    it('should handle system-wide error recovery', async () => {
      // Simulate multiple errors to trigger recovery
      for (let i = 0; i < 3; i++) {
        registry.recordComponentError(componentId, new Error(`Error ${i}`))
      }

      const health = registry.getComponentHealth(componentId)
      expect(health?.metrics.errorCount).toBe(3)

      // Health status should be degraded or unhealthy
      expect(['degraded', 'unhealthy']).toContain(health?.status)
    })
  })

  describe('State Management Integration', () => {
    it('should handle state compression and encryption', async () => {
      const largeState = createTestState('large')
      
      // Sign state with compression and encryption
      const signedState = await stateSignature.signState(
        'test-component',
        largeState,
        1,
        { compress: true, encrypt: true, backup: true }
      )

      expect(signedState.compressed).toBe(true)
      expect(signedState.encrypted).toBe(true)

      // Validate and extract
      const validation = await stateSignature.validateState(signedState)
      expect(validation.valid).toBe(true)

      const extractedData = await stateSignature.extractData(signedState)
      expect(extractedData).toEqual(largeState)

      // Verify backup was created
      const backups = stateSignature.getComponentBackups('test-component')
      expect(backups.length).toBe(1)
    })

    it('should handle state migration', async () => {
      // Register migration
      stateSignature.registerMigration('1', '2', (state: any) => ({
        ...state,
        version: 2,
        migratedField: 'added in v2'
      }))

      const oldState = { version: 1, data: 'test' }
      const signedState = await stateSignature.signState('test-component', oldState, 1)

      const migratedState = await stateSignature.migrateState(signedState, '2')
      expect(migratedState).toBeTruthy()

      if (migratedState) {
        const extractedData = await stateSignature.extractData(migratedState)
        expect(extractedData.version).toBe(2)
        expect(extractedData.migratedField).toBe('added in v2')
      }
    })
  })

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive system health status', async () => {
      // Create multiple components with different health states
      const healthyComponent = await registry.mountComponent(mockWs, 'IntegrationTestComponent', { count: 0 })
      const degradedComponent = await registry.mountComponent(mockWs, 'IntegrationTestComponent', { count: 0 })

      // Make one component degraded
      for (let i = 0; i < 3; i++) {
        registry.recordComponentError(degradedComponent.componentId, new Error('Test error'))
      }

      // Get overall system health
      const allHealth = registry.getAllComponentHealth()
      expect(allHealth.length).toBe(2)

      const healthyCount = allHealth.filter(h => h.status === 'healthy').length
      const degradedCount = allHealth.filter(h => h.status === 'degraded').length

      expect(healthyCount).toBeGreaterThan(0)
      expect(degradedCount).toBeGreaterThan(0)

      // Get connection manager stats
      const connectionStats = connectionManager.getSystemStats()
      expect(connectionStats.totalConnections).toBeGreaterThanOrEqual(0)

      // Get performance dashboard
      const dashboard = performanceMonitor.generateDashboard()
      expect(dashboard.overview.totalComponents).toBe(2)
    })
  })
})