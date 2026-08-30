/**
 * FluxStack Cache - Memory Driver
 *
 * Armazena cache na memória do processo.
 * Ideal para desenvolvimento e testes.
 *
 * Para produção, troque por Redis, Memcached, etc.
 */

import type { CacheDriver } from './contracts'

interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number | null // null = sem expiração
}

export interface MemoryCacheOptions {
  /** Intervalo do GC periódico em ms. Default: 60000. */
  gcIntervalMs?: number
  /** Cap de entradas (anti-DoS de memória). 0 = ilimitado. Default: 10000. */
  maxEntries?: number
}

export class MemoryCacheDriver implements CacheDriver {
  private store = new Map<string, CacheEntry>()
  private gcInterval: ReturnType<typeof setInterval> | null = null
  private maxEntries: number

  constructor(opts: MemoryCacheOptions | number = {}) {
    // Compat: aceita number (gcIntervalMs) ou um objeto de opções.
    const o = typeof opts === 'number' ? { gcIntervalMs: opts } : opts
    this.maxEntries = o.maxEntries ?? 10_000
    // GC periódico para limpar entradas expiradas
    this.gcInterval = setInterval(() => this.gc(), o.gcIntervalMs ?? 60_000)
    if (this.gcInterval.unref) {
      this.gcInterval.unref()
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    // Verificar expiração
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    // LRU: marca como recém-usada (reinsere no fim da ordem de iteração).
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.value as T
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0
      ? Date.now() + (ttlSeconds * 1000)
      : null

    this.store.delete(key) // garante reordenação (chave vira a mais recente)
    this.store.set(key, { value, expiresAt })
    this.evictIfNeeded()
  }

  /** Evicta as entradas menos-recentemente-usadas quando passa do cap. */
  private evictIfNeeded(): void {
    if (this.maxEntries <= 0 || this.store.size <= this.maxEntries) return
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }

  async has(key: string): Promise<boolean> {
    // Sem materializar o valor nem reordenar: só checa existência + expiração.
    const entry = this.store.get(key)
    if (!entry) return false
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }
    return true
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  async flush(): Promise<void> {
    this.store.clear()
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const current = await this.get<number>(key)
    const newValue = (current ?? 0) + amount

    // Preservar TTL original se existir
    const entry = this.store.get(key)
    const remainingTtl = entry?.expiresAt
      ? Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
      : undefined

    await this.set(key, newValue, remainingTtl)
    return newValue
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount)
  }

  async remember<T = unknown>(key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached

    const value = await callback()
    await this.set(key, value, ttlSeconds)
    return value
  }

  async gc(): Promise<void> {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  /** Para testes: retorna quantidade de itens no cache */
  get size(): number {
    return this.store.size
  }

  /** Cleanup ao destruir */
  destroy(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval)
      this.gcInterval = null
    }
    this.store.clear()
  }
}
