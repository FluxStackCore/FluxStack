import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Tests for the FluxStack Vite Plugin - Live Component Server Code Stripping
 *
 * Verifies that the plugin correctly:
 * 1. Extracts static metadata from server live components
 * 2. Generates client-safe stubs without server dependencies
 * 3. Strips TypeScript type casts from defaultState
 * 4. Preserves the class structure needed by Live.use()
 * 5. Detects metadata changes for HMR (ignores server-only changes)
 */

const ROOT = resolve(__dirname, '../../..')

// ── Replicate the plugin's internal logic for testing ────────────────

function extractBlock(src: string, start: number): string {
  let depth = 1, i = start + 1
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  return src.substring(start, i)
}

function stripAsCasts(s: string): string {
  const RE = /\s+as\s+/g
  let out = '', last = 0, m: RegExpExecArray | null

  while ((m = RE.exec(s)) !== null) {
    out += s.slice(last, m.index)
    let i = m.index + m[0].length
    const stack: string[] = []

    while (i < s.length) {
      const c = s[i]
      if (c === '{' || c === '<' || c === '(') { stack.push(c === '{' ? '}' : c === '<' ? '>' : ')'); i++ }
      else if (c === '[' && s[i + 1] === ']') { i += 2 }
      else if (c === '[') { stack.push(']'); i++ }
      else if (stack.length && c === stack[stack.length - 1]) { stack.pop(); i++; while (s[i] === '[' && s[i + 1] === ']') i += 2 }
      else if (!stack.length && (c === ',' || c === '\n' || c === '}')) break
      else i++
    }
    last = i
  }

  return out + s.slice(last)
}

function extractDefaultState(classBody: string): string {
  const m = classBody.match(/static\s+defaultState\s*=\s*/)
  if (!m) return '{}'
  const objStart = classBody.indexOf('{', m.index! + m[0].length)
  if (objStart === -1) return '{}'
  const raw = extractBlock(classBody, objStart)
  return stripAsCasts(raw)
}

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

    const classBody = extractBlock(source, classStartIndex)

    const componentNameMatch = classBody.match(
      /static\s+componentName\s*=\s*['"]([^'"]+)['"]/
    )
    const componentName = componentNameMatch ? componentNameMatch[1] : null

    const defaultState = extractDefaultState(classBody)

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

  return components.map(comp => {
    const componentName = comp.componentName || comp.className
    const defaultState = comp.defaultState || '{}'
    const publicActions = comp.publicActions || '[]'

    return `export class ${comp.className} {\n` +
      `  static componentName = '${componentName}'\n` +
      `  static defaultState = ${defaultState}\n` +
      `  static publicActions = ${publicActions}\n` +
      `}`
  }).join('\n\n')
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Vite Plugin - Live Component Server Code Stripping', () => {
  describe('extractComponentMetadata — real components', () => {
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

    it('should extract metadata from LiveRoomChat', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveRoomChat.ts'),
        'utf-8'
      )

      const metadata = extractComponentMetadata(source)
      expect(metadata).toHaveLength(1)
      expect(metadata[0].className).toBe('LiveRoomChat')
      expect(metadata[0].componentName).toBe('LiveRoomChat')
      expect(metadata[0].publicActions).toContain('joinRoom')
      expect(metadata[0].publicActions).toContain('sendMessage')
    })

    it('should extract metadata from LiveForm', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveForm.ts'),
        'utf-8'
      )

      const metadata = extractComponentMetadata(source)
      expect(metadata).toHaveLength(1)
      expect(metadata[0].className).toBe('LiveForm')
      expect(metadata[0].componentName).toBe('LiveForm')
      expect(metadata[0].publicActions).toContain('submit')
      expect(metadata[0].publicActions).toContain('reset')
      expect(metadata[0].publicActions).toContain('validate')
      expect(metadata[0].defaultState).toContain('name')
      expect(metadata[0].defaultState).toContain('email')
    })
  })

  describe('generateClientStub — stripping', () => {
    it('should strip server imports and produce clean stub for LiveCounter', () => {
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

      expect(stub).not.toContain('as string | null')
      expect(stub).not.toContain('as string[]')
      expect(stub).toContain('null')
      expect(stub).toContain('[]')
      expect(stub).toContain('0')
    })

    it('should strip complex type casts with generics', () => {
      const source = `
export class Complex extends LiveComponent<typeof Complex.defaultState> {
  static componentName = 'Complex'
  static publicActions = [] as const
  static defaultState = {
    data: {} as Record<string, Foo[]>,
    list: [] as { id: string }[]
  }
}
`
      const stub = generateClientStub(source)

      expect(stub).not.toContain('Record<string, Foo[]>')
      expect(stub).not.toContain('{ id: string }[]')
      expect(stub).toContain('{}')
      expect(stub).toContain('[]')
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

    it('should not contain method implementations in stubs', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveForm.ts'),
        'utf-8'
      )

      const stub = generateClientStub(source)

      expect(stub).not.toContain('async submit')
      expect(stub).not.toContain('async reset')
      expect(stub).not.toContain('async validate')
      expect(stub).not.toContain('this.setState')
    })
  })

  describe('Live.use() compatibility', () => {
    it('stub should provide all properties that Live.use() accesses', () => {
      const source = readFileSync(
        resolve(ROOT, 'app/server/live/LiveCounter.ts'),
        'utf-8'
      )

      const stub = generateClientStub(source)

      expect(stub).toContain('static componentName')
      expect(stub).toContain('static defaultState')
      expect(stub).toContain('static publicActions')
    })

    it('stub class should be evaluable as valid JavaScript', () => {
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

      const evalFn = new Function(`
        ${stub.replace(/export /g, '')}
        return LiveTest
      `)

      const LiveTest = evalFn()
      expect(LiveTest.componentName).toBe('LiveTest')
      expect(LiveTest.defaultState).toEqual({ message: 'hello', count: 0 })
    })
  })

  describe('HMR: metadata change detection', () => {
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
      const sourceV2 = sourceV1.replace(
        'static defaultState = { value: 0 }',
        "static defaultState = { value: 0, label: 'new field' }"
      )

      const stub1 = generateClientStub(sourceV1)
      const stub2 = generateClientStub(sourceV2)

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
      const sourceV2 = sourceV1.replace(
        "static publicActions = ['doStuff'] as const",
        "static publicActions = ['doStuff', 'doMore'] as const"
      )

      const stub1 = generateClientStub(sourceV1)
      const stub2 = generateClientStub(sourceV2)

      expect(stub1).not.toBe(stub2)
      expect(stub2).toContain('doMore')
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
