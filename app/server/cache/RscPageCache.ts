/**
 * RSC/SSR page cache — helpers (model Next.js: Full Route Cache).
 *
 * The actual STORAGE is delegated to the app's pluggable `CacheDriver`
 * (cacheManager.driver(...)), so the dev chooses where pages are cached
 * (in-memory by default; Redis/custom via cacheManager.extend()). No new
 * dependency is required — it reuses the existing cache infrastructure.
 *
 * Following the Next.js model, the cached HTML is USER-AGNOSTIC: no CSRF token
 * or per-user data is embedded (the token lives only in the XSRF-TOKEN cookie,
 * set per-request), so a cached page is safe to share AND CDN-cacheable.
 *
 * This module is pure (no storage, no Vite/RSC deps) → fully unit-testable.
 */
import { createHash } from 'crypto'

/** Value stored in the cache driver for one rendered page. */
export interface CachedPage {
  html: string
  etag: string          // strong ETag over `html`
  contentType: string
}

/** Cache key namespace, so page entries don't collide with other cache users. */
export const PAGE_CACHE_PREFIX = 'rsc:page:'

/** Build the cache key. The `.rsc` variant and the HTML variant differ in body
 *  and content-type, so the variant is part of the key. Query strings are NOT
 *  cached (handled by the caller's bypass), so the key is just the path. */
export function normalizeCacheKey(pathname: string): { key: string; isRscNav: boolean } {
  const isRscNav = pathname.endsWith('.rsc')
  let path = isRscNav ? pathname.slice(0, -4) : pathname
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (path === '') path = '/'
  return { key: `${PAGE_CACHE_PREFIX}${isRscNav ? 'rsc' : 'html'}:${path}`, isRscNav }
}

/** Strong ETag over the (user-agnostic) HTML. */
export function computeEtag(html: string): string {
  return '"' + createHash('sha256').update(html).digest('hex').slice(0, 32) + '"'
}

/** Build the cached value from a freshly-rendered page. */
export function makeCachedPage(html: string, contentType: string): CachedPage {
  return { html, etag: computeEtag(html), contentType }
}

/**
 * Interpreta a diretiva de cache por-página (header `x-rsc-cache`, override
 * estilo Next): `'off'` → não cacheia; `'ttl:<n>'` → TTL custom; ausente →
 * comportamento padrão. Retorna `{ off, ttl? }`.
 */
export function parseCacheDirective(directive: string | null | undefined): { off: boolean; ttl?: number } {
  if (directive === 'off') return { off: true }
  if (directive && directive.startsWith('ttl:')) {
    const n = Number(directive.slice(4))
    if (Number.isFinite(n) && n > 0) return { off: false, ttl: n }
  }
  return { off: false }
}
