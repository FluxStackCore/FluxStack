// 🔥 Live Components Provider - Singleton WebSocket Connection
// Single WebSocket connection shared by all live components in the app

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { WebSocketMessage, WebSocketResponse } from '../types/types'

export interface LiveComponentsContextValue {
  connected: boolean
  connecting: boolean
  error: string | null
  connectionId: string | null

  // Send message without waiting for response
  sendMessage: (message: WebSocketMessage) => Promise<void>

  // Send message and wait for specific response
  sendMessageAndWait: (message: WebSocketMessage, timeout?: number) => Promise<WebSocketResponse>

  // Send binary data and wait for response (for file uploads)
  sendBinaryAndWait: (data: ArrayBuffer, requestId: string, timeout?: number) => Promise<WebSocketResponse>

  // Register message listener for a component
  registerComponent: (componentId: string, callback: (message: WebSocketResponse) => void) => () => void

  // Unregister component
  unregisterComponent: (componentId: string) => void

  // Manual reconnect
  reconnect: () => void

  // Get current WebSocket instance (for advanced use)
  getWebSocket: () => WebSocket | null
}

const LiveComponentsContext = createContext<LiveComponentsContextValue | null>(null)

export interface LiveComponentsProviderProps {
  children: React.ReactNode
  url?: string
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  debug?: boolean
}

export function LiveComponentsProvider({
  children,
  url,
  autoConnect = true,
  reconnectInterval = 1000,
  maxReconnectAttempts = 5,
  heartbeatInterval = 30000,
  debug = false
}: WebSocketProviderProps) {

  // Get WebSocket URL dynamically
  const getWebSocketUrl = () => {
    if (url) return url
    if (typeof window === 'undefined') return 'ws://localhost:3000/api/live/ws'

    // Always use current host - works for both dev and production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/live/ws`
  }

  const wsUrl = getWebSocketUrl()

  // State
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)

  // Refs
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const heartbeatIntervalRef = useRef<number | null>(null)

  // Component callbacks registry: componentId -> callback
  const componentCallbacksRef = useRef<Map<string, (message: WebSocketResponse) => void>>(new Map())

  // Pending requests: requestId -> { resolve, reject, timeout }
  const pendingRequestsRef = useRef<Map<string, {
    resolve: (value: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }>>(new Map())

  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[WebSocketProvider] ${message}`, data || '')
    }
  }, [debug])

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      log('Already connecting, skipping...')
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected, skipping...')
      return
    }
    setConnecting(true)
    setError(null)
    log('🔌 Connecting to WebSocket...', { url: wsUrl })

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        log('✅ WebSocket connected')
        setConnected(true)
        setConnecting(false)
        reconnectAttemptsRef.current = 0

        // Start heartbeat
        startHeartbeat()
      }

      ws.onmessage = (event) => {
        try {
          const response: WebSocketResponse = JSON.parse(event.data)
          log('📨 Received message', { type: response.type, componentId: response.componentId })

          // Handle connection established
          if (response.type === 'CONNECTION_ESTABLISHED') {
            setConnectionId(response.connectionId || null)
            log('🔗 Connection ID:', response.connectionId)
          }

          // Handle pending requests (request-response pattern)
          if (response.requestId && pendingRequestsRef.current.has(response.requestId)) {
            const request = pendingRequestsRef.current.get(response.requestId)!
            clearTimeout(request.timeout)
            pendingRequestsRef.current.delete(response.requestId)

            if (response.success !== false) {
              request.resolve(response)
            } else {
              // Don't reject re-hydration errors - let component handle them
              if (response.error?.includes?.('COMPONENT_REHYDRATION_REQUIRED')) {
                request.resolve(response)
              } else {
                request.reject(new Error(response.error || 'Request failed'))
              }
            }
            return
          }

          // Broadcast messages should go to ALL components (not just sender)
          if (response.type === 'BROADCAST') {
            // Send to all registered components in the same room
            const registeredComponents = Array.from(componentCallbacksRef.current.keys())
            log('📡 Broadcast routing:', {
              sender: response.componentId,
              registeredComponents,
              totalRegistered: registeredComponents.length
            })

            componentCallbacksRef.current.forEach((callback, compId) => {
              // Don't send back to the sender component
              if (compId !== response.componentId) {
                callback(response)
              }
            })
            return
          }

          // Route message to specific component
          if (response.componentId) {
            const callback = componentCallbacksRef.current.get(response.componentId)
            if (callback) {
              callback(response)
            } else {
              log('⚠️ No callback registered for component:', response.componentId)
            }
          }

        } catch (error) {
          log('❌ Failed to parse message', error)
          setError('Failed to parse message')
        }
      }

      ws.onclose = () => {
        log('🔌 WebSocket closed')
        setConnected(false)
        setConnecting(false)
        setConnectionId(null)

        // Stop heartbeat
        stopHeartbeat()

        // Auto-reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          log(`🔄 Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else {
          setError('Max reconnection attempts reached')
          log('❌ Max reconnection attempts reached')
        }
      }

      ws.onerror = (event) => {
        log('❌ WebSocket error', event)
        setError('WebSocket connection error')
        setConnecting(false)
      }

    } catch (error) {
      setConnecting(false)
      setError(error instanceof Error ? error.message : 'Connection failed')
      log('❌ Failed to create WebSocket', error)
    }
  }, [wsUrl, reconnectInterval, maxReconnectAttempts, log])

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    stopHeartbeat()

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    reconnectAttemptsRef.current = maxReconnectAttempts // Prevent auto-reconnect
    setConnected(false)
    setConnecting(false)
    setConnectionId(null)
    log('🔌 WebSocket disconnected manually')
  }, [maxReconnectAttempts, log])

  // Manual reconnect
  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttemptsRef.current = 0
    setTimeout(() => connect(), 100)
  }, [connect, disconnect])

  // Start heartbeat (ping components periodically)
  const startHeartbeat = useCallback(() => {
    stopHeartbeat()

    heartbeatIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send ping to all registered components
        componentCallbacksRef.current.forEach((_, componentId) => {
          sendMessage({
            type: 'COMPONENT_PING',
            componentId,
            timestamp: Date.now()
          }).catch(err => {
            log('❌ Heartbeat ping failed for component:', componentId)
          })
        })
      }
    }, heartbeatInterval)
  }, [heartbeatInterval, log])

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Send message without waiting for response
  const sendMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    try {
      const messageWithTimestamp = { ...message, timestamp: Date.now() }
      wsRef.current.send(JSON.stringify(messageWithTimestamp))
      log('📤 Sent message', { type: message.type, componentId: message.componentId })
    } catch (error) {
      log('❌ Failed to send message', error)
      throw error
    }
  }, [log])

  // Send message and wait for response
  const sendMessageAndWait = useCallback(async (
    message: WebSocketMessage,
    timeout: number = 10000
  ): Promise<WebSocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'))
        return
      }

      const requestId = generateRequestId()

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        pendingRequestsRef.current.delete(requestId)
        reject(new Error(`Request timeout after ${timeout}ms`))
      }, timeout)

      // Store pending request
      pendingRequestsRef.current.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle
      })

      try {
        const messageWithRequestId = {
          ...message,
          requestId,
          expectResponse: true,
          timestamp: Date.now()
        }

        wsRef.current.send(JSON.stringify(messageWithRequestId))
        log('📤 Sent message with request ID', { requestId, type: message.type })
      } catch (error) {
        clearTimeout(timeoutHandle)
        pendingRequestsRef.current.delete(requestId)
        reject(error)
      }
    })
  }, [log, generateRequestId])

  // Send binary data and wait for response (for file uploads)
  const sendBinaryAndWait = useCallback(async (
    data: ArrayBuffer,
    requestId: string,
    timeout: number = 10000
  ): Promise<WebSocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'))
        return
      }

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        pendingRequestsRef.current.delete(requestId)
        reject(new Error(`Binary request timeout after ${timeout}ms`))
      }, timeout)

      // Store pending request
      pendingRequestsRef.current.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle
      })

      try {
        // Send as binary frame
        wsRef.current.send(data)
        log('📤 Sent binary data', { requestId, size: data.byteLength })
      } catch (error) {
        clearTimeout(timeoutHandle)
        pendingRequestsRef.current.delete(requestId)
        reject(error)
      }
    })
  }, [log])

  // Register component callback
  const registerComponent = useCallback((
    componentId: string,
    callback: (message: WebSocketResponse) => void
  ): (() => void) => {
    log('📝 Registering component', componentId)
    componentCallbacksRef.current.set(componentId, callback)

    // Return unregister function
    return () => {
      log('🗑️ Unregistering component', componentId)
      componentCallbacksRef.current.delete(componentId)
    }
  }, [log])

  // Unregister component
  const unregisterComponent = useCallback((componentId: string) => {
    componentCallbacksRef.current.delete(componentId)
    log('🗑️ Component unregistered', componentId)
  }, [log])

  // Get WebSocket instance
  const getWebSocket = useCallback(() => {
    return wsRef.current
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  const value: LiveComponentsContextValue = {
    connected,
    connecting,
    error,
    connectionId,
    sendMessage,
    sendMessageAndWait,
    sendBinaryAndWait,
    registerComponent,
    unregisterComponent,
    reconnect,
    getWebSocket
  }

  return (
    <LiveComponentsContext.Provider value={value}>
      {children}
    </LiveComponentsContext.Provider>
  )
}

// Hook to use Live Components context
export function useLiveComponents(): LiveComponentsContextValue {
  const context = useContext(LiveComponentsContext)
  if (!context) {
    throw new Error('useLiveComponents must be used within LiveComponentsProvider')
  }
  return context
}

// ⚠️ DEPRECATED: Use useLiveComponents instead
// Kept for backward compatibility
export const useWebSocketContext = useLiveComponents

// ⚠️ DEPRECATED: Use LiveComponentsProvider instead
// Kept for backward compatibility
export const WebSocketProvider = LiveComponentsProvider
export type WebSocketProviderProps = LiveComponentsProviderProps
export type WebSocketContextValue = LiveComponentsContextValue
