/**
 * Session Configuration
 *
 * Configuração do sistema de sessões.
 * Inspirado no config/session.php do Laravel.
 */

import { defineConfig, config } from '@fluxstack/config'

const sessionConfigSchema = {
  /** Driver de sessão (memory = processo, extensível para redis, database) */
  driver: config.enum('SESSION_DRIVER', ['memory'] as const, 'memory'),
  /** Tempo de vida da sessão em segundos (default: 7200 = 2 horas) */
  lifetime: config.number('SESSION_LIFETIME', 7200),
  /** Nome do cookie de sessão */
  cookieName: config.string('SESSION_COOKIE', 'fluxstack_session'),
  /** Cookie httpOnly (default: true) */
  httpOnly: config.boolean('SESSION_HTTP_ONLY', true),
  /** Cookie secure - auto-detects production (default: true in production, false in dev) */
  secure: config.boolean('SESSION_SECURE', process.env.NODE_ENV === 'production'),
  /** Cookie sameSite */
  sameSite: config.enum('SESSION_SAME_SITE', ['strict', 'lax', 'none'] as const, 'lax'),
  /** Cookie path */
  path: config.string('SESSION_PATH', '/'),
  /** Cookie domain (vazio = current domain) */
  domain: config.string('SESSION_DOMAIN', ''),
} as const

export const sessionConfig = defineConfig(sessionConfigSchema)

export type SessionConfig = typeof sessionConfig

export default sessionConfig
