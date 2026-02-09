// 🔥 FluxStack Live Components - Enhanced WebSocket Plugin with Connection Management

import { componentRegistry } from './ComponentRegistry'
import { fileUploadManager } from './FileUploadManager'
import { connectionManager } from './WebSocketConnectionManager'
import { performanceMonitor } from './LiveComponentPerformanceMonitor'
import { liveRoomManager, type RoomMessage } from './LiveRoomManager'
import type { LiveMessage, FileUploadStartMessage, FileUploadChunkMessage, FileUploadCompleteMessage } from '@core/types/types'
import type { Plugin, PluginContext } from '@core/index'
import { t, Elysia } from 'elysia'
import path from 'path'

// ===== Response Schemas for Live Components Routes =====

const LiveWebSocketInfoSchema = t.Object({
  success: t.Boolean(),
  message: t.String(),
  endpoint: t.String(),
  status: t.String(),
  connectionManager: t.Any()
}, {
  description: 'WebSocket connection information and system statistics'
})

const LiveStatsSchema = t.Object({
  success: t.Boolean(),
  stats: t.Any(),
  timestamp: t.String()
}, {
  description: 'Live Components statistics including registered components and instances'
})

const LiveHealthSchema = t.Object({
  success: t.Boolean(),
  service: t.String(),
  status: t.String(),
  components: t.Number(),
  connections: t.Any(),
  uptime: t.Number(),
  timestamp: t.String()
}, {
  description: 'Health status of Live Components service'
})

const LiveConnectionsSchema = t.Object({
  success: t.Boolean(),
  connections: t.Array(t.Any()),
  systemStats: t.Any(),
  timestamp: t.String()
}, {
  description: 'List of all active WebSocket connections with metrics'
})

const LiveConnectionDetailsSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    connection: t.Any(),
    timestamp: t.String()
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Detailed metrics for a specific connection'
})

const LivePoolStatsSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    pool: t.String(),
    stats: t.Any(),
    timestamp: t.String()
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Statistics for a specific connection pool'
})

const LivePerformanceDashboardSchema = t.Object({
  success: t.Boolean(),
  dashboard: t.Any(),
  timestamp: t.String()
}, {
  description: 'Performance monitoring dashboard data'
})

const LiveComponentMetricsSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    component: t.String(),
    metrics: t.Any(),
    alerts: t.Array(t.Any()),
    suggestions: t.Array(t.Any()),
    timestamp: t.String()
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Performance metrics, alerts and suggestions for a specific component'
})

const LiveAlertResolveSchema = t.Object({
  success: t.Boolean(),
  message: t.String(),
  timestamp: t.String()
}, {
  description: 'Result of alert resolution operation'
})

export const liveComponentsPlugin: Plugin = {
  name: 'live-components',
  version: '1.0.0',
  description: 'Real-time Live Components with Elysia native WebSocket support',
  author: 'FluxStack Team',
  priority: 'normal',
  category: 'core',
  tags: ['websocket', 'real-time', 'live-components'],
  
  setup: async (context: PluginContext) => {
    context.logger.debug('🔌 Setting up Live Components plugin with Elysia WebSocket...')
    
    // Auto-discover components from app/server/live directory
    const componentsPath = path.join(process.cwd(), 'app', 'server', 'live')
    await componentRegistry.autoDiscoverComponents(componentsPath)
    context.logger.debug('🔍 Component auto-discovery completed')
    
    // Create grouped routes for Live Components with documentation
    const liveRoutes = new Elysia({ prefix: '/api/live', tags: ['Live Components'] })
      // WebSocket route
      .ws('/ws', {
        body: t.Object({
          type: t.String(),
          componentId: t.String(),
          action: t.Optional(t.String()),
          payload: t.Optional(t.Any()),
          timestamp: t.Optional(t.Number()),
          userId: t.Optional(t.String()),
          room: t.Optional(t.String()),
          requestId: t.Optional(t.String()),
          expectResponse: t.Optional(t.Boolean()),
          // File upload specific fields
          uploadId: t.Optional(t.String()),
          filename: t.Optional(t.String()),
          fileType: t.Optional(t.String()),
          fileSize: t.Optional(t.Number()),
          chunkSize: t.Optional(t.Number()),
          chunkIndex: t.Optional(t.Number()),
          totalChunks: t.Optional(t.Number()),
          data: t.Optional(t.String()),
          hash: t.Optional(t.String())
        }),
        
        open(ws) {
          const socket = ws as any
          const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          console.log(`?Y"O Live Components WebSocket connected: ${connectionId}`)
          
          // Register connection with enhanced connection manager
          connectionManager.registerConnection(ws, connectionId, 'live-components')
          
          // Initialize and store connection data in ws.data
          if (!socket.data) {
            socket.data = {}
          }
          socket.data.connectionId = connectionId
          socket.data.components = new Map()
          socket.data.subscriptions = new Set()
          socket.data.connectedAt = new Date()
          
          // Send connection confirmation
          ws.send(JSON.stringify({
            type: 'CONNECTION_ESTABLISHED',
            connectionId,
            timestamp: Date.now(),
            features: {
              compression: true,
              encryption: true,
              offlineQueue: true,
              loadBalancing: true
            }
          }))
        },
        
        async message(ws, message: LiveMessage) {
          try {
            // Add connection metadata
            message.timestamp = Date.now()
            
            console.log(`📨 Received message:`, {
              type: message.type,
              componentId: message.componentId,
              action: message.action,
              requestId: message.requestId
            })

            // Handle different message types
            switch (message.type) {
              case 'COMPONENT_MOUNT':
                await handleComponentMount(ws, message)
                break
              case 'COMPONENT_REHYDRATE':
                await handleComponentRehydrate(ws, message)
                break
              case 'COMPONENT_UNMOUNT':
                await handleComponentUnmount(ws, message)
                break
              case 'CALL_ACTION':
                await handleActionCall(ws, message)
                break
              case 'PROPERTY_UPDATE':
                await handlePropertyUpdate(ws, message)
                break
              case 'COMPONENT_PING':
                await handleComponentPing(ws, message)
                break
              case 'FILE_UPLOAD_START':
                await handleFileUploadStart(ws, message as FileUploadStartMessage)
                break
              case 'FILE_UPLOAD_CHUNK':
                await handleFileUploadChunk(ws, message as FileUploadChunkMessage)
                break
              case 'FILE_UPLOAD_COMPLETE':
                await handleFileUploadComplete(ws, message as unknown as FileUploadCompleteMessage)
                break
              // Room system messages
              case 'ROOM_JOIN':
                await handleRoomJoin(ws, message as unknown as RoomMessage)
                break
              case 'ROOM_LEAVE':
                await handleRoomLeave(ws, message as unknown as RoomMessage)
                break
              case 'ROOM_EMIT':
                await handleRoomEmit(ws, message as unknown as RoomMessage)
                break
              case 'ROOM_STATE_SET':
                await handleRoomStateSet(ws, message as unknown as RoomMessage)
                break
              default:
                console.warn(`❌ Unknown message type: ${message.type}`)
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  error: `Unknown message type: ${message.type}`,
                  timestamp: Date.now()
                }))
            }
          } catch (error) {
            console.error('❌ WebSocket message error:', error)
            ws.send(JSON.stringify({
              type: 'ERROR',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now()
            }))
          }
        },
        
        close(ws) {
          const socket = ws as any
          const connectionId = socket.data?.connectionId
          console.log(`🔌 Live Components WebSocket disconnected: ${connectionId}`)
          
          // Cleanup connection in connection manager
          if (connectionId) {
            connectionManager.cleanupConnection(connectionId)
          }
          
          // Cleanup components for this connection
          componentRegistry.cleanupConnection(ws)
        }
      })

      // ===== Live Components Information Routes =====
      .get('/websocket-info', () => {
        return {
          success: true,
          message: 'Live Components WebSocket available via Elysia',
          endpoint: 'ws://localhost:3000/api/live/ws',
          status: 'running',
          connectionManager: connectionManager.getSystemStats()
        }
      }, {
        detail: {
          summary: 'Get WebSocket Information',
          description: 'Returns WebSocket endpoint information and connection manager statistics',
          tags: ['Live Components', 'WebSocket']
        },
        response: LiveWebSocketInfoSchema
      })

      .get('/stats', () => {
        const stats = componentRegistry.getStats()
        return {
          success: true,
          stats,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Live Components Statistics',
          description: 'Returns statistics about registered components and active instances',
          tags: ['Live Components', 'Monitoring']
        },
        response: LiveStatsSchema
      })

      .get('/health', () => {
        return {
          success: true,
          service: 'FluxStack Live Components',
          status: 'operational',
          components: componentRegistry.getStats().components,
          connections: connectionManager.getSystemStats(),
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Health Check',
          description: 'Returns the health status of the Live Components service',
          tags: ['Live Components', 'Health']
        },
        response: LiveHealthSchema
      })

      // ===== Connection Management Routes =====
      .get('/connections', () => {
        return {
          success: true,
          connections: connectionManager.getAllConnectionMetrics(),
          systemStats: connectionManager.getSystemStats(),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'List All Connections',
          description: 'Returns all active WebSocket connections with their metrics',
          tags: ['Live Components', 'Connections']
        },
        response: LiveConnectionsSchema
      })

      .get('/connections/:connectionId', ({ params }) => {
        const metrics = connectionManager.getConnectionMetrics(params.connectionId)
        if (!metrics) {
          return {
            success: false,
            error: 'Connection not found'
          }
        }
        return {
          success: true,
          connection: metrics,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Connection Details',
          description: 'Returns detailed metrics for a specific WebSocket connection',
          tags: ['Live Components', 'Connections']
        },
        params: t.Object({
          connectionId: t.String({ description: 'The unique connection identifier' })
        }),
        response: LiveConnectionDetailsSchema
      })

      .get('/pools/:poolId/stats', ({ params }) => {
        const stats = connectionManager.getPoolStats(params.poolId)
        if (!stats) {
          return {
            success: false,
            error: 'Pool not found'
          }
        }
        return {
          success: true,
          pool: params.poolId,
          stats,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Pool Statistics',
          description: 'Returns statistics for a specific connection pool',
          tags: ['Live Components', 'Connections', 'Pools']
        },
        params: t.Object({
          poolId: t.String({ description: 'The unique pool identifier' })
        }),
        response: LivePoolStatsSchema
      })

      // ===== Performance Monitoring Routes =====
      .get('/performance/dashboard', () => {
        return {
          success: true,
          dashboard: performanceMonitor.generateDashboard(),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Performance Dashboard',
          description: 'Returns comprehensive performance monitoring dashboard data',
          tags: ['Live Components', 'Performance']
        },
        response: LivePerformanceDashboardSchema
      })

      .get('/performance/components/:componentId', ({ params }) => {
        const metrics = performanceMonitor.getComponentMetrics(params.componentId)
        if (!metrics) {
          return {
            success: false,
            error: 'Component metrics not found'
          }
        }

        const alerts = performanceMonitor.getComponentAlerts(params.componentId)
        const suggestions = performanceMonitor.getComponentSuggestions(params.componentId)

        return {
          success: true,
          component: params.componentId,
          metrics,
          alerts,
          suggestions,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Component Performance Metrics',
          description: 'Returns performance metrics, alerts, and optimization suggestions for a specific component',
          tags: ['Live Components', 'Performance']
        },
        params: t.Object({
          componentId: t.String({ description: 'The unique component identifier' })
        }),
        response: LiveComponentMetricsSchema
      })

      .post('/performance/alerts/:alertId/resolve', ({ params }) => {
        const resolved = performanceMonitor.resolveAlert(params.alertId)
        return {
          success: resolved,
          message: resolved ? 'Alert resolved' : 'Alert not found',
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Resolve Performance Alert',
          description: 'Marks a performance alert as resolved',
          tags: ['Live Components', 'Performance', 'Alerts']
        },
        params: t.Object({
          alertId: t.String({ description: 'The unique alert identifier' })
        }),
        response: LiveAlertResolveSchema
      })

    // Register the grouped routes with the main app
    context.app.use(liveRoutes)
  },

  onServerStart: async (context: PluginContext) => {
    context.logger.debug('🔌 Live Components WebSocket ready on /api/live/ws')
  }
}

// Handler functions for WebSocket messages
async function handleComponentMount(ws: any, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)
  
  if (result !== null) {
    const response = {
      type: 'COMPONENT_MOUNTED',
      componentId: message.componentId,
      success: result.success,
      result: result.result,
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handleComponentRehydrate(ws: any, message: LiveMessage) {
  console.log('🔄 Processing component re-hydration request:', {
    componentId: message.componentId,
    payload: message.payload
  })

  try {
    const { componentName, signedState, room, userId } = message.payload || {}
    
    if (!componentName || !signedState) {
      throw new Error('Missing componentName or signedState in rehydration payload')
    }

    const result = await componentRegistry.rehydrateComponent(
      message.componentId,
      componentName,
      signedState,
      ws,
      { room, userId }
    )

    const response = {
      type: 'COMPONENT_REHYDRATED',
      componentId: message.componentId,
      success: result.success,
      result: {
        newComponentId: result.newComponentId,
        ...result
      },
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }

    console.log('📤 Sending COMPONENT_REHYDRATED response:', {
      type: response.type,
      success: response.success,
      newComponentId: response.result?.newComponentId,
      requestId: response.requestId
    })
    
    ws.send(JSON.stringify(response))

  } catch (error: any) {
    console.error('❌ Re-hydration handler error:', error.message)
    
    const errorResponse = {
      type: 'COMPONENT_REHYDRATED',
      componentId: message.componentId,
      success: false,
      error: error.message,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    
    ws.send(JSON.stringify(errorResponse))
  }
}

async function handleComponentUnmount(ws: any, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)
  
  if (result !== null) {
    const response = {
      type: 'COMPONENT_UNMOUNTED',
      componentId: message.componentId,
      success: result.success,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handleActionCall(ws: any, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)
  
  if (result !== null) {
    const response = {
      type: message.expectResponse ? 'ACTION_RESPONSE' : 'MESSAGE_RESPONSE',
      originalType: message.type,
      componentId: message.componentId,
      success: result.success,
      result: result.result,
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handlePropertyUpdate(ws: any, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)

  if (result !== null) {
    const response = {
      type: 'PROPERTY_UPDATED',
      componentId: message.componentId,
      success: result.success,
      result: result.result,
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handleComponentPing(ws: any, message: LiveMessage) {
  // Update component's last activity timestamp
  const updated = componentRegistry.updateComponentActivity(message.componentId)

  // Send pong response
  const response = {
    type: 'COMPONENT_PONG',
    componentId: message.componentId,
    success: updated,
    requestId: message.requestId,
    timestamp: Date.now()
  }

  ws.send(JSON.stringify(response))
}

// File Upload Handler Functions
async function handleFileUploadStart(ws: any, message: FileUploadStartMessage) {
  console.log('📤 Starting file upload:', message.uploadId)
  
  const result = await fileUploadManager.startUpload(message)
  
  const response = {
    type: 'FILE_UPLOAD_START_RESPONSE',
    componentId: message.componentId,
    uploadId: message.uploadId,
    success: result.success,
    error: result.error,
    requestId: message.requestId,
    timestamp: Date.now()
  }
  
  ws.send(JSON.stringify(response))
}

async function handleFileUploadChunk(ws: any, message: FileUploadChunkMessage) {
  console.log(`📦 Receiving chunk ${message.chunkIndex + 1} for upload ${message.uploadId}`)

  const progressResponse = await fileUploadManager.receiveChunk(message, ws)

  if (progressResponse) {
    // Add requestId to response so client can correlate it
    const responseWithRequestId = {
      ...progressResponse,
      requestId: message.requestId,
      success: true
    }
    ws.send(JSON.stringify(responseWithRequestId))
  } else {
    // Send error response
    const errorResponse = {
      type: 'FILE_UPLOAD_ERROR',
      componentId: message.componentId,
      uploadId: message.uploadId,
      error: 'Failed to process chunk',
      requestId: message.requestId,
      success: false,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(errorResponse))
  }
}

async function handleFileUploadComplete(ws: any, message: FileUploadCompleteMessage) {
  console.log('✅ Completing file upload:', message.uploadId)

  const completeResponse = await fileUploadManager.completeUpload(message)

  // Add requestId to response so client can correlate it
  const responseWithRequestId = {
    ...completeResponse,
    requestId: message.requestId
  }

  ws.send(JSON.stringify(responseWithRequestId))
}

// ===== Room System Handlers =====

async function handleRoomJoin(ws: any, message: RoomMessage) {
  console.log(`🚪 Component ${message.componentId} joining room ${message.roomId}`)

  try {
    const result = liveRoomManager.joinRoom(
      message.componentId,
      message.roomId,
      ws,
      message.data?.initialState
    )

    const response = {
      type: 'ROOM_JOINED',
      componentId: message.componentId,
      roomId: message.roomId,
      success: true,
      state: result.state,
      requestId: message.requestId,
      timestamp: Date.now()
    }

    ws.send(JSON.stringify(response))
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      requestId: message.requestId,
      timestamp: Date.now()
    }))
  }
}

async function handleRoomLeave(ws: any, message: RoomMessage) {
  console.log(`🚶 Component ${message.componentId} leaving room ${message.roomId}`)

  try {
    liveRoomManager.leaveRoom(message.componentId, message.roomId)

    const response = {
      type: 'ROOM_LEFT',
      componentId: message.componentId,
      roomId: message.roomId,
      success: true,
      requestId: message.requestId,
      timestamp: Date.now()
    }

    ws.send(JSON.stringify(response))
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      requestId: message.requestId,
      timestamp: Date.now()
    }))
  }
}

async function handleRoomEmit(ws: any, message: RoomMessage) {
  console.log(`📡 Component ${message.componentId} emitting '${message.event}' to room ${message.roomId}`)

  try {
    const count = liveRoomManager.emitToRoom(
      message.roomId,
      message.event!,
      message.data,
      message.componentId // Excluir quem enviou
    )

    console.log(`   → Notified ${count} components`)
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      timestamp: Date.now()
    }))
  }
}

async function handleRoomStateSet(ws: any, message: RoomMessage) {
  console.log(`📝 Component ${message.componentId} updating state in room ${message.roomId}`)

  try {
    liveRoomManager.setRoomState(
      message.roomId,
      message.data,
      message.componentId // Excluir quem enviou
    )
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      timestamp: Date.now()
    }))
  }
}
