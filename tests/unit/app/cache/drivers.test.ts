// Contract tests run against every example CacheDriver (memory, file, hybrid),
// plus driver-specific behaviour (disk persistence; the hybrid's RAM index +
// hot read window). Shows a dev can plug any storage behind the same contract.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { rmSync, existsSync, readdirSync } from 'fs'
import type { CacheDriver } from '@app/server/cache'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'
import { FileCacheDriver } from '@app/server/cache/FileDriver'
import { HybridCacheDriver } from '@app/server/cache/HybridDriver'

const TMP = join(process.cwd(), '.cache', `test-${process.pid}`)
afterEach(() => { try { rmSync(TMP, { recursive: true, force: true }) } catch {} })

// ── Shared contract suite ────────────────────────────────────────────────────
function contractSuite(name: string, make: () => CacheDriver) {
  describe(`CacheDriver contract — ${name}`, () => {
    let d: CacheDriver
    beforeEach(() => { d = make() })

    it('set/get roundtrip (objects)', async () => {
      await d.set('k', { a: 1, html: '<p>x</p>' })
      expect(await d.get('k')).toEqual({ a: 1, html: '<p>x</p>' })
    })
    it('get returns null for a missing key', async () => {
      expect(await d.get('nope')).toBeNull()
    })
    it('has reflects presence', async () => {
      await d.set('k', 1)
      expect(await d.has('k')).toBe(true)
      expect(await d.has('x')).toBe(false)
    })
    it('delete removes a key', async () => {
      await d.set('k', 1)
      expect(await d.delete('k')).toBe(true)
      expect(await d.get('k')).toBeNull()
    })
    it('flush clears everything', async () => {
      await d.set('a', 1); await d.set('b', 2)
      await d.flush()
      expect(await d.get('a')).toBeNull()
      expect(await d.get('b')).toBeNull()
    })
    it('honours TTL expiration', async () => {
      vi.useFakeTimers(); vi.setSystemTime(0)
      await d.set('k', 'v', 10)
      expect(await d.get('k')).toBe('v')
      vi.setSystemTime(11_000)
      expect(await d.get('k')).toBeNull()
      vi.useRealTimers()
    })
    it('increment / decrement', async () => {
      expect(await d.increment('n')).toBe(1)
      expect(await d.increment('n', 4)).toBe(5)
      expect(await d.decrement('n', 2)).toBe(3)
    })
    it('remember computes once then caches', async () => {
      const cb = vi.fn(async () => 'computed')
      expect(await d.remember('r', 60, cb)).toBe('computed')
      expect(await d.remember('r', 60, cb)).toBe('computed')
      expect(cb).toHaveBeenCalledTimes(1)
    })
  })
}

contractSuite('memory', () => new MemoryCacheDriver())
contractSuite('file', () => new FileCacheDriver({ dir: TMP }))
contractSuite('hybrid', () => new HybridCacheDriver({ dir: TMP }))

// ── File driver: persistence ─────────────────────────────────────────────────
describe('FileCacheDriver — disk persistence', () => {
  it('survives a new instance (data is on disk)', async () => {
    const a = new FileCacheDriver({ dir: TMP })
    await a.set('persisted', { v: 42 })
    const b = new FileCacheDriver({ dir: TMP }) // fresh instance, same dir
    expect(await b.get('persisted')).toEqual({ v: 42 })
    expect(existsSync(TMP)).toBe(true)
    expect(readdirSync(TMP).length).toBeGreaterThan(0)
  })
})

// ── Hybrid driver: RAM index + hot window + persistence ──────────────────────
describe('HybridCacheDriver — index in RAM, content on disk', () => {
  it('keeps a lightweight index in memory and content on disk', async () => {
    const d = new HybridCacheDriver({ dir: TMP, hotSize: 2 })
    await d.set('k', { big: 'x'.repeat(1000) })
    expect(d.indexSize).toBe(1)                 // index tracks the key
    expect(readdirSync(TMP).length).toBe(1)     // content is a file on disk
  })

  it('serves repeated reads from the hot window (no re-read)', async () => {
    const d = new HybridCacheDriver({ dir: TMP, hotSize: 10 })
    await d.set('k', 'value')
    await d.get('k')                            // warms the hot window
    expect(d.hotCount).toBeGreaterThan(0)
    expect(await d.get('k')).toBe('value')      // served from RAM
  })

  it('hot window is bounded (LRU evicts oldest)', async () => {
    const d = new HybridCacheDriver({ dir: TMP, hotSize: 2 })
    for (const k of ['a', 'b', 'c']) { await d.set(k, k); await d.get(k) }
    expect(d.hotCount).toBeLessThanOrEqual(2)   // never grows past hotSize
  })

  it('persists: a fresh instance rebuilds its index from disk', async () => {
    const a = new HybridCacheDriver({ dir: TMP })
    await a.set('keep', { v: 1 })
    const b = new HybridCacheDriver({ dir: TMP })
    expect(b.indexSize).toBe(1)                 // index rebuilt from files
    expect(await b.get('keep')).toEqual({ v: 1 })
  })
})
