// 🔥 FluxStack Live Components - Enhanced Component Registry

import type {
  LiveComponent,
  LiveMessage,
  BroadcastMessage,
  ComponentDefinition,
  FluxStackWebSocket,
  FluxStackWSData
} from '@core/plugins/types'
import { stateSignature, type SignedState } from './StateSignature'
import { performanceMonitor } from './LiveComponentPerformanceMonitor'
import { liveAuthManager } from './auth/LiveAuthManager'
import { ANONYMOUS_CONTEXT } from './auth/LiveAuthContext'
import type { LiveComponentAuth, LiveActionAuthMap } from './auth/types'
import { liveLog, registerComponentLogging, unregisterComponentLogging } from './LiveLogger'
import { liveDebugger } from './LiveDebugger'
import { _setLiveDebugger, EMIT_OVERRIDE_KEY } from '@core/types/types'

// Inject debugger into types.ts (server-only) so LiveComponent class can use it
// without importing the server-side LiveDebugger module directly
_setLiveDebugger(liveDebugger)

// Enhanced interfaces for registry improvements
export interface ComponentMetadata {
  id: string
  name: string
  version: string
  mountedAt: Date
  lastActivity: Date
  state: 'mounting' | 'active' | 'inactive' | 'error' | 'destroying'
  healthStatus: 'healthy' | 'degraded' | 'unhealthy'
  dependencies: string[]
  services: Map<string, any>
  metrics: ComponentMetrics
  migrationHistory: StateMigration[]
}

export interface ComponentMetrics {
  renderCount: number
  actionCount: number
  errorCount: number
  averageRenderTime: number
  memoryUsage: number
  lastRenderTime?: number
}

export interface StateMigration {
  fromVersion: string
  toVersion: string
  migratedAt: Date
  success: boolean
  error?: string
}

export interface ComponentDependency {
  name: string
  version: string
  required: boolean
  factory: () => any
}

export interface ComponentHealthCheck {
  componentId: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: Date
  issues: string[]
  metrics: ComponentMetrics
}

export interface ServiceContainer {
  register<T>(name: string, factory: () => T): void
  resolve<T>(name: string): T
  has(name: string): boolean
}

export class ComponentRegistry {
  private components = new Map<string, LiveComponent>()
  private definitions = new Map<string, ComponentDefinition<any>>()
  private metadata = new Map<string, ComponentMetadata>()
  private rooms = new Map<string, Set<string>>() // roomId -> componentIds
  private wsConnections = new Map<string, FluxStackWebSocket>() // componentId -> websocket
  private autoDiscoveredComponents = new Map<string, new (initialState: any, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) => LiveComponent<any>>() // Auto-discovered component classes
  private dependencies = new Map<string, ComponentDependency[]>()
  private services: ServiceContainer
  private healthCheckInterval!: NodeJS.Timeout
  private recoveryStrategies = new Map<string, () => Promise<void>>()
  // Singleton components: componentName -> { instance, connections }
  private singletons = new Map<string, {
    instance: LiveComponent,
    connections: Map<string, FluxStackWebSocket>
  }>()
  
  constructor() {
    this.services = this.createServiceContainer()
    this.setupHealthMonitoring()
    this.setupRecoveryStrategies()
  }

  private createServiceContainer(): ServiceContainer {
    const services = new Map<string, any>()
    
    return {
      register<T>(name: string, factory: () => T): void {
        services.set(name, factory)
      },
      resolve<T>(name: string): T {
        const factory = services.get(name)
        if (!factory) {
          throw new Error(`Service '${name}' not found`)
        }
        return factory()
      },
      has(name: string): boolean {
        return services.has(name)
      }
    }
  }

  private setupHealthMonitoring(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, 30000)
  }

  private setupRecoveryStrategies(): void {
    // Default recovery strategy for unhealthy components
    this.recoveryStrategies.set('default', async () => {
      liveLog('lifecycle', null, '🔄 Executing default recovery strategy')
      // Restart unhealthy components
      for (const [componentId, metadata] of this.metadata) {
        if (metadata.healthStatus === 'unhealthy') {
          await this.recoverComponent(componentId)
        }
      }
    })
  }

  // Register component definition with versioning support
  registerComponent<TState>(definition: ComponentDefinition<TState>, version: string = '1.0.0') {
    // Store version separately in metadata when component is mounted
    this.definitions.set(definition.name, definition)
    liveLog('lifecycle', null, `📝 Registered component: ${definition.name} v${version}`)
  }

  // Register component dependencies
  registerDependencies(componentName: string, dependencies: ComponentDependency[]): void {
    this.dependencies.set(componentName, dependencies)
    liveLog('lifecycle', null, `🔗 Registered dependencies for ${componentName}:`, dependencies.map(d => d.name))
  }

  // Register service in DI container
  registerService<T>(name: string, factory: () => T): void {
    this.services.register(name, factory)
    liveLog('lifecycle', null, `🔧 Registered service: ${name}`)
  }

  // Register component class dynamically
  registerComponentClass(name: string, componentClass: new (initialState: any, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) => LiveComponent<any>) {
    this.autoDiscoveredComponents.set(name, componentClass)
    // Logging is handled by autoDiscoverComponents
  }

  // Auto-discover components from directory
  async autoDiscoverComponents(componentsPath: string) {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const { startGroup, endGroup, logInGroup, groupSummary } = await import('@core/utils/logger/group-logger')

      if (!fs.existsSync(componentsPath)) {
        // In production, components are already bundled - no need to auto-discover
        const { appConfig } = await import('@config')
        if (appConfig.env !== 'production') {
          liveLog('lifecycle', null, `⚠️ Components path not found: ${componentsPath}`)
        }
        return
      }

      const files = fs.readdirSync(componentsPath)
      const components: string[] = []

      // Discovery with component names collection
      for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.js')) {
          try {
            const fullPath = path.join(componentsPath, file)
            const module = await import(/* @vite-ignore */ fullPath)

            // Look for exported classes that extend LiveComponent
            Object.keys(module).forEach(exportName => {
              const exportedItem = module[exportName]
              if (typeof exportedItem === 'function' &&
                  exportedItem.prototype &&
                  this.isLiveComponentClass(exportedItem)) {

                const componentName = exportName.replace(/Component$/, '')
                this.registerComponentClass(componentName, exportedItem)
                components.push(componentName)
              }
            })
          } catch (error) {
            // Silent - only log in debug mode
          }
        }
      }

      // Components are now displayed in the startup banner
      // No need to log here to avoid duplication
    } catch (error) {
      console.error('❌ Auto-discovery failed:', error)
    }
  }

  // Check if a class extends LiveComponent
  private isLiveComponentClass(cls: any): boolean {
    try {
      let prototype = cls.prototype
      while (prototype) {
        if (prototype.constructor.name === 'LiveComponent') {
          return true
        }
        prototype = Object.getPrototypeOf(prototype)
      }
      return false
    } catch {
      return false
    }
  }

  // Enhanced component mounting with lifecycle management
  async mountComponent(
    ws: FluxStackWebSocket,
    componentName: string,
    props: Record<string, unknown> = {},
    options?: { room?: string; userId?: string; version?: string; debugLabel?: string }
  ): Promise<{ componentId: string; initialState: unknown; signedState: unknown }> {
    const startTime = Date.now()
    
    try {
      // Validate dependencies
      await this.validateDependencies(componentName)
      
      // Try to find component definition first
      const definition = this.definitions.get(componentName)
      let ComponentClass: (new (initialState: any, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) => LiveComponent<any>) | null = null
      let initialState: Record<string, unknown> = {}

      if (definition) {
        // Use registered definition
        ComponentClass = definition.component
        initialState = definition.initialState as Record<string, unknown>
      } else {
        // Try auto-discovered components
        ComponentClass = this.autoDiscoveredComponents.get(componentName) ?? null
        if (!ComponentClass) {
          // Try variations of the name
          const variations = [
            componentName + 'Component',
            componentName.charAt(0).toUpperCase() + componentName.slice(1) + 'Component',
            componentName.charAt(0).toUpperCase() + componentName.slice(1)
          ]

          for (const variation of variations) {
            ComponentClass = this.autoDiscoveredComponents.get(variation) ?? null
            if (ComponentClass) break
          }
        }

        if (!ComponentClass) {
          throw new Error(`Component '${componentName}' not found`)
        }

      // Create a default initial state for auto-discovered components
      initialState = {}
    }

    // 🔒 Auth check: Verify component-level authorization
    const authContext = ws.data?.authContext || ANONYMOUS_CONTEXT
    const componentAuth = (ComponentClass as any).auth as LiveComponentAuth | undefined
    const authResult = liveAuthManager.authorizeComponent(authContext, componentAuth)
    if (!authResult.allowed) {
      throw new Error(`AUTH_DENIED: ${authResult.reason}`)
    }

    // 🔗 Singleton check: return existing instance if already created
    const isSingleton = (ComponentClass as any).singleton === true
    if (isSingleton) {
      const existing = this.singletons.get(componentName)
      if (existing) {
        // Add this ws connection to the singleton
        const connId = ws.data?.connectionId || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        existing.connections.set(connId, ws)

        // Initialize WebSocket data if needed
        this.ensureWsData(ws, options?.userId)
        ws.data.components.set(existing.instance.id, existing.instance)

        // Send current state to the new client
        const signedState = await stateSignature.signState(existing.instance.id, {
          ...existing.instance.getSerializableState(),
          __componentName: componentName
        }, 1, { compress: true, backup: true })

        ws.send(JSON.stringify({
          type: 'STATE_UPDATE',
          componentId: existing.instance.id,
          payload: { state: existing.instance.getSerializableState(), signedState },
          timestamp: Date.now()
        }))

        liveLog('lifecycle', existing.instance.id, `🔗 Singleton '${componentName}' — new connection joined (${existing.connections.size} total)`)

        // 🔄 Lifecycle: notify singleton about new client
        try { (existing.instance as any).onClientJoin(connId, existing.connections.size) } catch (err: any) {
          console.error(`[${componentName}] onClientJoin error:`, err?.message || err)
        }

        return {
          componentId: existing.instance.id,
          initialState: existing.instance.getSerializableState(),
          signedState
        }
      }
    }

    // Create component instance with registry methods
    const component = new ComponentClass(
      { ...initialState, ...props },
      ws,
      options
    )

    // 🔒 Inject auth context into component
    component.setAuthContext(authContext)

    // Inject registry methods
    component.broadcastToRoom = (message: BroadcastMessage) => {
      this.broadcastToRoom(message, component.id)
    }

    // Create and store component metadata
    const metadata = this.createComponentMetadata(component.id, componentName, options?.version)
    this.metadata.set(component.id, metadata)

    // Inject services into component
    const dependencies = this.dependencies.get(componentName) || []
    for (const dep of dependencies) {
      if (this.services.has(dep.name)) {
        const service = this.services.resolve(dep.name)
        metadata.services.set(dep.name, service)
        // Inject service into component if it has a setter
        if (typeof (component as any)[`set${dep.name}`] === 'function') {
          (component as any)[`set${dep.name}`](service)
        }
      }
    }

    // Store component and connection
    this.components.set(component.id, component)
    this.wsConnections.set(component.id, ws)

    // Subscribe to room if specified
    if (options?.room) {
      this.subscribeToRoom(component.id, options.room)
    }

    // Initialize WebSocket data if needed
    this.ensureWsData(ws, options?.userId)
    ws.data.components.set(component.id, component)

    // 🔗 Register singleton with broadcast emit
    if (isSingleton) {
      const connId = ws.data.connectionId || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const connections = new Map<string, FluxStackWebSocket>()
      connections.set(connId, ws)
      this.singletons.set(componentName, { instance: component, connections })

      // Override emit to broadcast to all connections (via Symbol key)
      ;(component as any)[EMIT_OVERRIDE_KEY] = (type: string, payload: any) => {
        const message: LiveMessage = {
          type: type as any,
          componentId: component.id,
          payload,
          timestamp: Date.now(),
          userId: component.userId,
          room: component.room
        }
        const serialized = JSON.stringify(message)
        const singleton = this.singletons.get(componentName)
        if (singleton) {
          const deadConnections: string[] = []
          for (const [connId, connWs] of singleton.connections) {
            try { connWs.send(serialized) } catch {
              deadConnections.push(connId)
            }
          }
          // Remove dead connections
          for (const connId of deadConnections) {
            singleton.connections.delete(connId)
            liveLog('lifecycle', component.id, `🔗 Singleton '${componentName}' — removed dead connection '${connId}'`)
          }
        }
      }

      liveLog('lifecycle', component.id, `🔗 Singleton '${componentName}' created`)

      // 🔄 Lifecycle: notify singleton about first client
      try { (component as any).onClientJoin(connId, 1) } catch (err: any) {
        console.error(`[${componentName}] onClientJoin error:`, err?.message || err)
      }
    }

    // Update metadata state
    metadata.state = 'active'
    const renderTime = Date.now() - startTime
    this.recordComponentMetrics(component.id, renderTime)

    // Register per-component logging config
    const loggingConfig = (ComponentClass as any).logging
    registerComponentLogging(component.id, loggingConfig)

    // Initialize performance monitoring
    performanceMonitor.initializeComponent(component.id, componentName)
    performanceMonitor.recordRenderTime(component.id, renderTime)

    liveLog('lifecycle', component.id, `🚀 Mounted component: ${componentName} (${component.id}) in ${renderTime}ms`)

    // Send initial state to client with signature (include component name for rehydration validation)
    const signedState = await stateSignature.signState(component.id, {
      ...component.getSerializableState(),
      __componentName: componentName
    }, 1, {
      compress: true,
      backup: true
    })
    ;(component as any).emit('STATE_UPDATE', {
      state: component.getSerializableState(),
      signedState
    })

    // 🔄 Lifecycle hooks
    try { (component as any).onConnect() } catch (err: any) {
      console.error(`[${componentName}] onConnect error:`, err?.message || err)
    }
    try {
      await (component as any).onMount()
    } catch (err: any) {
      console.error(`[${componentName}] onMount error:`, err?.message || err)
      // Notify client that mount initialization failed
      ;(component as any).emit('ERROR', {
        action: 'onMount',
        error: `Mount initialization failed: ${err?.message || err}`
      })
    }

    // Debug: track component mount
    liveDebugger.trackComponentMount(
      component.id,
      componentName,
      component.getSerializableState() as Record<string, unknown>,
      options?.room,
      options?.debugLabel
    )

    // Return component ID with signed state for immediate persistence
    return {
      componentId: component.id,
      initialState: component.getSerializableState(),
      signedState
    }
    } catch (error: any) {
      console.error(`❌ Failed to mount component ${componentName}:`, error)
      throw error
    }
  }

  // Re-hydrate component with signed client state
  async rehydrateComponent(
    componentId: string,
    componentName: string,
    signedState: SignedState,
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ): Promise<{ success: boolean; newComponentId?: string; error?: string }> {
    liveLog('lifecycle', componentId, '🔄 Attempting component re-hydration:', {
      oldComponentId: componentId,
      componentName,
      signedState: {
        timestamp: signedState.timestamp,
        version: signedState.version,
        signature: signedState.signature.substring(0, 16) + '...'
      }
    })

    try {
      // Validate signed state integrity
      const validation = await stateSignature.validateState(signedState)
      if (!validation.valid) {
        liveLog('lifecycle', componentId, '❌ State signature validation failed:', validation.error)
        return {
          success: false,
          error: validation.error || 'Invalid state signature'
        }
      }

      // Try to find component definition (same logic as mountComponent)
      const definition = this.definitions.get(componentName)
      let ComponentClass: (new (initialState: any, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) => LiveComponent<any>) | null = null
      let initialState: Record<string, unknown> = {}

      if (definition) {
        // Use registered definition
        ComponentClass = definition.component
        initialState = definition.initialState as Record<string, unknown>
      } else {
        // Try auto-discovered components
        ComponentClass = this.autoDiscoveredComponents.get(componentName) ?? null
        if (!ComponentClass) {
          // Try variations of the name
          const variations = [
            componentName + 'Component',
            componentName.charAt(0).toUpperCase() + componentName.slice(1) + 'Component',
            componentName.charAt(0).toUpperCase() + componentName.slice(1)
          ]

          for (const variation of variations) {
            ComponentClass = this.autoDiscoveredComponents.get(variation) ?? null
            if (ComponentClass) break
          }
        }

        if (!ComponentClass) {
          return {
            success: false,
            error: `Component '${componentName}' not found`
          }
        }
      }

      // 🔒 Auth check on rehydration
      const authContext = ws.data?.authContext || ANONYMOUS_CONTEXT
      const componentAuth = (ComponentClass as any).auth as LiveComponentAuth | undefined
      const authResult = liveAuthManager.authorizeComponent(authContext, componentAuth)
      if (!authResult.allowed) {
        return { success: false, error: `AUTH_DENIED: ${authResult.reason}` }
      }

      // Extract validated state
      const clientState = await stateSignature.extractData(signedState) as Record<string, any>

      // 🔒 Security: Validate component name matches the signed state to prevent cross-component rehydration
      if (clientState.__componentName && clientState.__componentName !== componentName) {
        liveLog('lifecycle', componentId, '❌ Component name mismatch in rehydration - possible tampering:', {
          expected: clientState.__componentName,
          received: componentName
        })
        return {
          success: false,
          error: 'Component class mismatch - state tampering detected'
        }
      }

      // Remove internal metadata before passing to component
      const { __componentName, ...cleanState } = clientState

      // Create new component instance with client state (merge with initial state if from definition)
      const finalState = definition ? { ...initialState, ...cleanState } : cleanState
      const component = new ComponentClass(finalState, ws, options)

      // 🔒 Inject auth context
      component.setAuthContext(authContext)

      // Store component
      this.components.set(component.id, component)
      this.wsConnections.set(component.id, ws)

      // Setup room if specified
      if (options?.room) {
        this.subscribeToRoom(component.id, options.room)
      }

      // Initialize WebSocket data
      this.ensureWsData(ws, options?.userId)
      ws.data.components.set(component.id, component)

      // Register logging config for rehydrated component
      const rehydrateLoggingConfig = (ComponentClass as any).logging
      registerComponentLogging(component.id, rehydrateLoggingConfig)

      liveLog('lifecycle', component.id, '✅ Component re-hydrated successfully:', {
        oldComponentId: componentId,
        newComponentId: component.id,
        componentName,
        stateVersion: signedState.version
      })
      
      // Send updated state to client (with new signature, include component name)
      const newSignedState = await stateSignature.signState(
        component.id,
        { ...component.getSerializableState(), __componentName: componentName },
        signedState.version + 1
      )
      
      // Use type assertion to access protected emit method
      ;(component as unknown as { emit: (type: string, payload: unknown) => void }).emit('STATE_REHYDRATED', {
        state: component.getSerializableState(),
        signedState: newSignedState,
        oldComponentId: componentId,
        newComponentId: component.id
      })

      // 🔄 Lifecycle hooks after rehydration
      try { (component as any).onConnect() } catch (err: any) {
        console.error(`[${componentName}] onConnect error (rehydration):`, err?.message || err)
      }
      try { (component as any).onRehydrate(clientState) } catch (err: any) {
        console.error(`[${componentName}] onRehydrate error:`, err?.message || err)
      }
      try {
        await (component as any).onMount()
      } catch (err: any) {
        console.error(`[${componentName}] onMount error (rehydration):`, err?.message || err)
        ;(component as any).emit('ERROR', {
          action: 'onMount',
          error: `Mount initialization failed (rehydration): ${err?.message || err}`
        })
      }

      return {
        success: true,
        newComponentId: component.id
      }

    } catch (error: any) {
      console.error('❌ Component re-hydration failed:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Ensure WebSocket data object exists with proper structure
  private ensureWsData(ws: FluxStackWebSocket, userId?: string): void {
    if (!ws || typeof ws !== 'object') {
      throw new Error('Invalid WebSocket object provided')
    }
    if (!ws.data) {
      (ws as { data: FluxStackWSData }).data = {
        connectionId: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        components: new Map(),
        subscriptions: new Set(),
        connectedAt: new Date(),
        userId
      }
    }
    if (!ws.data.components) {
      ws.data.components = new Map()
    }
  }

  /** Check if a component ID belongs to a singleton */
  private isSingletonComponent(componentId: string): boolean {
    for (const [, singleton] of this.singletons) {
      if (singleton.instance.id === componentId) return true
    }
    return false
  }

  /** Get the singleton entry by component ID */
  private getSingletonByComponentId(componentId: string): { instance: LiveComponent; connections: Map<string, FluxStackWebSocket> } | null {
    for (const [, singleton] of this.singletons) {
      if (singleton.instance.id === componentId) return singleton
    }
    return null
  }

  /**
   * Remove a single connection from a singleton. If no connections remain, destroy it.
   * @returns true if the component was a singleton (handled), false otherwise
   */
  private removeSingletonConnection(componentId: string, connId?: string, context = 'unmount'): boolean {
    for (const [name, singleton] of this.singletons) {
      if (singleton.instance.id !== componentId) continue

      if (connId) singleton.connections.delete(connId)

      if (singleton.connections.size === 0) {
        // Last connection gone — call onDisconnect then destroy singleton fully
        try { (singleton.instance as any).onDisconnect() } catch (err: any) {
          console.error(`[${componentId}] onDisconnect error:`, err?.message || err)
        }
        this.cleanupComponent(componentId)
        this.singletons.delete(name)
        liveLog('lifecycle', componentId, `🗑️ Singleton '${name}' destroyed (${context}: no connections remaining)`)
      } else {
        liveLog('lifecycle', componentId, `🔗 Singleton '${name}' — connection removed via ${context} (${singleton.connections.size} remaining)`)
      }
      return true
    }
    return false
  }

  // Unmount component (with singleton awareness)
  async unmountComponent(componentId: string, ws?: FluxStackWebSocket) {
    const component = this.components.get(componentId)
    if (!component) return

    // 🔗 Singleton: remove connection, only destroy when last client leaves
    if (ws) {
      const connId = ws.data?.connectionId
      ws.data?.components?.delete(componentId)

      // Notify singleton about client leaving (before connection removal)
      if (this.isSingletonComponent(componentId)) {
        const singleton = this.getSingletonByComponentId(componentId)
        const remainingAfterRemoval = singleton ? singleton.connections.size - 1 : 0
        try { (component as any).onClientLeave(connId || 'unknown', Math.max(0, remainingAfterRemoval)) } catch (err: any) {
          console.error(`[${componentId}] onClientLeave error:`, err?.message || err)
        }
      }

      if (this.removeSingletonConnection(componentId, connId, 'unmount')) return
    } else {
      if (this.removeSingletonConnection(componentId, undefined, 'unmount')) return
    }

    // Non-singleton: normal unmount
    liveDebugger.trackComponentUnmount(componentId)
    component.destroy?.()
    this.unsubscribeFromAllRooms(componentId)
    this.components.delete(componentId)
    this.wsConnections.delete(componentId)

    liveLog('lifecycle', componentId, `🗑️ Unmounted component: ${componentId}`)
    unregisterComponentLogging(componentId)
  }

  // Execute action on component
  async executeAction(componentId: string, action: string, payload: any): Promise<any> {
    const component = this.components.get(componentId)
    if (!component) {
      liveLog('lifecycle', componentId, `🔄 Component '${componentId}' not found - triggering re-hydration request`)
      // Return special error that triggers re-hydration on client
      throw new Error(`COMPONENT_REHYDRATION_REQUIRED:${componentId}`)
    }

    // 🔒 Auth check: Verify action-level authorization
    const componentClass = component.constructor as any
    const actionAuthMap = componentClass.actionAuth as LiveActionAuthMap | undefined
    const actionAuth = actionAuthMap?.[action]

    if (actionAuth) {
      const authContext = (component as any).$auth || ANONYMOUS_CONTEXT
      const componentName = componentClass.componentName || componentClass.name
      const authResult = await liveAuthManager.authorizeAction(
        authContext,
        componentName,
        action,
        actionAuth
      )
      if (!authResult.allowed) {
        throw new Error(`AUTH_DENIED: ${authResult.reason}`)
      }
    }

    try {
      return await component.executeAction?.(action, payload)
    } catch (error: any) {
      console.error(`❌ Error executing action '${action}' on component '${componentId}':`, error.message)
      throw error
    }
  }

  // Update component property
  updateProperty(componentId: string, property: string, value: any) {
    const component = this.components.get(componentId)
    if (!component) {
      throw new Error(`Component '${componentId}' not found`)
    }

    // Update state
    const updates = { [property]: value }
    component.setState?.(updates)

    liveLog('state', componentId, `📝 Updated property '${property}' on component '${componentId}'`)
  }

  // Subscribe component to room
  subscribeToRoom(componentId: string, roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set())
    }
    
    this.rooms.get(roomId)!.add(componentId)
    liveLog('rooms', componentId, `📡 Component '${componentId}' subscribed to room '${roomId}'`)
  }

  // Unsubscribe component from room
  unsubscribeFromRoom(componentId: string, roomId: string) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.delete(componentId)
      if (room.size === 0) {
        this.rooms.delete(roomId)
      }
    }
    liveLog('rooms', componentId, `📡 Component '${componentId}' unsubscribed from room '${roomId}'`)
  }

  // Unsubscribe from all rooms
  private unsubscribeFromAllRooms(componentId: string) {
    for (const [roomId, components] of Array.from(this.rooms.entries())) {
      if (components.has(componentId)) {
        this.unsubscribeFromRoom(componentId, roomId)
      }
    }
  }

  // Broadcast message to room
  broadcastToRoom(message: BroadcastMessage, senderComponentId?: string) {
    if (!message.room) return

    const roomComponents = this.rooms.get(message.room)
    if (!roomComponents) return

    const broadcastMessage: LiveMessage = {
      type: 'BROADCAST',
      componentId: senderComponentId || 'system',
      payload: {
        type: message.type,
        data: message.payload
      },
      timestamp: Date.now(),
      room: message.room
    }

    let broadcastCount = 0
    
    for (const componentId of Array.from(roomComponents)) {
      // Skip sender if excludeUser is specified
      const component = this.components.get(componentId)
      if (message.excludeUser && component?.userId === message.excludeUser) {
        continue
      }

      const ws = this.wsConnections.get(componentId)
      if (ws && ws.send) {
        ws.send(JSON.stringify(broadcastMessage))
        broadcastCount++
      }
    }

    liveLog('rooms', senderComponentId ?? null, `📡 Broadcast '${message.type}' to room '${message.room}': ${broadcastCount} recipients`)
  }

  // Handle WebSocket message with enhanced metrics and lifecycle tracking
  async handleMessage(ws: FluxStackWebSocket, message: LiveMessage): Promise<{ success: boolean; result?: unknown; error?: string } | null> {
    const startTime = Date.now()
    
    try {
      // Update component activity
      if (message.componentId) {
        this.updateComponentActivity(message.componentId)
      }

      switch (message.type) {
        case 'COMPONENT_MOUNT':
          const mountResult = await this.mountComponent(
            ws,
            message.payload.component,
            message.payload.props,
            {
              room: message.payload.room,
              userId: message.userId,
              debugLabel: message.payload.debugLabel
            }
          )
          return { success: true, result: mountResult }

        case 'COMPONENT_UNMOUNT':
          await this.unmountComponent(message.componentId, ws)
          return { success: true }

        case 'CALL_ACTION':
          // Record action metrics
          this.recordComponentMetrics(message.componentId, undefined, message.action)
          
          // Execute action with performance monitoring
          const actionStartTime = Date.now()
          let actionError: Error | undefined
          
          try {
            const actionResult = await this.executeAction(
              message.componentId,
              message.action!,
              message.payload
            )
            
            // Record successful action performance
            const actionTime = Date.now() - actionStartTime
            performanceMonitor.recordActionTime(message.componentId, message.action!, actionTime)
            
            // If client expects response, return it
            if (message.expectResponse) {
              return { success: true, result: actionResult }
            }
            
            // Otherwise no return - if state changed, component will emit STATE_UPDATE automatically
            return null
          } catch (error) {
            actionError = error as Error
            const actionTime = Date.now() - actionStartTime
            performanceMonitor.recordActionTime(message.componentId, message.action!, actionTime, actionError)
            throw error
          }


        case 'PROPERTY_UPDATE':
          this.updateProperty(
            message.componentId,
            message.property!,
            message.payload.value
          )
          return { success: true }

        default:
          console.warn(`⚠️ Unknown message type: ${message.type}`)
          return { success: false, error: 'Unknown message type' }
      }
    } catch (error: any) {
      console.error('❌ Registry error:', error.message)
      
      // Record error metrics if component ID is available
      if (message.componentId) {
        this.recordComponentError(message.componentId, error)
      }
      
      // Return error for handleActionCall to process
      return { success: false, error: error.message }
    } finally {
      // Record processing time
      const processingTime = Date.now() - startTime
      if (message.componentId && processingTime > 0) {
        this.recordComponentMetrics(message.componentId, processingTime)
      }
    }
  }

  // Cleanup when WebSocket disconnects (singleton-aware)
  cleanupConnection(ws: FluxStackWebSocket) {
    if (!ws.data?.components) return

    const componentsToCleanup = Array.from(ws.data.components.keys()) as string[]
    const connId = ws.data.connectionId

    liveLog('lifecycle', null, `🧹 Cleaning up ${componentsToCleanup.length} components for disconnected WebSocket`)

    for (const componentId of componentsToCleanup) {
      const component = this.components.get(componentId)

      // Check if this is a singleton component
      const isSingleton = this.isSingletonComponent(componentId)

      if (component && isSingleton) {
        // For singletons: call onClientLeave (per-connection) instead of onDisconnect
        // onDisconnect only fires when the last client leaves (handled in removeSingletonConnection)
        const singleton = this.getSingletonByComponentId(componentId)
        const remainingAfterRemoval = singleton ? singleton.connections.size - 1 : 0
        try { (component as any).onClientLeave(connId || 'unknown', Math.max(0, remainingAfterRemoval)) } catch (err: any) {
          console.error(`[${componentId}] onClientLeave error:`, err?.message || err)
        }
      } else if (component) {
        // Non-singleton: call onDisconnect as before
        try { (component as any).onDisconnect() } catch (err: any) {
          console.error(`[${componentId}] onDisconnect error:`, err?.message || err)
        }
      }

      // Singleton-aware cleanup via shared helper
      if (!this.removeSingletonConnection(componentId, connId || undefined, 'disconnect')) {
        this.cleanupComponent(componentId)
      }
    }

    // Clear the WebSocket's component map
    ws.data.components.clear()

    liveLog('lifecycle', null, `🧹 Cleaned up ${componentsToCleanup.length} components from disconnected WebSocket`)
  }

  // Get statistics
  getStats() {
    return {
      components: this.components.size,
      definitions: this.definitions.size,
      rooms: this.rooms.size,
      connections: this.wsConnections.size,
      singletons: Object.fromEntries(
        Array.from(this.singletons.entries()).map(([name, s]) => [
          name,
          { componentId: s.instance.id, connections: s.connections.size }
        ])
      ),
      roomDetails: Object.fromEntries(
        Array.from(this.rooms.entries()).map(([roomId, components]) => [
          roomId,
          components.size
        ])
      )
    }
  }

  // Get registered component names
  getRegisteredComponentNames(): string[] {
    const definitionNames = Array.from(this.definitions.keys())
    const autoDiscoveredNames = Array.from(this.autoDiscoveredComponents.keys())
    return [...new Set([...definitionNames, ...autoDiscoveredNames])]
  }

  // Get component by ID
  getComponent(componentId: string): LiveComponent | undefined {
    return this.components.get(componentId)
  }

  // Get all components in room
  getRoomComponents(roomId: string): LiveComponent[] {
    const componentIds = this.rooms.get(roomId) || new Set()
    return Array.from(componentIds)
      .map(id => this.components.get(id))
      .filter(Boolean) as LiveComponent[]
  }
  // Validate component dependencies
  private async validateDependencies(componentName: string): Promise<void> {
    const dependencies = this.dependencies.get(componentName)
    if (!dependencies) return

    for (const dep of dependencies) {
      if (dep.required && !this.services.has(dep.name)) {
        throw new Error(`Required dependency '${dep.name}' not found for component '${componentName}'`)
      }
    }
  }

  // Create component metadata
  private createComponentMetadata(componentId: string, componentName: string, version: string = '1.0.0'): ComponentMetadata {
    return {
      id: componentId,
      name: componentName,
      version,
      mountedAt: new Date(),
      lastActivity: new Date(),
      state: 'mounting',
      healthStatus: 'healthy',
      dependencies: this.dependencies.get(componentName)?.map(d => d.name) || [],
      services: new Map(),
      metrics: {
        renderCount: 0,
        actionCount: 0,
        errorCount: 0,
        averageRenderTime: 0,
        memoryUsage: 0
      },
      migrationHistory: []
    }
  }

  // Update component activity
  updateComponentActivity(componentId: string): boolean {
    const metadata = this.metadata.get(componentId)
    if (metadata) {
      metadata.lastActivity = new Date()
      metadata.state = 'active'
      return true
    }
    return false
  }

  // Record component metrics
  recordComponentMetrics(componentId: string, renderTime?: number, action?: string): void {
    const metadata = this.metadata.get(componentId)
    if (!metadata) return

    if (renderTime) {
      metadata.metrics.renderCount++
      metadata.metrics.averageRenderTime = 
        (metadata.metrics.averageRenderTime * (metadata.metrics.renderCount - 1) + renderTime) / metadata.metrics.renderCount
      metadata.metrics.lastRenderTime = renderTime
    }

    if (action) {
      metadata.metrics.actionCount++
    }

    this.updateComponentActivity(componentId)
  }

  // Record component error
  recordComponentError(componentId: string, error: Error): void {
    const metadata = this.metadata.get(componentId)
    if (metadata) {
      metadata.metrics.errorCount++
      metadata.healthStatus = metadata.metrics.errorCount > 5 ? 'unhealthy' : 'degraded'
      console.error(`❌ Component ${componentId} error:`, error.message)
    }
  }

  // Perform health checks on all components
  private async performHealthChecks(): Promise<void> {
    const healthChecks: ComponentHealthCheck[] = []
    
    for (const [componentId, metadata] of this.metadata) {
      const component = this.components.get(componentId)
      if (!component) continue

      const issues: string[] = []
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

      // Check if component is responsive
      const timeSinceLastActivity = Date.now() - metadata.lastActivity.getTime()
      if (timeSinceLastActivity > 300000) { // 5 minutes
        issues.push('Component inactive for more than 5 minutes')
        status = 'degraded'
      }

      // Check error rate
      if (metadata.metrics.errorCount > 10) {
        issues.push('High error rate detected')
        status = 'unhealthy'
      }

      // Check memory usage (if available)
      if (metadata.metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
        issues.push('High memory usage detected')
        status = 'degraded'
      }

      metadata.healthStatus = status

      healthChecks.push({
        componentId,
        status,
        lastCheck: new Date(),
        issues,
        metrics: { ...metadata.metrics }
      })
    }

    // Log unhealthy components
    const unhealthyComponents = healthChecks.filter(hc => hc.status === 'unhealthy')
    if (unhealthyComponents.length > 0) {
      console.warn(`⚠️ Found ${unhealthyComponents.length} unhealthy components:`, 
        unhealthyComponents.map(hc => hc.componentId))
      
      // Trigger recovery if needed
      await this.triggerRecovery()
    }
  }

  // Trigger recovery for unhealthy components
  private async triggerRecovery(): Promise<void> {
    const defaultStrategy = this.recoveryStrategies.get('default')
    if (defaultStrategy) {
      try {
        await defaultStrategy()
      } catch (error) {
        console.error('❌ Recovery strategy failed:', error)
      }
    }
  }

  // Recover a specific component
  private async recoverComponent(componentId: string): Promise<void> {
    const metadata = this.metadata.get(componentId)
    const component = this.components.get(componentId)
    
    if (!metadata || !component) return

    try {
      liveLog('lifecycle', componentId, `🔄 Recovering component ${componentId}`)
      
      // Reset error count
      metadata.metrics.errorCount = 0
      metadata.healthStatus = 'healthy'
      metadata.state = 'active'
      
      // Emit recovery event to client using the protected emit method
      ;(component as any).emit('COMPONENT_RECOVERED', {
        componentId,
        timestamp: Date.now()
      })
      
    } catch (error) {
      console.error(`❌ Failed to recover component ${componentId}:`, error)
      metadata.state = 'error'
    }
  }

  // Migrate component state to new version
  async migrateComponentState(componentId: string, fromVersion: string, toVersion: string, migrationFn: (state: any) => any): Promise<boolean> {
    const component = this.components.get(componentId)
    const metadata = this.metadata.get(componentId)
    
    if (!component || !metadata) return false

    try {
      liveLog('lifecycle', componentId, `🔄 Migrating component ${componentId} from v${fromVersion} to v${toVersion}`)
      
      const oldState = component.getSerializableState?.()
      const newState = migrationFn(oldState)

      // Update component state
      component.setState?.(newState)
      
      // Record migration
      const migration: StateMigration = {
        fromVersion,
        toVersion,
        migratedAt: new Date(),
        success: true
      }
      
      metadata.migrationHistory.push(migration)
      metadata.version = toVersion
      
      liveLog('lifecycle', componentId, `✅ Successfully migrated component ${componentId}`)
      return true
      
    } catch (error: any) {
      console.error(`❌ Migration failed for component ${componentId}:`, error)
      
      const migration: StateMigration = {
        fromVersion,
        toVersion,
        migratedAt: new Date(),
        success: false,
        error: error.message
      }
      
      metadata?.migrationHistory.push(migration)
      return false
    }
  }

  // Get component health status
  getComponentHealth(componentId: string): ComponentHealthCheck | null {
    const metadata = this.metadata.get(componentId)
    if (!metadata) return null

    return {
      componentId,
      status: metadata.healthStatus,
      lastCheck: new Date(),
      issues: [],
      metrics: { ...metadata.metrics }
    }
  }

  // Get all component health statuses
  getAllComponentHealth(): ComponentHealthCheck[] {
    return Array.from(this.metadata.values()).map(metadata => ({
      componentId: metadata.id,
      status: metadata.healthStatus,
      lastCheck: new Date(),
      issues: [],
      metrics: { ...metadata.metrics }
    }))
  }

  // Cleanup method to be called on shutdown
  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    // Cleanup all singletons
    this.singletons.clear()

    // Cleanup all components
    for (const [componentId] of this.components) {
      this.cleanupComponent(componentId)
    }
  }

  // Enhanced cleanup for individual components
  private cleanupComponent(componentId: string): void {
    const component = this.components.get(componentId)
    const metadata = this.metadata.get(componentId)
    
    if (component) {
      try {
        component.destroy?.()
      } catch (error) {
        console.error(`❌ Error destroying component ${componentId}:`, error)
      }
    }
    
    if (metadata) {
      metadata.state = 'destroying'
    }
    
    // Remove from performance monitoring and logging
    performanceMonitor.removeComponent(componentId)
    unregisterComponentLogging(componentId)

    this.components.delete(componentId)
    this.metadata.delete(componentId)
    this.wsConnections.delete(componentId)
    
    // Remove from rooms
    for (const [roomId, componentIds] of this.rooms) {
      componentIds.delete(componentId)
      if (componentIds.size === 0) {
        this.rooms.delete(roomId)
      }
    }
  }
}

// Global registry instance
export const componentRegistry = new ComponentRegistry()