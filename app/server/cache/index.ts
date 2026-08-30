/**
 * FluxStack Cache System
 *
 * Sistema modular de cache. Hoje usa memória, amanhã Redis.
 *
 * ```ts
 * import { cache, cacheManager } from '@server/cache'
 *
 * // Usar cache padrão
 * await cache.set('user:1', userData, 3600)
 * const user = await cache.get('user:1')
 *
 * // Trocar driver
 * cacheManager.extend('redis', () => new MyRedisDriver())
 * const redis = cacheManager.driver('redis')
 * ```
 */

export type { CacheDriver } from './contracts'
export { CacheManager, cacheManager } from './CacheManager'

// Drivers de EXEMPLO — o dev escolhe (ou implementa o seu via `implements CacheDriver`).
export { MemoryCacheDriver } from './MemoryDriver'   // RAM (rápido, efêmero)
export { FileCacheDriver } from './FileDriver'       // disco (persiste)
export { HybridCacheDriver } from './HybridDriver'   // índice em RAM + conteúdo em disco + janela quente
export type { FileCacheOptions } from './FileDriver'
export type { HybridCacheOptions } from './HybridDriver'

/** Atalho: driver de cache padrão (lazy-initialized) */
import type { CacheDriver as CacheDriverType } from './contracts'
import { cacheManager as _cm } from './CacheManager'

let _cacheInstance: CacheDriverType | null = null

function getCacheInstance(): CacheDriverType {
  if (!_cacheInstance) {
    _cacheInstance = _cm.driver()
  }
  return _cacheInstance
}

export const cache: CacheDriverType = new Proxy({} as CacheDriverType, {
  get(_, prop: string) {
    const instance = getCacheInstance()
    const value = (instance as any)[prop]
    return typeof value === 'function' ? value.bind(instance) : value
  }
})
