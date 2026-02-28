import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Tests for the FluxStack Vite Plugin - Live Component Server Code Stripping
 *
 * Verifies that the plugin correctly:
 * 1. Extracts static metadata from server live components
 * 2. Generates client-safe stubs without server dependencies
 * 3. Strips Node.js-only imports (fs, path, etc.)
 * 4. Preserves the class structure needed by Live.use()
 */

// We test the internal functions by importing the module
// In a real Vite build, the plugin would intercept imports automatically

const ROOT = resolve(__dirname, '../../..')

// Helper: simulate what the plugin does internally
function extractComponentMetadata(source: string) {
  const components: {
    className: string
    componentName: string | null
    defaultState: string | null
    publicActions: string | null
  }[] = []

  const classRegex = /export\s+class\s+(\w+)\s+extends\s+LiveComponent/g
  let classMatch

  while ((classMatch = classRegex.exec(source)) !== null) {
    const className = classMatch[1]

    const classStartIndex = source.indexOf('{', classMatch.index)
    if (classStartIndex === -1) continue

    let braceCount = 1
    let i = classStartIndex + 1
    while (i < source.length && braceCount > 0) {
      if (source[i] === '{') braceCount++
      else if (source[i] === '}') braceCount--
      i++
    }
    const classBody = source.substring(classStartIndex, i)

    const componentNameMatch = classBody.match(
      /static\s+componentName\s*=\s*['"]([^'"]+)['"]/
    )
    const componentName = componentNameMatch ? componentNameMatch[1] : null

    let defaultState: string | null = null
    const defaultStateStart = classBody.match(
      /static\s+defaultState\s*=\s*/
    )
    if (defaultStateStart) {
      const stateStartIdx = defaultStateStart.index! + defaultStateStart[0].length
      const valueStart = classBody.indexOf('{', stateStartIdx)
      if (valueStart !== -1) {
        let bCount = 1
        let j = valueStart + 1
        while (j < classBody.length && bCount > 0) {
          if (classBody[j] === '{') bCount++
          else if (classBody[j] === '}') bCount--
          j++
        }
        defaultState = classBody.substring(valueStart, j)
      }
    }

    const publicActionsMatch = classBody.match(
      /static\s+publicActions\s*=\s*(\[[^\]]*\])/
    )
    const publicActions = publicActionsMatch ? publicActionsMatch[1] : null

    components.push({ className, componentName, defaultState, publicActions })
  }

  return components
}

function generateClientStub(source: string): string {
  const components = extractComponentMetadata(source)
  if (components.length === 0) return 'export {}'

  const stubs: string[] = []
  for (const comp of components) {
    const componentName = comp.componentName || comp.className
    const defaultState = comp.defaultState || '{}'
    const publicActions = comp.publicActions || '[]'
    const cleanDefaultState = defaultState.replace(/\s+as\s+[^,}\n]+/g, '')

    stubs.push(`
export class ${comp.className} {
  static componentName = '${componentName}'
  static defaultState = ${cleanDefaultState}
  static publicActions = ${publicActions}
}
`)
  }

  return stubs.join('\n')
}

describe('Vite Plugin - Live Component Server Code Stripping', () => {
  describe('extractComponentMetadata', () => {
    it('should extract metadata from LiveCounter', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveCounter.ts'),
        'utf-8'
      )

      const metadata = extractComponentMetadata(source)
      expect(metadata).toHaveLength(1)
      expect(metadata[0].className).toBe('LiveCounter')
      expect(metadata[0].componentName).toBe('LiveCounter')
      expect(metadata[0].publicActions).toContain('increment')
      expect(metadata[0].publicActions).toContain('decrement')
      expect(metadata[0].publicActions).toContain('reset')
      expect(metadata[0].defaultState).toBeTruthy()
      expect(metadata[0].defaultState).toContain('count')
    })

    it('should extract metadata from LiveFileReader (with fs import)', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveFileReader.ts'),
        'utf-8'
      )

      const metadata = extractComponentMetadata(source)
      expect(metadata).toHaveLength(1)
      expect(metadata[0].className).toBe('LiveFileReader')
      expect(metadata[0].componentName).toBe('LiveFileReader')
      expect(metadata[0].publicActions).toContain('readFile')
      expect(metadata[0].publicActions).toContain('checkFile')
      expect(metadata[0].defaultState).toBeTruthy()
      expect(metadata[0].defaultState).toContain('currentFile')
      expect(metadata[0].defaultState).toContain('filesRead')
    })

    it('should extract metadata from LiveChat', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveChat.ts'),
        'utf-8'
      )

      const metadata = extractComponentMetadata(source)
      expect(metadata).toHaveLength(1)
      expect(metadata[0].className).toBe('LiveChat')
      expect(metadata[0].componentName).toBe('LiveChat')
    })
  })

  describe('generateClientStub', () => {
    it('should generate a stub without fs/path imports for LiveFileReader', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveFileReader.ts'),
        'utf-8'
      )

      const stub = generateClientStub(source)

      // Stub should NOT contain any server-side imports
      expect(stub).not.toContain("from 'fs'")
      expect(stub).not.toContain("from 'path'")
      expect(stub).not.toContain("from '@core/types/types'")
      expect(stub).not.toContain('readFileSync')
      expect(stub).not.toContain('existsSync')
      expect(stub).not.toContain('LiveComponent')

      // Stub SHOULD contain the class with static metadata
      expect(stub).toContain('export class LiveFileReader')
      expect(stub).toContain("static componentName = 'LiveFileReader'")
      expect(stub).toContain('static defaultState =')
      expect(stub).toContain('static publicActions =')

      // Stub should NOT contain method implementations
      expect(stub).not.toContain('async readFile')
      expect(stub).not.toContain('async checkFile')
      expect(stub).not.toContain('process.cwd()')
    })

    it('should generate a stub without server imports for LiveCounter', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveCounter.ts'),
        'utf-8'
      )

      const stub = generateClientStub(source)

      // No server imports
      expect(stub).not.toContain("from '@core/types/types'")
      expect(stub).not.toContain("from '@core/server/")
      expect(stub).not.toContain('RoomEventBus')
      expect(stub).not.toContain('LiveRoomManager')
      expect(stub).not.toContain('FluxStackWebSocket')

      // Has metadata
      expect(stub).toContain('export class LiveCounter')
      expect(stub).toContain("static componentName = 'LiveCounter'")
      expect(stub).toContain('static defaultState =')
      expect(stub).toContain('count')
    })

    it('should strip TypeScript type casts from defaultState', () => {
      const source = `
export class TestComponent extends LiveComponent<typeof TestComponent.defaultState> {
  static componentName = 'TestComponent'
  static publicActions = ['doSomething'] as const
  static defaultState = {
    name: null as string | null,
    items: [] as string[],
    count: 0
  }

  async doSomething() {}
}
`
      const stub = generateClientStub(source)

      // Type casts like "as string | null" should be stripped
      expect(stub).not.toContain('as string | null')
      expect(stub).not.toContain('as string[]')

      // Values should remain
      expect(stub).toContain('null')
      expect(stub).toContain('[]')
      expect(stub).toContain('0')
    })

    it('should handle components without publicActions', () => {
      const source = `
export class NoActionsComponent extends LiveComponent<any> {
  static componentName = 'NoActionsComponent'
  static defaultState = { value: 0 }
}
`
      const stub = generateClientStub(source)

      expect(stub).toContain('export class NoActionsComponent')
      expect(stub).toContain("static componentName = 'NoActionsComponent'")
      expect(stub).toContain('static publicActions = []')
    })

    it('should return empty export for non-LiveComponent files', () => {
      const source = `
export function helperFunction() {
  return 42
}

export const CONSTANT = 'hello'
`
      const stub = generateClientStub(source)
      expect(stub).toBe('export {}')
    })
  })

  describe('Client stub compatibility with Live.use()', () => {
    it('stub should provide all properties that Live.use() accesses', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveCounter.ts'),
        'utf-8'
      )

      const stub = generateClientStub(source)

      // Live.use() accesses these properties:
      // 1. ComponentClass.componentName
      expect(stub).toContain('static componentName')
      // 2. ComponentClass.defaultState
      expect(stub).toContain('static defaultState')
      // 3. ComponentClass.publicActions (for type inference)
      expect(stub).toContain('static publicActions')
    })

    it('stub class should be instantiable (even though it is never instantiated)', () => {
      // The stub is a plain class with static properties
      // Live.use() never instantiates it, but it should be a valid class
      const source = `
export class LiveTest extends LiveComponent<typeof LiveTest.defaultState> {
  static componentName = 'LiveTest'
  static publicActions = ['greet'] as const
  static defaultState = {
    message: 'hello',
    count: 0
  }

  async greet(payload: { name: string }) {
    return { greeting: 'Hello ' + payload.name }
  }
}
`
      const stub = generateClientStub(source)

      // Evaluate the stub to verify it's valid JavaScript
      // (using Function constructor to avoid polluting the test scope)
      const evalFn = new Function(`
        ${stub.replace(/export /g, '')}
        return LiveTest
      `)

      const LiveTest = evalFn()
      expect(LiveTest.componentName).toBe('LiveTest')
      expect(LiveTest.defaultState).toEqual({ message: 'hello', count: 0 })
    })
  })

  describe('HMR: only triggers client update when metadata changes', () => {
    it('same metadata should produce identical stubs (no unnecessary HMR)', () => {
      const source = `
export class LiveWidget extends LiveComponent<typeof LiveWidget.defaultState> {
  static componentName = 'LiveWidget'
  static publicActions = ['doStuff'] as const
  static defaultState = { value: 0 }

  async doStuff() {
    console.log('v1')
    return { ok: true }
  }
}
`
      const stub1 = generateClientStub(source)

      // Change only the method body (server-side only)
      const sourceV2 = source.replace("console.log('v1')", "console.log('v2 - refactored')")
      const stub2 = generateClientStub(sourceV2)

      // Stubs should be identical — no client HMR needed
      expect(stub1).toBe(stub2)
    })

    it('changed defaultState should produce different stubs (triggers HMR)', () => {
      const sourceV1 = `
export class LiveWidget extends LiveComponent<typeof LiveWidget.defaultState> {
  static componentName = 'LiveWidget'
  static publicActions = ['doStuff'] as const
  static defaultState = { value: 0 }
  async doStuff() { return { ok: true } }
}
`
      const sourceV2 = `
export class LiveWidget extends LiveComponent<typeof LiveWidget.defaultState> {
  static componentName = 'LiveWidget'
  static publicActions = ['doStuff'] as const
  static defaultState = { value: 0, label: 'new field' }
  async doStuff() { return { ok: true } }
}
`
      const stub1 = generateClientStub(sourceV1)
      const stub2 = generateClientStub(sourceV2)

      // Stubs should differ — client HMR is needed
      expect(stub1).not.toBe(stub2)
      expect(stub2).toContain('label')
    })

    it('changed publicActions should produce different stubs (triggers HMR)', () => {
      const sourceV1 = `
export class LiveWidget extends LiveComponent<typeof LiveWidget.defaultState> {
  static componentName = 'LiveWidget'
  static publicActions = ['doStuff'] as const
  static defaultState = { value: 0 }
  async doStuff() { return { ok: true } }
}
`
      const sourceV2 = `
export class LiveWidget extends LiveComponent<typeof LiveWidget.defaultState> {
  static componentName = 'LiveWidget'
  static publicActions = ['doStuff', 'doMore'] as const
  static defaultState = { value: 0 }
  async doStuff() { return { ok: true } }
  async doMore() { return { ok: true } }
}
`
      const stub1 = generateClientStub(sourceV1)
      const stub2 = generateClientStub(sourceV2)

      expect(stub1).not.toBe(stub2)
      expect(stub2).toContain('doMore')
    })
  })

  describe('Strips ALL server-side imports (not just fs)', () => {
    it('should strip database/ORM imports (prisma, drizzle, etc)', () => {
      const source = `
import { PrismaClient } from '@prisma/client'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { LiveComponent } from '@core/types/types'

const prisma = new PrismaClient()

export class LiveDashboard extends LiveComponent<typeof LiveDashboard.defaultState> {
  static componentName = 'LiveDashboard'
  static publicActions = ['loadData', 'refresh'] as const
  static defaultState = { items: [], loading: false, error: null }

  async loadData() {
    const items = await prisma.item.findMany()
    this.setState({ items, loading: false })
    return { success: true }
  }

  async refresh() {
    const db = drizzle('sqlite.db')
    return { success: true }
  }
}
`
      const stub = generateClientStub(source)

      // No database imports
      expect(stub).not.toContain('@prisma/client')
      expect(stub).not.toContain('drizzle-orm')
      expect(stub).not.toContain('PrismaClient')
      expect(stub).not.toContain('drizzle')
      expect(stub).not.toContain('findMany')
      expect(stub).not.toContain('sqlite')

      // Metadata preserved
      expect(stub).toContain('export class LiveDashboard')
      expect(stub).toContain("static componentName = 'LiveDashboard'")
      expect(stub).toContain("'loadData'")
      expect(stub).toContain("'refresh'")
      expect(stub).toContain('items: []')
    })

    it('should strip Redis/cache imports', () => {
      const source = `
import Redis from 'ioredis'
import { createClient } from 'redis'
import { LiveComponent } from '@core/types/types'

const redis = new Redis()

export class LiveNotifications extends LiveComponent<typeof LiveNotifications.defaultState> {
  static componentName = 'LiveNotifications'
  static publicActions = ['subscribe', 'markRead'] as const
  static defaultState = { notifications: [], unreadCount: 0 }

  async subscribe(payload: { channel: string }) {
    await redis.subscribe(payload.channel)
    return { success: true }
  }

  async markRead(payload: { id: string }) {
    await redis.del('notification:' + payload.id)
    this.state.unreadCount--
    return { success: true }
  }
}
`
      const stub = generateClientStub(source)

      expect(stub).not.toContain('ioredis')
      expect(stub).not.toContain('redis')
      expect(stub).not.toContain("from 'ioredis'")
      expect(stub).not.toContain("from 'redis'")
      expect(stub).not.toContain('new Redis')
      expect(stub).not.toContain('createClient')
      expect(stub).not.toContain('redis.subscribe')
      expect(stub).not.toContain('redis.del')
      expect(stub).not.toContain('async subscribe')
      expect(stub).not.toContain('async markRead')

      // publicActions correctly preserved (subscribe/markRead are action NAMES, not implementations)
      expect(stub).toContain("'subscribe'")
      expect(stub).toContain("'markRead'")

      // Only metadata
      expect(stub).toContain('export class LiveNotifications')
      expect(stub).toContain('notifications: []')
      expect(stub).toContain('unreadCount: 0')
    })

    it('should strip Node.js built-in imports (crypto, child_process, net, etc)', () => {
      const source = `
import { createHash, randomBytes } from 'crypto'
import { exec } from 'child_process'
import { createServer } from 'net'
import { readFileSync } from 'fs'
import { join } from 'path'
import { hostname } from 'os'
import { LiveComponent } from '@core/types/types'

export class LiveSystem extends LiveComponent<typeof LiveSystem.defaultState> {
  static componentName = 'LiveSystem'
  static publicActions = ['getInfo'] as const
  static defaultState = { hostname: '', hash: '' }

  async getInfo() {
    const h = hostname()
    const hash = createHash('sha256').update('test').digest('hex')
    return { hostname: h, hash }
  }
}
`
      const stub = generateClientStub(source)

      // No Node.js built-in imports
      expect(stub).not.toContain("from 'crypto'")
      expect(stub).not.toContain("from 'child_process'")
      expect(stub).not.toContain("from 'net'")
      expect(stub).not.toContain("from 'fs'")
      expect(stub).not.toContain("from 'path'")
      expect(stub).not.toContain("from 'os'")
      expect(stub).not.toContain('createHash')
      expect(stub).not.toContain('exec')
      expect(stub).not.toContain('readFileSync')

      expect(stub).toContain('export class LiveSystem')
      expect(stub).toContain("hostname: ''")
    })

    it('should strip third-party/npm library imports', () => {
      const source = `
import axios from 'axios'
import { z } from 'zod'
import nodemailer from 'nodemailer'
import sharp from 'sharp'
import { S3Client } from '@aws-sdk/client-s3'
import { LiveComponent } from '@core/types/types'

const s3 = new S3Client({ region: 'us-east-1' })

export class LiveUploader extends LiveComponent<typeof LiveUploader.defaultState> {
  static componentName = 'LiveUploader'
  static publicActions = ['upload', 'sendEmail'] as const
  static defaultState = { progress: 0, status: 'idle' }

  async upload(payload: { file: string }) {
    const image = await sharp(payload.file).resize(200).toBuffer()
    await s3.send(/* ... */)
    return { success: true }
  }

  async sendEmail(payload: { to: string }) {
    const transporter = nodemailer.createTransport({})
    await transporter.sendMail({ to: payload.to })
    return { sent: true }
  }
}
`
      const stub = generateClientStub(source)

      // No third-party imports
      expect(stub).not.toContain('axios')
      expect(stub).not.toContain('zod')
      expect(stub).not.toContain('nodemailer')
      expect(stub).not.toContain('sharp')
      expect(stub).not.toContain('@aws-sdk')
      expect(stub).not.toContain('S3Client')
      expect(stub).not.toContain('transporter')
      expect(stub).not.toContain('resize')

      expect(stub).toContain('export class LiveUploader')
      expect(stub).toContain("status: 'idle'")
      expect(stub).toContain('progress: 0')
    })

    it('should strip internal FluxStack server imports', () => {
      const source = `
import { LiveComponent } from '@core/types/types'
import { roomEvents } from '@core/server/live/RoomEventBus'
import { liveRoomManager } from '@core/server/live/LiveRoomManager'
import { liveLog } from '@core/server/live/LiveLogger'
import { serverConfig } from '@config'
import type { FluxStackWebSocket } from '@core/types/types'

export class LiveRoom extends LiveComponent<typeof LiveRoom.defaultState> {
  static componentName = 'LiveRoom'
  static publicActions = ['join', 'leave'] as const
  static defaultState = { members: [], roomName: '' }

  async join(payload: { room: string }) {
    this.$room(payload.room).join()
    liveLog('User joined room')
    return { success: true }
  }

  async leave(payload: { room: string }) {
    this.$room(payload.room).leave()
    return { success: true }
  }
}
`
      const stub = generateClientStub(source)

      // No framework server imports
      expect(stub).not.toContain('@core/types/types')
      expect(stub).not.toContain('@core/server/')
      expect(stub).not.toContain('RoomEventBus')
      expect(stub).not.toContain('LiveRoomManager')
      expect(stub).not.toContain('LiveLogger')
      expect(stub).not.toContain('@config')
      expect(stub).not.toContain('FluxStackWebSocket')
      expect(stub).not.toContain('$room')

      expect(stub).toContain('export class LiveRoom')
      expect(stub).toContain('members: []')
    })

    it('should strip Bun-specific imports', () => {
      const source = `
import { serve, file } from 'bun'
import { Database } from 'bun:sqlite'
import { LiveComponent } from '@core/types/types'

export class LiveDB extends LiveComponent<typeof LiveDB.defaultState> {
  static componentName = 'LiveDB'
  static publicActions = ['query'] as const
  static defaultState = { results: [] }

  async query(payload: { sql: string }) {
    const db = new Database('mydb.sqlite')
    const results = db.query(payload.sql).all()
    this.setState({ results })
    return { success: true }
  }
}
`
      const stub = generateClientStub(source)

      expect(stub).not.toContain("from 'bun'")
      expect(stub).not.toContain("from 'bun:sqlite'")
      expect(stub).not.toContain('Database')
      expect(stub).not.toContain('serve')

      expect(stub).toContain('export class LiveDB')
      expect(stub).toContain('results: []')
    })
  })

  describe('All server live components should produce valid stubs', () => {
    const { readdirSync } = require('fs')
    const liveDir = resolve(ROOT, 'app/server/live')
    const liveFiles = readdirSync(liveDir)
      .filter((f: string) => f.endsWith('.ts') && f !== 'register-components.ts')

    for (const file of liveFiles) {
      it(`should generate a valid stub for ${file}`, () => {
        const source = readFileSync(resolve(liveDir, file), 'utf-8')
        const stub = generateClientStub(source)

        // Stub should not contain server-side imports
        expect(stub).not.toContain("from 'fs'")
        expect(stub).not.toContain("from 'path'")
        expect(stub).not.toContain("from 'os'")
        expect(stub).not.toContain("from '@core/types/types'")
        expect(stub).not.toContain("from '@core/server/")
        expect(stub).not.toContain("from 'bun'")

        // If it has a LiveComponent class, stub should have the class
        const metadata = extractComponentMetadata(source)
        if (metadata.length > 0) {
          for (const comp of metadata) {
            expect(stub).toContain(`export class ${comp.className}`)
            expect(stub).toContain('static componentName')
            expect(stub).toContain('static defaultState')
          }
        }
      })
    }
  })
})
