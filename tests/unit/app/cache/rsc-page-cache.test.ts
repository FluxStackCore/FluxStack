import { describe, it, expect } from 'vitest'
import {
  normalizeCacheKey, computeEtag, makeCachedPage, parseCacheDirective, PAGE_CACHE_PREFIX,
} from '@app/server/cache/RscPageCache'

// The page cache now delegates STORAGE to the pluggable CacheDriver
// (cacheManager.driver) — its TTL/eviction/persistence are covered by the
// driver's own tests. Here we test the pure page helpers: key, etag, value.

describe('normalizeCacheKey', () => {
  it('namespaces keys under the page prefix', () => {
    expect(normalizeCacheKey('/about').key.startsWith(PAGE_CACHE_PREFIX)).toBe(true)
  })
  it('distinguishes html vs .rsc variants for the same path', () => {
    expect(normalizeCacheKey('/about').key).toBe(`${PAGE_CACHE_PREFIX}html:/about`)
    expect(normalizeCacheKey('/about.rsc').key).toBe(`${PAGE_CACHE_PREFIX}rsc:/about`)
  })
  it('collapses trailing slash but keeps root', () => {
    expect(normalizeCacheKey('/about/').key).toBe(`${PAGE_CACHE_PREFIX}html:/about`)
    expect(normalizeCacheKey('/').key).toBe(`${PAGE_CACHE_PREFIX}html:/`)
  })
  it('flags rsc navigation', () => {
    expect(normalizeCacheKey('/x.rsc').isRscNav).toBe(true)
    expect(normalizeCacheKey('/x').isRscNav).toBe(false)
  })
})

describe('computeEtag', () => {
  it('is deterministic and changes with content', () => {
    expect(computeEtag('a')).toBe(computeEtag('a'))
    expect(computeEtag('a')).not.toBe(computeEtag('b'))
    expect(computeEtag('a')).toMatch(/^"[0-9a-f]{32}"$/)
  })
})

describe('parseCacheDirective — per-page override (Next-style)', () => {
  it('"off" disables caching for the route', () => {
    expect(parseCacheDirective('off')).toEqual({ off: true })
  })
  it('"ttl:<n>" sets a custom TTL', () => {
    expect(parseCacheDirective('ttl:120')).toEqual({ off: false, ttl: 120 })
  })
  it('absent / unknown → default behaviour (cache with default ttl)', () => {
    expect(parseCacheDirective(null)).toEqual({ off: false })
    expect(parseCacheDirective(undefined)).toEqual({ off: false })
    expect(parseCacheDirective('garbage')).toEqual({ off: false })
  })
  it('ignores a non-positive / non-numeric ttl', () => {
    expect(parseCacheDirective('ttl:0')).toEqual({ off: false })
    expect(parseCacheDirective('ttl:-5')).toEqual({ off: false })
    expect(parseCacheDirective('ttl:abc')).toEqual({ off: false })
  })
})

describe('makeCachedPage', () => {
  it('builds a user-agnostic cached value with a strong etag', () => {
    const page = makeCachedPage('<html>public</html>', 'text/html')
    expect(page.html).toBe('<html>public</html>')
    expect(page.contentType).toBe('text/html')
    expect(page.etag).toMatch(/^"[0-9a-f]{32}"$/)
  })
  it('SECURITY: carries no per-user token (HTML is rendered token-free)', () => {
    const page = makeCachedPage('<html><body>public</body></html>', 'text/html')
    expect(page.html).not.toMatch(/csrf|token/i)
  })
})
