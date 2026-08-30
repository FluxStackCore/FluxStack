// Tests for the driver OPTIMIZATIONS (perf + reliability): async I/O, atomic
// writes, LRU cap, hash reuse, corruption recovery. The contract suite in
// drivers.test.ts is the safety net; here we pin the new guarantees.
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { join } from 'path'
import { rmSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { MemoryCacheDriver } from '@app/server/cache/MemoryDriver'
import { FileCacheDriver } from '@app/server/cache/FileDriver'
import { HybridCacheDriver } from '@app/server/cache/HybridDriver'

const TMP = join(process.cwd(), '.cache', `opt-${process.pid}`)
afterEach(() => { try { rmSync(TMP, { recursive: true, force: true }) } catch {} })

describe('MemoryCacheDriver — LRU cap (anti-DoS)', () => {
  it('evicts least-recently-used beyond maxEntries', async () => {
    const d = new MemoryCacheDriver({ maxEntries: 2 })
    await d.set('a', 1)
    await d.set('b', 2)
    await d.get('a')        // touch 'a' → 'b' becomes LRU
    await d.set('c', 3)     // over cap → evict LRU ('b')
    expect(await d.get('a')).toBe(1)
    expect(await d.get('b')).toBeNull() // evicted
    expect(await d.get('c')).toBe(3)
  })

  it('maxEntries: 0 means unlimited', async () => {
    const d = new MemoryCacheDriver({ maxEntries: 0 })
    for (let i = 0; i < 50; i++) await d.set(`k${i}`, i)
    expect(await d.get('k0')).toBe(0)
    expect(await d.get('k49')).toBe(49)
  })

  it('backwards-compatible: constructor still accepts a number (gcIntervalMs)', async () => {
    const d = new MemoryCacheDriver(120_000)
    await d.set('k', 'v')
    expect(await d.get('k')).toBe('v')
  })

  it('has() does not reorder LRU (read-only existence check)', async () => {
    const d = new MemoryCacheDriver({ maxEntries: 2 })
    await d.set('a', 1)
    await d.set('b', 2)
    await d.has('a')        // must NOT make 'a' recent
    await d.set('c', 3)     // 'a' is still LRU → evicted
    expect(await d.get('a')).toBeNull()
    expect(await d.get('b')).toBe(2)
  })

  it('increment preserves TTL', async () => {
    const d = new MemoryCacheDriver()
    await d.set('n', 5, 60)
    expect(await d.increment('n')).toBe(6)
    expect(await d.get('n')).toBe(6) // ainda presente (TTL preservado)
  })
})

describe('FileCacheDriver — reliability', () => {
  let d: FileCacheDriver
  beforeEach(() => { d = new FileCacheDriver({ dir: TMP }) })

  it('atomic write: no .tmp files left after set', async () => {
    await d.set('k', { v: 1 })
    const leftovers = readdirSync(TMP).filter(f => f.endsWith('.tmp'))
    expect(leftovers).toHaveLength(0)
  })

  it('recovers from a corrupt cache file (treats as miss + cleans up)', async () => {
    await d.set('k', { v: 1 })
    // Corrupt the stored file.
    const file = readdirSync(TMP).find(f => f.endsWith('.json'))!
    writeFileSync(join(TMP, file), 'not json{{{')
    expect(await d.get('k')).toBeNull()      // miss, no throw
  })

  it('uses async I/O (set/get return promises that resolve)', async () => {
    const p = d.set('k', 1)
    expect(p).toBeInstanceOf(Promise)
    await p
    expect(await d.get('k')).toBe(1)
  })
})

describe('HybridCacheDriver — reliability', () => {
  let d: HybridCacheDriver
  beforeEach(() => { d = new HybridCacheDriver({ dir: TMP }) })
  afterEach(() => d.destroy())

  it('atomic write: no .tmp files left', async () => {
    await d.set('k', { v: 1 })
    expect(readdirSync(TMP).filter(f => f.endsWith('.tmp'))).toHaveLength(0)
  })

  it('recovers from a corrupt file and drops it from index', async () => {
    await d.set('k', { v: 1 })
    const file = readdirSync(TMP).find(f => f.endsWith('.json'))!
    // Evict from hot window so the read goes to disk.
    ;(d as any).hot.clear()
    writeFileSync(join(TMP, file), '###corrupt')
    expect(await d.get('k')).toBeNull()
    expect(d.indexSize).toBe(0) // dropped
  })

  it('has() fast-path uses index/hot without touching disk', async () => {
    await d.set('k', 'v')         // warms hot
    expect(await d.has('k')).toBe(true)
    expect(await d.has('missing')).toBe(false)
  })
})
