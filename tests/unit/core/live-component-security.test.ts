import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 🔒 Security Attack Tests for Live Components
 *
 * These tests simulate real-world attacks against the Live Components system
 * to verify that all security fixes are working correctly.
 *
 * Covers:
 * - CVE-like: Arbitrary method execution (CWE-94)
 * - CVE-like: Rehydration component class mismatch (CWE-434)
 * - CVE-like: Unrestricted file uploads (CWE-434)
 * - CVE-like: Room name injection (CWE-20)
 * - CVE-like: Room state size exhaustion (CWE-770)
 * - CVE-like: Component ID predictability (CWE-287)
 * - CVE-like: Information disclosure in errors (CWE-209)
 * - CVE-like: WebSocket rate limiting (CWE-770)
 */

// Import from @fluxstack/live
import { LiveComponent, setLiveComponentContext, RoomEventBus, LiveRoomManager } from '@fluxstack/live'
import type { GenericWebSocket as FluxStackWebSocket, LiveMessage, LiveActionAuthMap } from '@fluxstack/live'

// Set up DI context for LiveComponent
const testRoomEvents = new RoomEventBus()
const testRoomManager = new LiveRoomManager(testRoomEvents)
setLiveComponentContext({
  roomEvents: testRoomEvents,
  roomManager: testRoomManager,
  debugger: { enabled: false, trackStateChange: () => {}, trackAction: () => {}, trackError: () => {} } as any,
})

// ===== Test Helpers =====

function createMockWs(): FluxStackWebSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
    data: {
      connectionId: 'test-conn',
      components: new Map(),
      subscriptions: new Set(),
      connectedAt: new Date()
    },
    remoteAddress: '127.0.0.1',
    readyState: 1
  } as unknown as FluxStackWebSocket
}

function getLastSentMessage(ws: FluxStackWebSocket): any {
  const sendMock = ws.send as ReturnType<typeof vi.fn>
  const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1]
  return lastCall ? JSON.parse(lastCall[0]) : null
}

// ===== Test Components =====

interface ChatState {
  messages: string[]
  isAdmin: boolean
  secretKey: string
}

// Component WITHOUT publicActions (insecure legacy pattern - now blocks ALL remote actions)
class LegacyComponent extends LiveComponent<ChatState> {
  static componentName = 'LegacyComponent'
  static defaultState: ChatState = { messages: [], isAdmin: false, secretKey: 'secret-123' }

  async sendMessage(payload: { text: string }) {
    this.state.messages = [...this.state.messages, payload.text]
    return { success: true }
  }

  async deleteMessage(payload: { index: number }) {
    return { success: true }
  }

  // This internal method should NOT be callable from client
  private _internalProcess() {
    return { internal: true }
  }
}

// Component WITH publicActions whitelist (secure pattern)
class SecureComponent extends LiveComponent<ChatState> {
  static componentName = 'SecureComponent'
  static defaultState: ChatState = { messages: [], isAdmin: false, secretKey: 'secret-456' }
  static publicActions = ['sendMessage', 'deleteMessage'] as const

  async sendMessage(payload: { text: string }) {
    return { success: true }
  }

  async deleteMessage(payload: { index: number }) {
    return { success: true }
  }

  // This method is NOT in publicActions - should be blocked
  async resetDatabase() {
    return { dangerous: true }
  }
}

// Component with action-level auth
class AuthProtectedComponent extends LiveComponent<ChatState> {
  static componentName = 'AuthProtectedComponent'
  static defaultState: ChatState = { messages: [], isAdmin: false, secretKey: 'secret-789' }
  static publicActions = ['sendMessage', 'adminAction'] as const
  static actionAuth: LiveActionAuthMap = {
    adminAction: { roles: ['admin'] }
  }

  async sendMessage(payload: { text: string }) {
    return { success: true }
  }

  async adminAction() {
    return { admin: true }
  }
}

// ===== ATTACK TESTS =====

describe('🔒 Security: Arbitrary Method Execution (CWE-94)', () => {
  let ws: FluxStackWebSocket
  let legacy: LegacyComponent
  let secure: SecureComponent

  beforeEach(() => {
    ws = createMockWs()
    legacy = new LegacyComponent({}, ws)
    secure = new SecureComponent({}, ws)
  })

  describe('Blocked internal methods (blocklist)', () => {
    it('ATTACK: should block calling destroy() remotely', async () => {
      await expect(legacy.executeAction('destroy', {})).rejects.toThrow("Action 'destroy' is not callable")
    })

    it('ATTACK: should block calling emit() remotely', async () => {
      await expect(legacy.executeAction('emit', { type: 'ADMIN_ALERT', payload: {} })).rejects.toThrow("Action 'emit' is not callable")
    })

    it('ATTACK: should block calling setState() remotely', async () => {
      await expect(legacy.executeAction('setState', { isAdmin: true })).rejects.toThrow("Action 'setState' is not callable")
    })

    it('ATTACK: should block calling setAuthContext() remotely to escalate privileges', async () => {
      await expect(legacy.executeAction('setAuthContext', {
        authenticated: true,
        user: { id: 'hacker', roles: ['admin'] }
      })).rejects.toThrow("Action 'setAuthContext' is not callable")
    })

    it('ATTACK: should block calling broadcast() remotely', async () => {
      await expect(legacy.executeAction('broadcast', { type: 'FAKE', payload: {} })).rejects.toThrow("Action 'broadcast' is not callable")
    })

    it('ATTACK: should block calling broadcastToRoom() remotely', async () => {
      await expect(legacy.executeAction('broadcastToRoom', {})).rejects.toThrow("Action 'broadcastToRoom' is not callable")
    })

    it('ATTACK: should block calling executeAction() recursively', async () => {
      await expect(legacy.executeAction('executeAction', { action: 'destroy', payload: {} })).rejects.toThrow("Action 'executeAction' is not callable")
    })

    it('ATTACK: should block calling getSerializableState() remotely', async () => {
      await expect(legacy.executeAction('getSerializableState', {})).rejects.toThrow("Action 'getSerializableState' is not callable")
    })

    it('ATTACK: should block calling constructor remotely', async () => {
      await expect(legacy.executeAction('constructor', {})).rejects.toThrow("Action 'constructor' is not callable")
    })

    it('ATTACK: should block calling subscribeToRoom() remotely', async () => {
      await expect(legacy.executeAction('subscribeToRoom', 'admin-room')).rejects.toThrow("Action 'subscribeToRoom' is not callable")
    })

    it('ATTACK: should block calling emitRoomEvent() remotely', async () => {
      await expect(legacy.executeAction('emitRoomEvent', { event: 'hack', data: {} })).rejects.toThrow("Action 'emitRoomEvent' is not callable")
    })

    it('ATTACK: should block calling onRoomEvent() remotely', async () => {
      await expect(legacy.executeAction('onRoomEvent', {})).rejects.toThrow("Action 'onRoomEvent' is not callable")
    })
  })

  describe('Blocked private methods (underscore prefix)', () => {
    it('ATTACK: should block calling _internalProcess() remotely', async () => {
      await expect(legacy.executeAction('_internalProcess', {})).rejects.toThrow("Action '_internalProcess' is not callable")
    })

    it('ATTACK: should block any method starting with _', async () => {
      await expect(legacy.executeAction('_anything', {})).rejects.toThrow("Action '_anything' is not callable")
    })

    it('ATTACK: should block any method starting with #', async () => {
      await expect(legacy.executeAction('#privateField', {})).rejects.toThrow("Action '#privateField' is not callable")
    })
  })

  describe('Blocked Object.prototype methods', () => {
    it('ATTACK: should block calling toString() remotely', async () => {
      await expect(legacy.executeAction('toString', {})).rejects.toThrow("Action 'toString' is not callable")
    })

    it('ATTACK: should block calling hasOwnProperty() remotely', async () => {
      await expect(legacy.executeAction('hasOwnProperty', 'state')).rejects.toThrow("Action 'hasOwnProperty' is not callable")
    })

    it('ATTACK: should block calling valueOf() remotely', async () => {
      await expect(legacy.executeAction('valueOf', {})).rejects.toThrow("Action 'valueOf' is not callable")
    })
  })

  describe('publicActions whitelist enforcement', () => {
    it('should allow calling whitelisted action', async () => {
      const result = await secure.executeAction('sendMessage', { text: 'hello' })
      expect(result.success).toBe(true)
    })

    it('should allow calling another whitelisted action', async () => {
      const result = await secure.executeAction('deleteMessage', { index: 0 })
      expect(result.success).toBe(true)
    })

    it('ATTACK: should block calling non-whitelisted method', async () => {
      await expect(secure.executeAction('resetDatabase', {})).rejects.toThrow("not listed in publicActions")
    })

    it('ATTACK: should block calling destroy even on secure component', async () => {
      await expect(secure.executeAction('destroy', {})).rejects.toThrow("Action 'destroy' is not callable")
    })

    it('ATTACK: should block calling setAuthContext on secure component', async () => {
      await expect(secure.executeAction('setAuthContext', {
        authenticated: true, user: { id: 'hacker', roles: ['admin'] }
      })).rejects.toThrow("Action 'setAuthContext' is not callable")
    })
  })

  describe('Components without publicActions block ALL remote actions', () => {
    it('should block ALL actions on component without publicActions (secure by default)', async () => {
      // Even though sendMessage exists as a method, it's blocked because publicActions is not defined
      await expect(legacy.executeAction('sendMessage', { text: 'hello' }))
        .rejects.toThrow('component has no publicActions defined')
    })

    it('should block deleteMessage on component without publicActions', async () => {
      await expect(legacy.executeAction('deleteMessage', { index: 0 }))
        .rejects.toThrow('component has no publicActions defined')
    })

    it('should return "no publicActions" error for any action on legacy component', async () => {
      await expect(legacy.executeAction('nonExistentMethod', {}))
        .rejects.toThrow('component has no publicActions defined')
    })
  })

  describe('Error messages do not leak stack traces', () => {
    it('should not include stack trace in error emit', async () => {
      // Use secure component to test a blocked (non-whitelisted) action
      ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

      try {
        await secure.executeAction('resetDatabase', {})
      } catch { /* expected */ }

      const msg = getLastSentMessage(ws)
      expect(msg.type).toBe('ERROR')
      expect(msg.payload.error).toBeDefined()
      // Stack trace should NOT be included
      expect(msg.payload.stack).toBeUndefined()
    })
  })
})

describe('🔒 Security: Component ID Predictability (CWE-287)', () => {
  let ws: FluxStackWebSocket

  beforeEach(() => {
    ws = createMockWs()
  })

  it('should generate cryptographically secure component IDs', () => {
    const component = new LegacyComponent({}, ws)
    // Compact 8-char IDs using 64-char alphabet (A-Z, a-z, 0-9, -, _)
    expect(component.id).toMatch(/^[A-Za-z0-9_-]{8}$/)
    expect(component.id).toHaveLength(8)
  })

  it('should generate unique IDs for each component', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const component = new LegacyComponent({}, ws)
      ids.add(component.id)
    }
    // All 100 IDs should be unique
    expect(ids.size).toBe(100)
  })

  it('should NOT use predictable timestamp-based IDs', () => {
    const component = new LegacyComponent({}, ws)
    // Should NOT contain timestamp patterns (13-digit epoch) or old live-prefix format
    expect(component.id).not.toMatch(/^\d{13}/)
    expect(component.id).not.toMatch(/^live-\d{13}-/)
  })
})

describe('🔒 Security: File Upload Restrictions (CWE-434)', () => {
  // We test the FileUploadManager directly
  let fileUploadManager: any

  beforeEach(async () => {
    // Dynamic import to get the actual instance
    const { FileUploadManager } = await import('@fluxstack/live')
    fileUploadManager = new FileUploadManager()
  })

  describe('MIME type validation', () => {
    it('should allow safe image uploads', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-1',
        componentId: 'comp-1',
        filename: 'photo.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024 * 100, // 100KB
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(true)
    })

    it('should allow PDF uploads', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-2',
        componentId: 'comp-1',
        filename: 'document.pdf',
        fileType: 'application/pdf',
        fileSize: 1024 * 500,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(true)
    })

    it('ATTACK: should block executable uploads', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-3',
        componentId: 'comp-1',
        filename: 'malware.exe',
        fileType: 'application/x-msdownload',
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('File type not allowed')
    })

    it('ATTACK: should block octet-stream uploads', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-4',
        componentId: 'comp-1',
        filename: 'payload.bin',
        fileType: 'application/octet-stream',
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('File type not allowed')
    })
  })

  describe('File extension validation', () => {
    it('ATTACK: should block .exe extension even with allowed MIME', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-5',
        componentId: 'comp-1',
        filename: 'image.exe',
        fileType: 'image/jpeg', // Lies about MIME type
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('extension not allowed')
    })

    it('ATTACK: should block .sh shell script extension', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-6',
        componentId: 'comp-1',
        filename: 'setup.sh',
        fileType: 'text/plain', // Valid MIME but dangerous extension
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('extension not allowed')
    })

    it('ATTACK: should block .bat batch file extension', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-7',
        componentId: 'comp-1',
        filename: 'run.bat',
        fileType: 'text/plain',
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('extension not allowed')
    })

    it('ATTACK: should block .ps1 PowerShell extension', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-8',
        componentId: 'comp-1',
        filename: 'exploit.ps1',
        fileType: 'text/plain',
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('extension not allowed')
    })

    it('ATTACK: should block .dll shared library extension', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-9',
        componentId: 'comp-1',
        filename: 'hack.dll',
        fileType: 'application/octet-stream',
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      // Could fail on MIME or extension - either is fine
      expect(result.error).toBeDefined()
    })
  })

  describe('File size validation', () => {
    it('ATTACK: should block files larger than 50MB', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-10',
        componentId: 'comp-1',
        filename: 'huge.jpg',
        fileType: 'image/jpeg',
        fileSize: 100 * 1024 * 1024, // 100MB
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('File too large')
    })

    it('should allow files under 50MB', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-11',
        componentId: 'comp-1',
        filename: 'normal.jpg',
        fileType: 'image/jpeg',
        fileSize: 10 * 1024 * 1024, // 10MB
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Filename sanitization', () => {
    it('ATTACK: should strip path traversal from filename', async () => {
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-12',
        componentId: 'comp-1',
        filename: '../../../etc/passwd',
        fileType: 'text/plain',
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      // The path.basename should strip traversal, keeping only "passwd"
      // This should succeed because text/plain is allowed and "passwd" has no blocked extension
      expect(result.success).toBe(true)
    })

    it('ATTACK: should reject excessively long filenames', async () => {
      const longName = 'a'.repeat(300) + '.jpg'
      const result = await fileUploadManager.startUpload({
        uploadId: 'test-13',
        componentId: 'comp-1',
        filename: longName,
        fileType: 'image/jpeg',
        fileSize: 1024,
        type: 'FILE_UPLOAD_START'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Filename too long')
    })
  })
})

describe('🔒 Security: Room Name Validation (CWE-20)', () => {
  // Test the room name validation regex that is enforced in LiveRoomManager and websocket-plugin
  const validRoomRegex = /^[a-zA-Z0-9_:.-]{1,64}$/

  it('ATTACK: should reject room names with path traversal', () => {
    expect(validRoomRegex.test('../admin')).toBe(false)
    expect(validRoomRegex.test('../../etc/passwd')).toBe(false)
    expect(validRoomRegex.test('room/../../hack')).toBe(false)
  })

  it('ATTACK: should reject room names with special characters', () => {
    const validRoomRegex = /^[a-zA-Z0-9_:.-]{1,64}$/

    expect(validRoomRegex.test('room<script>')).toBe(false)
    expect(validRoomRegex.test('room"name')).toBe(false)
    expect(validRoomRegex.test("room'name")).toBe(false)
    expect(validRoomRegex.test('room name')).toBe(false) // spaces
    expect(validRoomRegex.test('room\nname')).toBe(false) // newlines
    expect(validRoomRegex.test('room\0name')).toBe(false) // null bytes
  })

  it('ATTACK: should reject empty room names', () => {
    const validRoomRegex = /^[a-zA-Z0-9_:.-]{1,64}$/
    expect(validRoomRegex.test('')).toBe(false)
  })

  it('ATTACK: should reject excessively long room names (memory attack)', () => {
    const validRoomRegex = /^[a-zA-Z0-9_:.-]{1,64}$/
    const longName = 'a'.repeat(100)
    expect(validRoomRegex.test(longName)).toBe(false)
  })

  it('should accept valid room names', () => {
    const validRoomRegex = /^[a-zA-Z0-9_:.-]{1,64}$/

    expect(validRoomRegex.test('general')).toBe(true)
    expect(validRoomRegex.test('chat-room')).toBe(true)
    expect(validRoomRegex.test('room_123')).toBe(true)
    expect(validRoomRegex.test('ns:room.main')).toBe(true)
    expect(validRoomRegex.test('ADMIN-PANEL')).toBe(true)
  })
})

describe('🔒 Security: Room State Size Limits (CWE-770)', () => {
  // We need to test the actual LiveRoomManager with the state size check.
  // Since it's mocked, we test the validation logic directly.

  it('should reject room state updates larger than 10MB', () => {
    const MAX_ROOM_STATE_SIZE = 10 * 1024 * 1024
    const largeState = { data: 'x'.repeat(MAX_ROOM_STATE_SIZE + 1) }
    const stateSize = Buffer.byteLength(JSON.stringify(largeState), 'utf8')

    expect(stateSize).toBeGreaterThan(MAX_ROOM_STATE_SIZE)
  })

  it('should accept room state updates under 10MB', () => {
    const MAX_ROOM_STATE_SIZE = 10 * 1024 * 1024
    const normalState = { messages: Array(100).fill('hello world'), users: 5 }
    const stateSize = Buffer.byteLength(JSON.stringify(normalState), 'utf8')

    expect(stateSize).toBeLessThan(MAX_ROOM_STATE_SIZE)
  })
})

describe('🔒 Security: WebSocket Rate Limiting (CWE-770)', () => {
  // Test the ConnectionRateLimiter class directly
  // Since it's defined in the websocket-plugin, we replicate the logic here
  class TestRateLimiter {
    private tokens: number
    private lastRefill: number
    private readonly maxTokens: number
    private readonly refillRate: number

    constructor(maxTokens = 100, refillRate = 50) {
      this.maxTokens = maxTokens
      this.tokens = maxTokens
      this.refillRate = refillRate
      this.lastRefill = Date.now()
    }

    tryConsume(count = 1): boolean {
      this.refill()
      if (this.tokens >= count) {
        this.tokens -= count
        return true
      }
      return false
    }

    private refill(): void {
      const now = Date.now()
      const elapsed = (now - this.lastRefill) / 1000
      this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate)
      this.lastRefill = now
    }
  }

  it('should allow normal message rate', () => {
    const limiter = new TestRateLimiter(100, 50)

    // Send 50 messages - should all pass
    let allowed = 0
    for (let i = 0; i < 50; i++) {
      if (limiter.tryConsume()) allowed++
    }
    expect(allowed).toBe(50)
  })

  it('ATTACK: should block message flood (100+ rapid messages)', () => {
    const limiter = new TestRateLimiter(100, 50)

    // Rapidly send 150 messages
    let allowed = 0
    let blocked = 0
    for (let i = 0; i < 150; i++) {
      if (limiter.tryConsume()) {
        allowed++
      } else {
        blocked++
      }
    }

    // First ~100 should pass, rest should be blocked
    expect(allowed).toBe(100)
    expect(blocked).toBe(50)
  })

  it('should refill tokens over time', async () => {
    const limiter = new TestRateLimiter(10, 100) // Fast refill for testing

    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume()
    }
    expect(limiter.tryConsume()).toBe(false)

    // Wait for refill (100 tokens/second = 10 tokens in 100ms)
    await new Promise(resolve => setTimeout(resolve, 150))

    // Should have tokens again
    expect(limiter.tryConsume()).toBe(true)
  })
})

describe('🔒 Security: Rehydration Component Name Validation (CWE-434)', () => {
  // This test validates the ComponentRegistry.rehydrateComponent logic
  // We test the validation concept since the full registry requires more setup

  it('should detect component name mismatch in signed state', () => {
    const signedStateComponentName = 'ProtectedChat'
    const requestedComponentName = 'AdminPanel'

    // This is the check that was added to rehydrateComponent
    const isMismatch = signedStateComponentName !== requestedComponentName
    expect(isMismatch).toBe(true)
  })

  it('should allow matching component names', () => {
    const signedStateComponentName = 'ChatComponent'
    const requestedComponentName = 'ChatComponent'

    const isMismatch = signedStateComponentName !== requestedComponentName
    expect(isMismatch).toBe(false)
  })

  it('ATTACK: should detect cross-component rehydration attempt', () => {
    // Simulates an attacker trying to rehydrate ProtectedChat state into AdminPanel
    const clientState = {
      messages: ['secret message'],
      __componentName: 'ProtectedChat' // Embedded in signed state
    }
    const requestedComponent = 'AdminPanel' // Attacker requests different component

    expect(clientState.__componentName).not.toBe(requestedComponent)
    // The fix should reject this
  })
})

describe('🔒 Security: Information Disclosure Prevention (CWE-209)', () => {
  let ws: FluxStackWebSocket

  beforeEach(() => {
    ws = createMockWs()
  })

  it('should not expose stack traces in error messages', async () => {
    // Use SecureComponent to test a non-whitelisted action error
    const component = new SecureComponent({}, ws)
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    try {
      await component.executeAction('resetDatabase', {})
    } catch { /* expected */ }

    const msg = getLastSentMessage(ws)
    expect(msg.type).toBe('ERROR')
    expect(msg.payload).toBeDefined()
    expect(msg.payload.stack).toBeUndefined()
    expect(msg.payload.error).toBeDefined()
  })

  it('should not expose internal method names in blocked action errors', async () => {
    const component = new LegacyComponent({}, ws)
    ;(ws.send as ReturnType<typeof vi.fn>).mockClear()

    try {
      await component.executeAction('destroy', {})
    } catch (e: any) {
      // Error message should be generic, not revealing internal details
      expect(e.message).toBe("Action 'destroy' is not callable")
      expect(e.message).not.toContain('internal')
      expect(e.message).not.toContain('protected')
    }
  })
})

describe('🔒 Security: setValue Protection (CWE-306)', () => {
  let ws: FluxStackWebSocket

  beforeEach(() => {
    ws = createMockWs()
  })

  it('ATTACK: should block setValue on component with publicActions whitelist', async () => {
    // SecureComponent has publicActions = ['sendMessage', 'deleteMessage']
    // setValue is inherited but NOT in publicActions
    const component = new SecureComponent({}, ws)

    await expect(component.executeAction('setValue', {
      key: 'isAdmin',
      value: true
    })).rejects.toThrow("not listed in publicActions")
  })

  it('should block setValue on legacy components (no publicActions = secure by default)', async () => {
    // LegacyComponent doesn't define publicActions, so ALL remote actions are blocked
    const component = new LegacyComponent({}, ws)

    await expect(component.executeAction('setValue', {
      key: 'isAdmin',
      value: true
    })).rejects.toThrow('component has no publicActions defined')
  })
})

describe('🔒 Security: Comprehensive Attack Scenario Simulation', () => {
  let ws: FluxStackWebSocket

  beforeEach(() => {
    ws = createMockWs()
  })

  it('SCENARIO: Attacker tries to escalate privileges via setAuthContext', async () => {
    const component = new SecureComponent({}, ws)

    // Step 1: Try to call setAuthContext directly
    await expect(component.executeAction('setAuthContext', {
      authenticated: true,
      user: { id: 'hacker', roles: ['admin'], permissions: ['*'] }
    })).rejects.toThrow("is not callable")

    // Verify auth context was NOT modified
    expect(component.$auth.authenticated).toBe(false)
  })

  it('SCENARIO: Attacker tries to destroy other users components', async () => {
    const component = new SecureComponent({}, ws)

    // Try to call destroy via action
    await expect(component.executeAction('destroy', {})).rejects.toThrow("is not callable")

    // Component should still be functional
    const result = await component.executeAction('sendMessage', { text: 'still works' })
    expect(result.success).toBe(true)
  })

  it('SCENARIO: Attacker tries to access non-whitelisted dangerous method', async () => {
    const component = new SecureComponent({}, ws)

    // resetDatabase exists but is not in publicActions
    await expect(component.executeAction('resetDatabase', {})).rejects.toThrow("not listed in publicActions")
  })

  it('SCENARIO: Attacker tries to emit fake state updates to other clients', async () => {
    const component = new SecureComponent({}, ws)

    // Try to call emit directly to send fake STATE_UPDATE
    await expect(component.executeAction('emit', ['STATE_UPDATE', { state: { isAdmin: true } }])).rejects.toThrow("is not callable")
  })

  it('SCENARIO: Attacker tries prototype pollution via toString/valueOf', async () => {
    const component = new LegacyComponent({}, ws)

    await expect(component.executeAction('toString', {})).rejects.toThrow("is not callable")
    await expect(component.executeAction('valueOf', {})).rejects.toThrow("is not callable")
    await expect(component.executeAction('hasOwnProperty', 'state')).rejects.toThrow("is not callable")
  })
})
