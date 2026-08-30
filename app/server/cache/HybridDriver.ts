/**
 * FluxStack Cache - Hybrid Driver — EXEMPLO de CacheDriver.
 *
 * Três camadas, como caches de produção de alto volume:
 *
 *   1. ÍNDICE em memória  — `keyHash → expiresAt`. Existência/expiração não tocam
 *      o disco (rápido; a RAM só guarda metadados leves).
 *   2. CONTEÚDO em disco  — o valor (potencialmente grande) vive em arquivo, então
 *      o cache pode ser enorme e sobreviver a restart.
 *   3. JANELA QUENTE (LRU) — pequeno cache de leitura em RAM: ao ler do disco, o
 *      valor fica "quente", evitando reler o disco a cada hit (read-through).
 *
 * Performance & confiabilidade:
 * - I/O ASSÍNCRONO (fs/promises) — não bloqueia o event loop.
 * - Escrita ATÔMICA (tmp + rename) — crash no meio nunca corrompe o arquivo.
 * - Hash da key calculado UMA vez por operação (sha256 não é grátis).
 * - O índice usa o keyHash como chave (mesmo do nome de arquivo) → zero recálculo
 *   no delete/gc.
 *
 * Só um EXEMPLO do contrato — cada dev escolhe/implementa o que quiser.
 */

import { createHash, randomBytes } from 'crypto'
import { join } from 'path'
import { mkdirSync, readdirSync, readFileSync } from 'fs'
import { readFile, writeFile, rename, unlink, rm } from 'fs/promises'
import type { CacheDriver } from './contracts'

interface DiskEntry<T = unknown> { value: T; expiresAt: number | null }

export interface HybridCacheOptions {
  /** Diretório do conteúdo em disco. Default: '.cache/hybrid'. */
  dir?: string
  /** Tamanho da janela quente (itens mantidos em RAM após leitura). Default: 100. */
  hotSize?: number
  /** Intervalo do GC do índice/disco em ms. Default: 60000. */
  gcIntervalMs?: number
}

export class HybridCacheDriver implements CacheDriver {
  private dir: string
  private hotSize: number
  /** Índice leve em RAM: keyHash → expiração (null = sem expiração). */
  private index = new Map<string, number | null>()
  /** Janela quente (LRU): keyHash → valor já lido do disco. */
  private hot = new Map<string, unknown>()
  private gcTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts: HybridCacheOptions = {}) {
    this.dir = opts.dir ?? join(process.cwd(), '.cache', 'hybrid')
    this.hotSize = opts.hotSize ?? 100
    mkdirSync(this.dir, { recursive: true })
    this.rebuildIndex() // recupera o índice de um cache em disco preexistente (sync, 1x no boot)
    this.gcTimer = setInterval(() => { this.gc().catch(() => {}) }, opts.gcIntervalMs ?? 60_000)
    this.gcTimer.unref?.()
  }

  /** Hash da key (= nome do arquivo, sem extensão, = chave do índice). */
  private hash(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }
  private pathForHash(h: string): string {
    return join(this.dir, `${h}.json`)
  }

  /** Reconstrói o índice a partir dos arquivos no disco (persistência). */
  private rebuildIndex(): void {
    let files: string[]
    try { files = readdirSync(this.dir) } catch { return }
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      try {
        const entry = JSON.parse(readFileSync(join(this.dir, f), 'utf8')) as DiskEntry
        this.index.set(f.slice(0, -5), entry.expiresAt) // nome do arquivo = keyHash
      } catch { /* ignora arquivo inválido */ }
    }
  }

  /** Promove um valor à janela quente, evictando o mais antigo se cheia. */
  private touchHot(h: string, value: unknown): void {
    this.hot.delete(h) // reinsere no fim (LRU)
    this.hot.set(h, value)
    if (this.hot.size > this.hotSize) {
      const oldest = this.hot.keys().next().value as string | undefined
      if (oldest !== undefined) this.hot.delete(oldest)
    }
  }

  private isExpired(expiresAt: number | null): boolean {
    return expiresAt !== null && Date.now() > expiresAt
  }

  /** Remoção por hash (delete/gc reusam — sem recalcular o hash). */
  private async dropHash(h: string): Promise<boolean> {
    const existed = this.index.delete(h)
    this.hot.delete(h)
    await unlink(this.pathForHash(h)).catch(() => {})
    return existed
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const h = this.hash(key)
    // 1. Índice em memória decide existência/expiração sem tocar disco.
    if (!this.index.has(h)) return null
    if (this.isExpired(this.index.get(h)!)) { await this.dropHash(h); return null }
    // 2. Janela quente: hit em RAM evita ler o disco.
    if (this.hot.has(h)) return this.hot.get(h) as T
    // 3. Lê do disco (1 syscall) e aquece.
    let raw: string
    try {
      raw = await readFile(this.pathForHash(h), 'utf8')
    } catch {
      this.index.delete(h) // sumiu do disco — limpa o índice
      return null
    }
    try {
      const entry = JSON.parse(raw) as DiskEntry<T>
      if (this.isExpired(entry.expiresAt)) { await this.dropHash(h); return null }
      this.touchHot(h, entry.value)
      return entry.value
    } catch {
      await this.dropHash(h) // corrompido
      return null
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const h = this.hash(key)
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null
    const data = JSON.stringify({ value, expiresAt } as DiskEntry<T>)
    const file = this.pathForHash(h)
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await writeFile(tmp, data, 'utf8')
      await rename(tmp, file) // atômico
    } catch (err) {
      await unlink(tmp).catch(() => {})
      throw err
    }
    this.index.set(h, expiresAt)
    this.touchHot(h, value)
  }

  async has(key: string): Promise<boolean> {
    const h = this.hash(key)
    // Caminho rápido: índice + janela quente sem tocar disco.
    if (!this.index.has(h)) return false
    if (this.isExpired(this.index.get(h)!)) { await this.dropHash(h); return false }
    if (this.hot.has(h)) return true
    return (await this.get(key)) !== null
  }

  async delete(key: string): Promise<boolean> {
    return this.dropHash(this.hash(key))
  }

  async flush(): Promise<void> {
    this.index.clear()
    this.hot.clear()
    await rm(this.dir, { recursive: true, force: true }).catch(() => {})
    mkdirSync(this.dir, { recursive: true })
  }

  async increment(key: string, amount = 1): Promise<number> {
    const next = ((await this.get<number>(key)) ?? 0) + amount
    await this.set(key, next)
    return next
  }

  async decrement(key: string, amount = 1): Promise<number> {
    return this.increment(key, -amount)
  }

  async remember<T = unknown>(key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached
    const value = await callback()
    await this.set(key, value, ttlSeconds)
    return value
  }

  /** Limpa expirados (índice + janela quente + disco). Usa o keyHash do índice. */
  async gc(): Promise<void> {
    const now = Date.now()
    const expired: string[] = []
    for (const [h, expiresAt] of this.index) {
      if (expiresAt !== null && now > expiresAt) expired.push(h)
    }
    await Promise.all(expired.map(h => this.dropHash(h)))
    // A janela quente referencia hashes; remove os que saíram do índice.
    for (const h of this.hot.keys()) if (!this.index.has(h)) this.hot.delete(h)
  }

  /** Para testes/diagnóstico. */
  get indexSize(): number { return this.index.size }
  get hotCount(): number { return this.hot.size }

  destroy(): void {
    if (this.gcTimer) { clearInterval(this.gcTimer); this.gcTimer = null }
  }
}
