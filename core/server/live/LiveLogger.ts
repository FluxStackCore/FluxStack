// 🔇 FluxStack Live Component Logger
// Per-component logging control. Silent by default — opt-in via static logging property.
//
// Usage in LiveComponent subclass:
//   static logging = true                           // all categories
//   static logging = ['lifecycle', 'messages']      // specific categories only
//   // (omit or set false → silent)
//
// Categories:
//   lifecycle    — mount, unmount, rehydration, recovery, migration
//   messages     — received/sent WebSocket messages, file uploads
//   state        — signing, backup, compression, encryption, validation
//   performance  — monitoring init, alerts, optimization suggestions
//   rooms        — room create/join/leave, emit, broadcast
//   websocket    — connection open/close, auth
//
// Global (non-component) logs controlled by LIVE_LOGGING env var:
//   LIVE_LOGGING=true                → all global logs
//   LIVE_LOGGING=lifecycle,rooms     → only these categories globally
//   (unset or 'false')              → silent (default)

export type LiveLogCategory = 'lifecycle' | 'messages' | 'state' | 'performance' | 'rooms' | 'websocket'

export type LiveLogConfig = boolean | LiveLogCategory[]

// Registry: componentId → resolved logging config
const componentConfigs = new Map<string, LiveLogConfig>()

// Parse global config from env (lazy, cached)
let globalConfigParsed = false
let globalConfig: LiveLogConfig = false

function parseGlobalConfig(): LiveLogConfig {
  if (globalConfigParsed) return globalConfig
  globalConfigParsed = true

  const envValue = process.env.LIVE_LOGGING
  if (!envValue || envValue === 'false') {
    globalConfig = false
  } else if (envValue === 'true') {
    globalConfig = true
  } else {
    // Comma-separated categories: "lifecycle,rooms,messages"
    globalConfig = envValue.split(',').map(s => s.trim()).filter(Boolean) as LiveLogCategory[]
  }
  return globalConfig
}

/**
 * Register a component's logging config (called on mount)
 */
export function registerComponentLogging(componentId: string, config: LiveLogConfig | undefined): void {
  if (config !== undefined && config !== false) {
    componentConfigs.set(componentId, config)
  }
}

/**
 * Unregister component logging (called on unmount/cleanup)
 */
export function unregisterComponentLogging(componentId: string): void {
  componentConfigs.delete(componentId)
}

/**
 * Check if a log should be emitted for a given component + category
 */
function shouldLog(componentId: string | null, category: LiveLogCategory): boolean {
  if (componentId) {
    const config = componentConfigs.get(componentId)
    if (config === undefined || config === false) return false
    if (config === true) return true
    return config.includes(category)
  }
  // Global log (no specific component)
  const cfg = parseGlobalConfig()
  if (cfg === false) return false
  if (cfg === true) return true
  return cfg.includes(category)
}

/**
 * Log a message gated by the component's logging config.
 *
 * @param category  - Log category
 * @param componentId - Component ID, or null for global logs
 * @param message   - Message string (may include emoji)
 * @param args      - Extra arguments (objects, etc.)
 */
export function liveLog(category: LiveLogCategory, componentId: string | null, message: string, ...args: unknown[]): void {
  if (shouldLog(componentId, category)) {
    if (args.length > 0) {
      console.log(message, ...args)
    } else {
      console.log(message)
    }
  }
}

/**
 * Warn-level log gated by config (for non-error informational warnings like perf alerts)
 */
export function liveWarn(category: LiveLogCategory, componentId: string | null, message: string, ...args: unknown[]): void {
  if (shouldLog(componentId, category)) {
    if (args.length > 0) {
      console.warn(message, ...args)
    } else {
      console.warn(message)
    }
  }
}
