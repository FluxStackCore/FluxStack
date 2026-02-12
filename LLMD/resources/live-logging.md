# Live Logging

**Version:** 1.12.0 | **Updated:** 2025-02-12

## Quick Facts

- Per-component logging control — silent by default
- Opt-in via `static logging` property on LiveComponent subclasses
- 6 categories: `lifecycle`, `messages`, `state`, `performance`, `rooms`, `websocket`
- Global (non-component) logs controlled by `LIVE_LOGGING` env var
- `console.error` always visible regardless of config

## Usage

### Enable Logging on a Component

```typescript
// app/server/live/LiveCounter.ts
export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'

  // ✅ All categories
  static logging = true

  // ✅ Specific categories only
  static logging = ['lifecycle', 'messages', 'state', 'rooms'] as const

  // ✅ Silent (default — omit property or set false)
  // static logging = false
}
```

### Global Logs (Non-Component)

Logs not tied to a specific component (room cleanup, key rotation, etc.) are controlled by the `LIVE_LOGGING` env var:

```bash
# .env
LIVE_LOGGING=true                  # All global logs
LIVE_LOGGING=lifecycle,rooms       # Specific categories only
# (unset or 'false')              # Silent (default)
```

## Categories

| Category | What It Logs |
|----------|-------------|
| `lifecycle` | Mount, unmount, rehydration, recovery, migration |
| `messages` | Received/sent WebSocket messages, file uploads |
| `state` | Signing, backup, compression, encryption, validation |
| `performance` | Monitoring init, alerts, optimization suggestions |
| `rooms` | Room create/join/leave, emit, broadcast |
| `websocket` | Connection open/close, auth |

## Type Definition

```typescript
type LiveLogCategory = 'lifecycle' | 'messages' | 'state' | 'performance' | 'rooms' | 'websocket'

type LiveLogConfig = boolean | readonly LiveLogCategory[]
```

Use `as const` on arrays to get readonly tuple type:

```typescript
// ✅ Works with as const
static logging = ['lifecycle', 'messages'] as const
```

## API (Framework Internal)

These functions are used by the framework — app developers only need `static logging`:

```typescript
import { liveLog, liveWarn, registerComponentLogging, unregisterComponentLogging } from '@core/server/live'

// Log gated by component config
liveLog('lifecycle', componentId, '🚀 Mounted component')
liveLog('rooms', componentId, `📡 Joined room '${roomId}'`)

// Warn-level (for perf alerts, non-error warnings)
liveWarn('performance', componentId, '⚠️ Slow render detected')

// Register/unregister (called on mount/unmount by ComponentRegistry)
registerComponentLogging(componentId, config)
unregisterComponentLogging(componentId)
```

## How It Works

1. **Mount**: `ComponentRegistry` reads `static logging` from the class and calls `registerComponentLogging(componentId, config)`
2. **Runtime**: All `liveLog()`/`liveWarn()` calls check the registry before emitting
3. **Unmount**: `unregisterComponentLogging(componentId)` removes the entry
4. **Global logs**: Fall back to `LIVE_LOGGING` env var when `componentId` is `null`

## Examples

### Debug a Specific Component

```typescript
// Only this component will show logs
export class LiveChat extends LiveComponent<typeof LiveChat.defaultState> {
  static componentName = 'LiveChat'
  static logging = true  // See everything for this component
}

// All other components remain silent
export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'
  // No static logging → silent
}
```

### Monitor Only Room Activity

```typescript
export class LiveChat extends LiveComponent<typeof LiveChat.defaultState> {
  static componentName = 'LiveChat'
  static logging = ['rooms'] as const  // Only room events
}
```

### Production: Silent Everywhere

```bash
# .env (no LIVE_LOGGING set)
# All components without static logging → silent
# Components with static logging still log (remove for production)
```

## Files Reference

| File | Purpose |
|------|---------|
| `core/server/live/LiveLogger.ts` | Logger implementation, registry, shouldLog logic |
| `core/server/live/ComponentRegistry.ts` | Reads `static logging` on mount/unmount |
| `core/server/live/websocket-plugin.ts` | Uses `liveLog` for WebSocket events |
| `core/server/live/StateSignature.ts` | Uses `liveLog`/`liveWarn` for state operations |
| `core/server/live/LiveRoomManager.ts` | Uses `liveLog` for room lifecycle |
| `core/server/live/LiveComponentPerformanceMonitor.ts` | Uses `liveLog`/`liveWarn` for perf |
| `core/types/types.ts` | `LiveComponent` base class with `static logging` property |

## Critical Rules

**ALWAYS:**
- Use `as const` on logging arrays for type safety
- Keep components silent by default in production
- Use specific categories instead of `true` when possible

**NEVER:**
- Use `console.log` directly in Live Component code — use `liveLog()`
- Forget that `console.error` is always visible (not gated)

## Related

- [Live Components](./live-components.md) - Base component system
- [Live Rooms](./live-rooms.md) - Room system (logged under `rooms` category)
- [Environment Variables](../config/environment-vars.md) - `LIVE_LOGGING` reference
