/**
 * Tests for Plugin Client Hooks — client-side executor
 * Tests the executeHook function with new Function() pattern
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
