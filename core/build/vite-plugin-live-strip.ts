/**
 * FluxStack Vite Plugin — strips server code from @server/live/* imports.
 *
 * Client components import server LiveComponent classes for type inference,
 * but only need 3 static properties: componentName, defaultState, publicActions.
 *
 * This plugin intercepts those imports and redirects them to tiny .js stubs
 * inside app/client/.live-stubs/ that export only those 3 properties.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { resolve, dirname, join } from 'path'
import type { Plugin, ModuleNode } from 'vite'

// Stubs are generated inside the Vite root (app/client/) so they're served normally
const STUB_DIR_NAME = '.live-stubs'

// ── Metadata extraction ──────────────────────────────────────────────

interface ComponentMeta {
  className: string
  componentName: string
  defaultState: string   // raw JS object literal (type casts stripped)
  publicActions: string  // raw JS array literal
}

/** Read a server .ts file and pull out the 3 static fields we need. */
function extractMeta(filePath: string): ComponentMeta[] {
  const src = readFileSync(filePath, 'utf-8')
  const results: ComponentMeta[] = []

  // Find each `export class Foo extends LiveComponent`
  const re = /export\s+class\s+(\w+)\s+extends\s+LiveComponent/g
  let m: RegExpExecArray | null

  while ((m = re.exec(src)) !== null) {
    const className = m[1]
    const body = extractBlock(src, src.indexOf('{', m.index))

    const name = body.match(/static\s+componentName\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? className
    const actions = body.match(/static\s+publicActions\s*=\s*(\[[^\]]*\])/)?.[1] ?? '[]'
    const state = extractDefaultState(body)

    results.push({ className, componentName: name, defaultState: state, publicActions: actions })
  }

  return results
}

/** Extract a brace-balanced block starting at position `start`. */
function extractBlock(src: string, start: number): string {
  let depth = 1, i = start + 1
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  return src.substring(start, i)
}

/** Pull out `static defaultState = { ... }` and strip TS type casts. */
function extractDefaultState(classBody: string): string {
  const m = classBody.match(/static\s+defaultState\s*=\s*/)
  if (!m) return '{}'

  const objStart = classBody.indexOf('{', m.index! + m[0].length)
  if (objStart === -1) return '{}'

  const raw = extractBlock(classBody, objStart)
  return stripAsCasts(raw)
}

/**
 * Remove `as <Type>` casts, handling nested generics/brackets.
 * e.g. `null as string | null` → `null`
 *      `[] as { id: string }[]` → `[]`
 *      `{} as Record<string, Foo[]>` → `{}`
 */
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

// ── Stub generation ──────────────────────────────────────────────────

function buildStub(metas: ComponentMeta[]): string {
  if (!metas.length) return 'export {}'
  return metas.map(m =>
    `export class ${m.className} {\n` +
    `  static componentName = '${m.componentName}'\n` +
    `  static defaultState = ${m.defaultState}\n` +
    `  static publicActions = ${m.publicActions}\n` +
    `}`
  ).join('\n\n')
}

// ── Plugin ───────────────────────────────────────────────────────────

function norm(p: string) { return p.replace(/\\/g, '/') }

export function fluxstackLiveStripPlugin(): Plugin {
  let projectRoot: string
  let stubDir: string
  const nameToFile = new Map<string, string>()
  const fileToName = new Map<string, string>()
  const cache = new Map<string, string>()

  function writeStub(name: string, serverPath: string): string {
    const stubPath = join(stubDir, `${name}.js`)
    const content = buildStub(extractMeta(serverPath))
    if (cache.get(name) !== content) {
      writeFileSync(stubPath, content, 'utf-8')
      cache.set(name, content)
    }
    return stubPath
  }

  return {
    name: 'fluxstack-live-strip',
    enforce: 'pre',

    configResolved(config) {
      projectRoot = config.configFile ? dirname(config.configFile) : resolve(config.root, '../..')
      stubDir = join(config.root, STUB_DIR_NAME)
      if (!existsSync(stubDir)) mkdirSync(stubDir, { recursive: true })
    },

    resolveId(source, importer) {
      if (!source.startsWith('@server/live/') || !importer) return null
      const imp = norm(importer)
      if (!imp.includes('/app/client/') && !imp.includes('/core/client/')) return null

      const name = source.replace('@server/live/', '')
      const abs = resolve(projectRoot, source.replace('@server/', 'app/server/'))
      const ts = abs.endsWith('.ts') ? abs : abs + '.ts'

      nameToFile.set(name, ts)
      fileToName.set(norm(ts), name)

      return writeStub(name, ts)
    },

    handleHotUpdate({ file, server }): ModuleNode[] | void {
      const name = fileToName.get(norm(file))
      if (!name) return

      const serverPath = nameToFile.get(name)!
      const oldContent = cache.get(name)
      const newContent = buildStub(extractMeta(serverPath))

      if (newContent === oldContent) return []

      writeStub(name, serverPath)

      const stubPath = norm(join(stubDir, `${name}.js`))
      const mods = server.moduleGraph.getModulesByFile(stubPath)
      if (mods?.size) {
        const arr = [...mods]
        arr.forEach(m => server.moduleGraph.invalidateModule(m))
        server.config.logger.info(`[live-strip] HMR: ${name} metadata changed`, { timestamp: true })
        return arr
      }
    },

    buildEnd() {
      if (existsSync(stubDir)) rmSync(stubDir, { recursive: true, force: true })
    },
  }
}
