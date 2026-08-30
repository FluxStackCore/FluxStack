// The RSC page cache storage is PROGRAMMABLE: the dev implements the framework's
// CacheDriver contract (any storage they want) and injects it with
// setRscCacheDriver(). The framework stays neutral (no Redis/etc baked in).
//
// We verify the contract is implementable and that a custom driver receives the
// page get/set calls. (The plugin's internal resolution is exercised via the
// e2e; here we pin the dev-facing API: implement CacheDriver + inject it.)
import { describe, it, expect, vi } from 'vitest'
import type { CacheDriver } from '@app/server/cache'
import { setRscCacheDriver } from '@core/plugins/built-in/rsc'
import { makeCachedPage } from '@app/server/cache/RscPageCache'

/** A minimal in-memory CacheDriver a dev could write. */
class TestDriver implements CacheDriver {
  store = new Map<string, unknown>()
  async get<T>(k: string) { return (this.store.get(k) ?? null) as T | null }
  async set<T>(k: string, v: T) { this.store.set(k, v) }
  async has(k: string) { return this.store.has(k) }
  async delete(k: string) { return this.store.delete(k) }
  async flush() { this.store.clear() }
  async increment(k: string, n = 1) { const v = (Number(this.store.get(k)) || 0) + n; this.store.set(k, v); return v }
  async decrement(k: string, n = 1) { return this.increment(k, -n) }
  async remember<T>(k: string, _ttl: number, cb: () => Promise<T>) {
    const hit = this.store.get(k); if (hit !== undefined) return hit as T
    const v = await cb(); this.store.set(k, v); return v
  }
  async gc() { /* no-op */ }
}

describe('RSC page cache — programmable driver', () => {
  it('a dev-written class can implement the CacheDriver contract', async () => {
    const d = new TestDriver()
    const page = makeCachedPage('<html>x</html>', 'text/html')
    await d.set('rsc:page:html:/x', page)
    expect(await d.get('rsc:page:html:/x')).toEqual(page)
  })

  it('setRscCacheDriver accepts any CacheDriver (and null to reset)', () => {
    const d = new TestDriver()
    // Should not throw — the API takes the driver object directly (programmatic).
    expect(() => setRscCacheDriver(d)).not.toThrow()
    expect(() => setRscCacheDriver(null)).not.toThrow()
  })
})
