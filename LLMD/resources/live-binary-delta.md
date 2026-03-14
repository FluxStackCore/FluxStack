# Binary Delta (High-Frequency State Sync)

**Version:** 1.14.0 | **Updated:** 2025-03-09

## Overview

Binary Delta allows Live Components to send state updates as raw binary frames instead of JSON. This bypasses the JSON batcher and sends directly over the WebSocket, making it ideal for high-frequency updates like game state (positions, rotations, physics) or real-time sensor data.

## When to Use Binary vs JSON

| Scenario | Use | Why |
|---|---|---|
| Forms, chat, CRUD | **JSON** (default `setState`) | Low frequency, readability matters |
| Dashboard metrics | **JSON** | Updates every few seconds |
| Game state (30-60 fps) | **Binary Delta** | Hundreds of updates/sec, payload size matters |
| Real-time collaboration (cursors) | **Binary Delta** | High frequency, small payloads |
| IoT sensor streams | **Binary Delta** | Continuous data, compact encoding |

**Rule of thumb:** If you're sending state updates more than ~10 times per second, Binary Delta will reduce bandwidth and latency significantly.

## Wire Format

Each binary frame has this structure:

```
[0x01] [idLen:u8] [componentId:utf8] [payload:bytes]
  1B      1B        N bytes            M bytes
```

| Field | Size | Description |
|---|---|---|
| `0x01` | 1 byte | BINARY_STATE_DELTA marker |
| `idLen` | 1 byte | Length of componentId string |
| `componentId` | N bytes | UTF-8 encoded component ID |
| `payload` | M bytes | Your custom-encoded delta |

Total overhead: **2 + componentId.length** bytes. The payload is entirely yours to define.

## Server-Side: `sendBinaryDelta()`

### API

```typescript
public sendBinaryDelta(
  delta: Partial<TState>,
  encoder: (delta: Partial<TState>) => Uint8Array
): void
```

- **delta** - Object with the state fields that changed (same shape as `setState`)
- **encoder** - Function that serializes the delta into bytes

### Behavior

1. Compares `delta` against current state - only actually changed fields are kept
2. Updates internal state (same as `setState`)
3. Calls your `encoder` with only the changed fields
4. Wraps the result in the wire format and sends it
5. If nothing changed, no frame is sent
6. If WebSocket is closed (readyState !== 1), state updates but no frame is sent

### Example: Simple Component

```typescript
// app/server/live/LiveTracker.ts
import { LiveComponent } from '@core/types/types'

// Encoder: convert delta to binary using DataView
function encodePosition(delta: Record<string, any>): Uint8Array {
  // Calculate size: 1 byte flags + 4 bytes per float field
  let flags = 0
  let size = 1 // flags byte

  if ('x' in delta) { flags |= 0x01; size += 4 }
  if ('y' in delta) { flags |= 0x02; size += 4 }
  if ('speed' in delta) { flags |= 0x04; size += 4 }

  const buffer = new ArrayBuffer(size)
  const dv = new DataView(buffer)
  let offset = 0

  dv.setUint8(offset, flags); offset += 1
  if ('x' in delta) { dv.setFloat32(offset, delta.x, true); offset += 4 }
  if ('y' in delta) { dv.setFloat32(offset, delta.y, true); offset += 4 }
  if ('speed' in delta) { dv.setFloat32(offset, delta.speed, true); offset += 4 }

  return new Uint8Array(buffer)
}

export class LiveTracker extends LiveComponent<typeof LiveTracker.defaultState> {
  static componentName = 'LiveTracker'
  static publicActions = ['updatePosition'] as const
  static defaultState = {
    x: 0,
    y: 0,
    speed: 0
  }

  declare x: number
  declare y: number
  declare speed: number

  private _interval?: ReturnType<typeof setInterval>

  protected onMount() {
    // Send position 30 times per second
    this._interval = setInterval(() => {
      this.sendBinaryDelta(
        { x: this.x + Math.random(), y: this.y + Math.random() },
        encodePosition
      )
    }, 33) // ~30fps
  }

  protected onDestroy() {
    clearInterval(this._interval)
  }

  async updatePosition(payload: { x: number; y: number }) {
    this.sendBinaryDelta(
      { x: payload.x, y: payload.y },
      encodePosition
    )
    return { success: true }
  }
}
```

## Client-Side: `binaryDecoder` option

### With React (`useLiveComponent` / `Live.use`)

Pass the `binaryDecoder` option when mounting the component. The decoder receives the raw payload bytes (without the wire format header - that's already stripped) and must return an object to merge into state.

```typescript
// app/client/src/live/TrackerDemo.tsx
import { useLiveComponent } from '@fluxstack/live-react'

// Decoder: must mirror the encoder logic
function decodePosition(buffer: Uint8Array): Record<string, any> {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let offset = 0

  const flags = dv.getUint8(offset); offset += 1
  const result: Record<string, any> = {}

  if (flags & 0x01) { result.x = dv.getFloat32(offset, true); offset += 4 }
  if (flags & 0x02) { result.y = dv.getFloat32(offset, true); offset += 4 }
  if (flags & 0x04) { result.speed = dv.getFloat32(offset, true); offset += 4 }

  return result
}

export function TrackerDemo() {
  const { state, call, connected } = useLiveComponent('LiveTracker', {
    initialState: { x: 0, y: 0, speed: 0 },
    binaryDecoder: decodePosition  // <-- register decoder here
  })

  return (
    <div>
      <p>Position: ({state.x.toFixed(2)}, {state.y.toFixed(2)})</p>
      <p>Speed: {state.speed.toFixed(2)}</p>
      <p>{connected ? 'Connected' : 'Disconnected'}</p>
    </div>
  )
}
```

### With Vanilla JS (`LiveComponentHandle`)

```typescript
import { LiveConnection, LiveComponentHandle } from '@fluxstack/live-client'

const conn = new LiveConnection({ url: 'ws://localhost:3000/api/live/ws' })
const tracker = new LiveComponentHandle(conn, 'LiveTracker', {
  x: 0, y: 0, speed: 0
})

await tracker.mount()

// Register binary decoder AFTER mount
tracker.setBinaryDecoder(decodePosition)

tracker.onStateChange((state, delta) => {
  console.log('Position:', state.x, state.y)
})
```

**Important:** `setBinaryDecoder()` must be called AFTER `mount()`. The component needs a `componentId` (assigned by the server on mount) to register the binary handler.

## Writing Encoders and Decoders

### Strategy 1: DataView (Best Performance)

Use `DataView` with typed fields. Best for fixed schemas with numbers.

```typescript
// Shared between server and client (e.g. app/shared/codec/trackerCodec.ts)

export function encode(delta: Record<string, any>): Uint8Array {
  let flags = 0, size = 1
  if ('x' in delta) { flags |= 0x01; size += 4 }
  if ('y' in delta) { flags |= 0x02; size += 4 }

  const buf = new ArrayBuffer(size)
  const dv = new DataView(buf)
  let off = 0
  dv.setUint8(off, flags); off += 1
  if (flags & 0x01) { dv.setFloat32(off, delta.x, true); off += 4 }
  if (flags & 0x02) { dv.setFloat32(off, delta.y, true); off += 4 }
  return new Uint8Array(buf)
}

export function decode(buffer: Uint8Array): Record<string, any> {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let off = 0
  const flags = dv.getUint8(off); off += 1
  const result: Record<string, any> = {}
  if (flags & 0x01) { result.x = dv.getFloat32(off, true); off += 4 }
  if (flags & 0x02) { result.y = dv.getFloat32(off, true); off += 4 }
  return result
}
```

**Tip:** Put codec files in `app/shared/` so both server and client can import them.

### Strategy 2: JSON-in-Binary (Simplest)

If you want binary transport without writing a custom codec, just JSON-encode into bytes:

```typescript
function encode(delta: Record<string, any>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(delta))
}

function decode(buffer: Uint8Array): Record<string, any> {
  return JSON.parse(new TextDecoder().decode(buffer))
}
```

This still bypasses the JSON batcher (lower latency) but doesn't save bandwidth. Good for prototyping before writing a proper codec.

### Strategy 3: Bitmask Flags (Complex Schemas)

For state with many optional fields (like game state with tanks, bullets, explosions), use bitmask flags to indicate which fields are present:

```typescript
// Field presence flags
const FLAG_TANKS      = 0x01
const FLAG_BULLETS    = 0x02
const FLAG_EXPLOSIONS = 0x04

function encode(delta: Record<string, any>): Uint8Array {
  let flags = 0
  if (delta.tanks)      flags |= FLAG_TANKS
  if (delta.bullets)    flags |= FLAG_BULLETS
  if (delta.explosions) flags |= FLAG_EXPLOSIONS

  // Calculate total size, allocate buffer, write fields...
  // See the full game codec example below
}
```

### Writing Strings in Binary

Helper functions for encoding/decoding strings inside binary payloads:

```typescript
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// Write: [1 byte length][N bytes UTF-8]
function writeString(dv: DataView, offset: number, str: string): number {
  const bytes = textEncoder.encode(str)
  dv.setUint8(offset, bytes.length)  // max 255 chars
  offset += 1
  for (let i = 0; i < bytes.length; i++) {
    dv.setUint8(offset + i, bytes[i])
  }
  return offset + bytes.length
}

// Read: [1 byte length][N bytes UTF-8]
function readString(dv: DataView, offset: number): [string, number] {
  const len = dv.getUint8(offset)
  offset += 1
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + offset, len)
  return [textDecoder.decode(bytes), offset + len]
}
```

## Real-World Example: Game State Codec

This codec is used by Battle Tanks to encode tanks, bullets, explosions, and laser beams into a single binary frame. It uses bitmask flags, DataView for typed fields, and string helpers for IDs.

```typescript
// app/shared/codec/gameCodec.ts

interface TankDynamic {
  id: string
  x: number
  z: number
  rot: number
  tRot: number
  hp: number
  alive: boolean
  laserCharge: number
}

const FLAG_TANKS      = 0x01
const FLAG_BULLETS    = 0x02
const FLAG_EXPLOSIONS = 0x04
const FLAG_LASERS     = 0x08

export function encodeGameState(delta: Record<string, any>): Uint8Array {
  let size = 1 + 4  // flags (1B) + matchTime (4B)
  let flags = 0

  const tanks: TankDynamic[] | undefined = delta.tanks
  if (tanks) {
    flags |= FLAG_TANKS
    size += 2  // tank count (uint16)
    for (const t of tanks) {
      const idBytes = new TextEncoder().encode(t.id)
      // 1B idLen + id + 4 floats (x,z,rot,tRot) + hp (2B) + alive (1B) + laserCharge (4B)
      size += 1 + idBytes.length + 16 + 2 + 1 + 4
    }
  }

  // ... similar for bullets, explosions, lasers ...

  const buffer = new ArrayBuffer(size)
  const dv = new DataView(buffer)
  let offset = 0

  dv.setUint8(offset, flags); offset += 1
  dv.setUint32(offset, delta.matchTime ?? 0, true); offset += 4

  if (tanks) {
    dv.setUint16(offset, tanks.length, true); offset += 2
    for (const t of tanks) {
      offset = writeString(dv, offset, t.id)
      dv.setFloat32(offset, t.x, true); offset += 4
      dv.setFloat32(offset, t.z, true); offset += 4
      dv.setFloat32(offset, t.rot, true); offset += 4
      dv.setFloat32(offset, t.tRot, true); offset += 4
      dv.setUint16(offset, t.hp, true); offset += 2
      dv.setUint8(offset, t.alive ? 1 : 0); offset += 1
      dv.setFloat32(offset, t.laserCharge, true); offset += 4
    }
  }

  return new Uint8Array(buffer)
}

export function decodeGameState(buffer: Uint8Array): Record<string, any> {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let offset = 0

  const flags = dv.getUint8(offset); offset += 1
  const matchTime = dv.getUint32(offset, true); offset += 4
  const result: Record<string, any> = { matchTime }

  if (flags & FLAG_TANKS) {
    const count = dv.getUint16(offset, true); offset += 2
    const tanks: TankDynamic[] = []
    for (let i = 0; i < count; i++) {
      let id: string
      ;[id, offset] = readString(dv, offset)
      const x = dv.getFloat32(offset, true); offset += 4
      const z = dv.getFloat32(offset, true); offset += 4
      const rot = dv.getFloat32(offset, true); offset += 4
      const tRot = dv.getFloat32(offset, true); offset += 4
      const hp = dv.getUint16(offset, true); offset += 2
      const alive = dv.getUint8(offset) === 1; offset += 1
      const laserCharge = dv.getFloat32(offset, true); offset += 4
      tanks.push({ id, x, z, rot, tRot, hp, alive, laserCharge })
    }
    result.tanks = tanks
  }

  // ... similar for bullets, explosions, lasers ...

  return result
}
```

### Server Usage (Game Loop)

```typescript
import { encodeGameState } from '@app/shared/codec/gameCodec'

export class LiveBattleTanks extends LiveComponent<typeof LiveBattleTanks.defaultState> {
  static componentName = 'LiveBattleTanks'
  static singleton = true
  static publicActions = ['join', 'move', 'shoot'] as const
  static defaultState = {
    tanks: [] as TankDynamic[],
    bullets: [] as any[],
    explosions: [] as any[],
    matchTime: 0
  }

  private _loop?: ReturnType<typeof setInterval>

  protected onMount() {
    // Game loop at 30fps
    this._loop = setInterval(() => {
      this.tick()
      this.sendBinaryDelta(
        {
          tanks: this.state.tanks,
          bullets: this.state.bullets,
          explosions: this.state.explosions,
          matchTime: this.state.matchTime
        },
        encodeGameState
      )
    }, 33)
  }

  protected onDestroy() {
    clearInterval(this._loop)
  }

  private tick() {
    // Update physics, process collisions, etc.
    this.state.matchTime += 33
  }
}
```

### Client Usage (React)

```typescript
import { useLiveComponent } from '@fluxstack/live-react'
import { decodeGameState } from '@app/shared/codec/gameCodec'

export function BattleTanks() {
  const { state, call } = useLiveComponent('LiveBattleTanks', {
    initialState: { tanks: [], bullets: [], explosions: [], matchTime: 0 },
    binaryDecoder: decodeGameState
  })

  // Render game using state.tanks, state.bullets, etc.
  return <GameCanvas tanks={state.tanks} bullets={state.bullets} />
}
```

## Bandwidth Comparison

For a game with 8 tanks, 20 bullets, and 3 explosions at 30fps:

| Method | Payload Size | Per Second | Savings |
|---|---|---|---|
| JSON (`setState`) | ~2.4 KB | ~72 KB/s | baseline |
| Binary (DataView) | ~0.5 KB | ~15 KB/s | **~80%** |

Binary encoding is especially effective when state contains many numeric fields (floats, integers) since JSON encodes numbers as variable-length text while DataView uses fixed-size typed representations.

## Key Differences: `sendBinaryDelta` vs `setState`

| | `setState` | `sendBinaryDelta` |
|---|---|---|
| **Format** | JSON | Custom binary |
| **Batching** | Merged per microtask | Immediate send |
| **Deduplication** | Yes (by componentId) | No |
| **Encoder** | Built-in (JSON.stringify) | You provide it |
| **Client decoder** | Built-in (JSON.parse) | You provide it |
| **Best for** | Low-frequency, readable data | High-frequency, compact data |
| **State update** | Yes | Yes (same internal behavior) |

Both methods update internal state identically. The difference is only in how the data is serialized and sent over the wire.

## Important Notes

- Encoder and decoder must be **symmetric** - what you encode, you must decode in the same order and format
- Put codec files in `app/shared/` so server and client share the same code
- `sendBinaryDelta` only sends fields that actually changed (same diffing as `setState`)
- Binary frames bypass the JSON batcher and message deduplication
- Use `setBinaryDecoder()` only AFTER `mount()` (vanilla JS client)
- With React, just pass `binaryDecoder` in options - lifecycle is handled automatically
- If both `setState` and `sendBinaryDelta` are used on the same component, the client handles both (JSON messages go through the normal path, binary frames go through the decoder)

## Files

**Core (Server)**
- `packages/core/src/component/LiveComponent.ts` - `sendBinaryDelta()` method
- `packages/core/src/component/managers/ComponentStateManager.ts` - Wire format implementation

**Client (Browser)**
- `packages/client/src/component.ts` - `setBinaryDecoder()` method
- `packages/client/src/connection.ts` - `handleBinaryMessage()` + `registerBinaryHandler()`

**React**
- `packages/react/src/hooks/useLiveComponent.ts` - `binaryDecoder` option in `UseLiveComponentOptions`

**Tests**
- `packages/core/src/__tests__/component/LiveComponent.binary.test.ts` - Wire format and behavior tests
- `packages/core/src/__tests__/component/fixtures/gameCodec.ts` - Full game codec example

## Related

- [Live Components](./live-components.md) - Core Live Component documentation
- [Live Upload](./live-upload.md) - Chunked file upload (different binary protocol)
- [Live Rooms](./live-rooms.md) - Multi-room communication
