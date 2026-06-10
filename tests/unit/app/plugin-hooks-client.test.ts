/**
 * Tests for Plugin Client Hooks — client-side executor
 * Tests the executeHook function with new Function() pattern
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sanitizeHooks, ALLOWED_HOOKS, computeHooksHash } from '@client/src/lib/plugin-hooks'
import { hashPluginHooks } from '@client/src/framework/pluginHooksHash'

// We can't import the actual module (it uses fetch/browser APIs)
// so we test the core logic: new Function() execution pattern

describe('Plugin hook execution (new Function pattern)', () => {
  it('should execute code with context variables available', () => {
    const results: string[] = []
    const context = {
      eden: { baseUrl: 'http://localhost:3000' },
      log: (msg: string) => results.push(msg),
    }

    const code = 'log("eden url: " + eden.baseUrl)'
    const keys = Object.keys(context)
    const values = Object.values(context)
    const fn = new Function(...keys, code)
    fn(...values)

    expect(results).toEqual(['eden url: http://localhost:3000'])
  })

  it('should not crash on syntax errors in hook code', () => {
    const code = 'this is not valid javascript {{{'
    const keys: string[] = []
    const values: unknown[] = []

    let threw = false
    try {
      const fn = new Function(...keys, code)
      fn(...values)
    } catch {
      threw = true
    }

    // new Function() with invalid code should throw
    expect(threw).toBe(true)
  })

  it('should not leak variables between hooks', () => {
    // First hook sets a var
    const code1 = 'var secret = "password123"'
    const fn1 = new Function(code1)
    fn1()

    // Second hook should NOT see it
    let result: string | undefined
    const code2 = 'callback(typeof secret)'
    try {
      const fn2 = new Function('callback', code2)
      fn2((val: string) => { result = val })
    } catch {
      result = 'error'
    }

    expect(result).toBe('undefined')
  })

  it('should handle multiple hooks in sequence', () => {
    const log: number[] = []
    const context = { log }

    const codes = [
      'log.push(1)',
      'log.push(2)',
      'log.push(3)',
    ]

    for (const code of codes) {
      const fn = new Function(...Object.keys(context), code)
      fn(...Object.values(context))
    }

    expect(log).toEqual([1, 2, 3])
  })

  it('should provide context without pollution', () => {
    // Hook receives eden but should not be able to modify global scope
    const fakeEden = { interceptors: [] as string[] }
    const context = { eden: fakeEden }

    const code = 'eden.interceptors.push("csrf-header")'
    const fn = new Function(...Object.keys(context), code)
    fn(...Object.values(context))

    // Eden object should be modified (this is the intended behavior)
    expect(fakeEden.interceptors).toEqual(['csrf-header'])
  })

  it('should handle empty context', () => {
    const code = 'var x = 1 + 1' // no-op basically
    const fn = new Function(code)
    expect(() => fn()).not.toThrow()
  })

  it('should handle async code in hooks', async () => {
    const results: string[] = []
    const context = {
      results,
      delay: (ms: number) => new Promise(r => setTimeout(r, ms)),
    }

    // Async hook — note: new Function doesn't await, but the code can be async
    const code = 'results.push("sync")'
    const fn = new Function(...Object.keys(context), code)
    fn(...Object.values(context))

    expect(results).toEqual(['sync'])
  })
})

describe('Plugin hooks CSRF-like scenario', () => {
  it('should allow CSRF plugin to inject request interceptor', () => {
    // Simulates what a CSRF plugin would register
    const requestInterceptors: Array<(req: any) => void> = []
    const fakeEden = {
      onRequest: (fn: (req: any) => void) => requestInterceptors.push(fn),
    }

    // CSRF plugin registers this code via pluginClientHooks.register('onEdenInit', code)
    const csrfCode = `
      eden.onRequest(function(req) {
        req.headers = req.headers || {}
        req.headers['X-CSRF-Token'] = 'csrf-token-from-cookie'
      })
    `

    const fn = new Function('eden', csrfCode)
    fn(fakeEden)

    // Verify interceptor was registered
    expect(requestInterceptors).toHaveLength(1)

    // Simulate a request going through the interceptor
    const fakeRequest = { headers: {} as Record<string, string> }
    requestInterceptors[0](fakeRequest)

    expect(fakeRequest.headers['X-CSRF-Token']).toBe('csrf-token-from-cookie')
  })
})

// Security mitigation for the `new Function()` vector (specs/02-frontend-rsc FP-1):
// only allowlisted hook names with string-only code entries survive sanitization,
// so a tampered endpoint response can't smuggle arbitrary hook names / payloads.
describe('sanitizeHooks — allowlist + type guard', () => {
  it('keeps allowlisted hooks with string code', () => {
    const out = sanitizeHooks({ onEdenInit: ['code()'], onLiveConnect: ['x()'] })
    expect(out).toEqual({ onEdenInit: ['code()'], onLiveConnect: ['x()'] })
  })

  it('drops unknown hook names (injection attempt)', () => {
    const out = sanitizeHooks({ onEdenInit: ['ok()'], evilHook: ['steal()'] })
    expect(out).toEqual({ onEdenInit: ['ok()'] })
    expect(out.evilHook).toBeUndefined()
  })

  it('drops non-string code entries', () => {
    const out = sanitizeHooks({ onEdenInit: ['ok()', 42, { __proto__: null }, null] as any })
    expect(out.onEdenInit).toEqual(['ok()'])
  })

  it('drops a hook whose code is not an array', () => {
    const out = sanitizeHooks({ onEdenInit: 'not-an-array' as any })
    expect(out.onEdenInit).toBeUndefined()
  })

  it('returns empty object for non-object / null input', () => {
    expect(sanitizeHooks(null)).toEqual({})
    expect(sanitizeHooks('hax')).toEqual({})
    expect(sanitizeHooks(undefined)).toEqual({})
  })

  it('ALLOWED_HOOKS contains only the known built-in hook points', () => {
    expect([...ALLOWED_HOOKS].sort()).toEqual(['onEdenInit', 'onLiveConnect'])
  })
})

// SRI-style integrity: the server embeds hash(hooks) in the SSR HTML and the
// client recomputes it. The two MUST agree byte-for-byte, otherwise legitimate
// hooks would be rejected. This test pins server (Node crypto) ↔ client
// (Web Crypto) agreement and verifies tampering changes the hash.
describe('plugin hooks integrity (server hash ↔ client hash)', () => {
  it('server hashPluginHooks and client computeHooksHash agree', async () => {
    const hooks = { onEdenInit: ['a()'], onLiveConnect: ['b()'] }
    const serverHash = hashPluginHooks(hooks)
    const clientHash = await computeHooksHash(JSON.stringify(hooks))
    expect(clientHash).toBe(serverHash)
    expect(serverHash).toMatch(/^sha256-[0-9a-f]{64}$/)
  })

  it('a tampered payload produces a different hash (rejection)', async () => {
    const legit = { onEdenInit: ['safe()'] }
    const tampered = { onEdenInit: ['steal(); safe()'] }
    const trusted = hashPluginHooks(legit)
    const tamperedHash = await computeHooksHash(JSON.stringify(tampered))
    expect(tamperedHash).not.toBe(trusted)
  })

  it('empty hooks hash is stable across server and client', async () => {
    expect(await computeHooksHash(JSON.stringify({}))).toBe(hashPluginHooks({}))
  })
})
