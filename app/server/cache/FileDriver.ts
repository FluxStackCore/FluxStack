/**
 * FluxStack Cache - File (disk) Driver — EXEMPLO de CacheDriver.
 *
 * Armazena cada entrada como um arquivo JSON no disco. Persiste entre restarts.
 *
 * Performance & confiabilidade:
 * - I/O ASSÍNCRONO (fs/promises) — não bloqueia o event loop do server.
 * - Escrita ATÔMICA (tmp + rename) — um crash no meio nunca deixa arquivo
 *   corrompido/truncado; ou o arquivo antigo ou o novo, nunca lixo.
 * - 1 syscall em vez de 2 (tenta ler e trata ENOENT, sem existsSync antes).
 *
 * É só um EXEMPLO do contrato — cada dev escolhe/implementa o que quiser.
 */

import { createHash, randomBytes } from 'crypto'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { readFile, writeFile, rename, unlink, readdir, rm } from 'fs/promises'
import type { CacheDriver } from './contracts'

interface FileEntry<T = unknown> {
  value: T
  expiresAt: number | null
}

export interface FileCacheOptions {
  /** Diretório onde os arquivos de cache vivem. Default: '.cache/file'. */
  dir?: string
}

export class FileCacheDriver implements CacheDriver {
  private dir: string

  constructor(opts: FileCacheOptions = {}) {
    this.dir = opts.dir ?? join(process.cwd(), '.cache', 'file')
    mkdirSync(this.dir, { recursive: true }) // só no construtor (1x), sync é ok aqui
  }

  /** Nome de arquivo seguro a partir da key (hash → sem chars inválidos). */
  private pathFor(key: string): string {
    return join(this.dir, `${createHash('sha256').update(key).digest('hex')}.json`)
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const file = this.pathFor(key)
    let raw: string
    try {
      raw = await readFile(file, 'utf8') // 1 syscall; ENOENT/erro = miss
    } catch {
      return null
    }
    let entry: FileEntry<T>
    try {
      entry = JSON.parse(raw)
    } catch {
      // Arquivo corrompido → remove e trata como miss.
      unlink(file).catch(() => {})
      return null
    }
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      unlink(file).catch(() => {}) // expirado — limpa em background
      return null
    }
    return entry.value
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null
    const data = JSON.stringify({ value, expiresAt } as FileEntry<T>)
    const file = this.pathFor(key)
    // Escrita atômica: grava num tmp único e renomeia (rename é atômico no SO).
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await writeFile(tmp, data, 'utf8')
      await rename(tmp, file)
    } catch (err) {
      await unlink(tmp).catch(() => {})
      throw err
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null // get já valida expiração; barato o suficiente
  }

  async delete(key: string): Promise<boolean> {
    try {
      await unlink(this.pathFor(key))
      return true
    } catch {
      return false // não existia
    }
  }

  async flush(): Promise<void> {
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

  async gc(): Promise<void> {
    const now = Date.now()
    let files: string[]
    try {
      files = await readdir(this.dir)
    } catch {
      return
    }
    // Varre em paralelo (limitado pelo SO), sem bloquear.
    await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async f => {
        const path = join(this.dir, f)
        try {
          const entry = JSON.parse(await readFile(path, 'utf8')) as FileEntry
          if (entry.expiresAt !== null && now > entry.expiresAt) await unlink(path).catch(() => {})
        } catch {
          await unlink(path).catch(() => {}) // corrompido → remove
        }
      }),
    )
  }
}
