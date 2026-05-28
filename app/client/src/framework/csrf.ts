// CSRF via SSR — gera o token no server e o entrega já no HTML.
//
// Em vez do client fazer fetch('/api/__csrf') após carregar (round-trip extra),
// o render SSR gera o token, injeta <meta name="csrf-token"> no <head> e seta o
// cookie XSRF-TOKEN na resposta. O client nasce com o token — zero round-trip.
// (Padrão Rails/Laravel/Livewire: token no HTML inicial.)

import { randomBytes } from 'crypto'

export const CSRF_COOKIE = 'XSRF-TOKEN'

/** Gera um token CSRF hex (mesmo formato do CsrfService do plugin). */
export function generateCsrfToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/** Monta o Set-Cookie do token (NÃO httpOnly — o JS client precisa ler). */
export function buildCsrfCookie(token: string, secure: boolean): string {
  const parts = [`${CSRF_COOKIE}=${token}`, 'Path=/', 'SameSite=Lax']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}
