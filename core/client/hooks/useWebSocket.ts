// 🔥 WebSocket Hook for Live Components

import { useState, useEffect, useCallback, useRef } from 'react'
import type { WebSocketMessage, WebSocketResponse } from '@core/types/types'

// Re-export types for easier importing
export type { WebSocketMessage, WebSocketResponse }

export interface UseWebSocketOptions {
  url?: string
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  debug?: boolean
}

export interface UseWebSocketReturn {
  connected: boolean
  connecting: boolean
  error: string | null
  connectionId: string | null
  sendMessage: (message: WebSocketMessage) => Promise<WebSocketResponse | null>
  sendMessageAndWait: (message: WebSocketMessage, timeout?: number) => Promise<any>
  close: () => void
  reconnect: () => void
  messageHistory: WebSocketResponse[]
  lastMessage: WebSocketResponse | null
  onMessage: (callback: (message: WebSocketResponse) => void) => () => void
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  // Get WebSocket URL dynamically based on current environment
  const getWebSocketUrl = () => {
    if (typeof window === 'undefined') return 'ws://localhost:3000/api/live/ws'

    // Always use current host - works for both dev and production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/live/ws`
  }

  const {
    url = getWebSocketUrl(),
    autoConnect = true,
    reconnectInterval = 300, // Reduced from 3000ms to 1000ms for faster reconnects
    maxReconnectAttempts = 5,
    debug = false
  } = options

  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [messageHistory, setMessageHistory] = useState<WebSocketResponse[]>([])
  const [lastMessage, setLastMessage] = useState<WebSocketResponse | null>(null)
  
  // Request-Response system
  const pendingRequests = useRef<Map<string, {
    resolve: (value: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }>>(new Map())
  
  // Message callbacks for real-time processing
  const messageCallbacksRef = useRef<Set<(message: WebSocketResponse) => void>>(new Set())
  
  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeout = useRef<number | null>(null)
  const messageCallbacks = useRef<Map<string, (response: WebSocketResponse) => void>>(new Map())

  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useWebSocket] ${message}`, data)
    }
  }, [debug])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      log('WebSocket already connecting, skipping...')
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('WebSocket already connected, skipping...')
      return
    }

    setConnecting(true)
    setError(null)
    log('Connecting to WebSocket', { url })

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setConnecting(false)
        reconnectAttempts.current = 0
        log('Connected to WebSocket')
      }

      ws.onmessage = (event) => {
        try {
          const response: WebSocketResponse = JSON.parse(event.data)
          log('Received message', response)

          // Handle connection establishment
          if (response.type === 'CONNECTION_ESTABLISHED') {
            setConnectionId(response.connectionId || null)
          }

          // Handle request-response system
          if (response.requestId && pendingRequests.current.has(response.requestId)) {
            const request = pendingRequests.current.get(response.requestId)!
            clearTimeout(request.timeout)
            pendingRequests.current.delete(response.requestId)
            
            if (response.success !== false) {
              request.resolve(response) // Pass full response, not just result
            } else {
              // Don't reject COMPONENT_REHYDRATION_REQUIRED - let client handle it
              if (response.error?.includes?.('COMPONENT_REHYDRATION_REQUIRED')) {
                request.resolve(response) // Return response so client can handle re-hydration
              } else {
                request.reject(new Error(response.error || 'Request failed'))
              }
            }
            return // Don't process further for request-response
          }

          // Handle message callbacks (legacy)
          if (response.type === 'MESSAGE_RESPONSE' && response.componentId) {
            const callback = messageCallbacks.current.get(response.componentId)
            if (callback) {
              callback(response)
              messageCallbacks.current.delete(response.componentId)
            }
          }

          // Update message history and last message
          setMessageHistory(prev => [...prev.slice(-99), response])
          setLastMessage(response)
          
          // Call all registered message callbacks immediately
          messageCallbacksRef.current.forEach(callback => {
            try {
              callback(response)
            } catch (error) {
              log('Error in message callback', error)
            }
          })

        } catch (error) {
          log('Failed to parse WebSocket message', error)
          setError('Failed to parse message')
        }
      }

      ws.onclose = () => {
        setConnected(false)
        setConnecting(false)
        setConnectionId(null)
        log('WebSocket connection closed')

        // Auto-reconnect logic
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`)
          
          reconnectTimeout.current = window.setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else {
          setError('Max reconnection attempts reached')
        }
      }

      ws.onerror = (error) => {
        log('WebSocket error', error)
        setError('WebSocket connection error')
        setConnecting(false)
      }

    } catch (error) {
      setConnecting(false)
      setError(error instanceof Error ? error.message : 'Connection failed')
      log('Failed to create WebSocket connection', error)
    }
  }, [url, reconnectInterval, maxReconnectAttempts, log])

  const sendMessage = useCallback(async (message: WebSocketMessage): Promise<WebSocketResponse | null> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'))
        return
      }

      // CALL_ACTION doesn't expect response - send and resolve immediately
      if (message.type === 'CALL_ACTION') {
        try {
          const messageWithTimestamp = { ...message, timestamp: Date.now() }
          wsRef.current.send(JSON.stringify(messageWithTimestamp))
          log('Sent message', messageWithTimestamp)
          resolve(null) // No response expected
          return
        } catch (error) {
          reject(error)
          return
        }
      }

      // Generate unique message ID for response tracking (other message types)
      const messageId = `${message.componentId || 'msg'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Set up callback for response
      if (message.componentId) {
        messageCallbacks.current.set(message.componentId, (response) => {
          resolve(response)
        })

        // Timeout after 10 seconds
        setTimeout(() => {
          if (messageCallbacks.current.has(message.componentId!)) {
            messageCallbacks.current.delete(message.componentId!)
            reject(new Error('Message timeout'))
          }
        }, 10000)
      }

      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: Date.now()
        }
        
        wsRef.current.send(JSON.stringify(messageWithTimestamp))
        log('Sent message', messageWithTimestamp)

        // If no component ID, resolve immediately
        if (!message.componentId) {
          resolve(null)
        }
      } catch (error) {
        if (message.componentId) {
          messageCallbacks.current.delete(message.componentId)
        }
        reject(error)
      }
    })
  }, [log])

  // Send message and wait for response with unique ID
  const sendMessageAndWait = useCallback(async (
    message: WebSocketMessage, 
    timeout: number = 10000
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'))
        return
      }

      const requestId = generateRequestId()
      
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        pendingRequests.current.delete(requestId)
        reject(new Error(`Request timeout after ${timeout}ms`))
      }, timeout)

      // Store the pending request
      pendingRequests.current.set(requestId, {
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
        log('Sent message with request ID', { requestId, message: messageWithRequestId })
      } catch (error) {
        // Cleanup on send error
        clearTimeout(timeoutHandle)
        pendingRequests.current.delete(requestId)
        reject(error)
      }
    })
  }, [log, generateRequestId])

  const close = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    reconnectAttempts.current = maxReconnectAttempts // Prevent auto-reconnect
    setConnected(false)
    setConnecting(false)
    setConnectionId(null)
    log('WebSocket connection closed manually')
  }, [maxReconnectAttempts, log])

  const reconnect = useCallback(() => {
    close()
    reconnectAttempts.current = 0
    setTimeout(connect, 50) // Reduced delay from 100ms to 50ms
  }, [close, connect])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      close()
    }
  }, [autoConnect, connect, close])

  // Register message callback
  const onMessage = useCallback((callback: (message: WebSocketResponse) => void) => {
    messageCallbacksRef.current.add(callback)
    
    // Return cleanup function
    return () => {
      messageCallbacksRef.current.delete(callback)
    }
  }, [])

  return {
    connected,
    connecting,
    error,
    connectionId,
    sendMessage,
    sendMessageAndWait,
    close,
    reconnect,
    messageHistory,
    lastMessage,
    onMessage
  }
}