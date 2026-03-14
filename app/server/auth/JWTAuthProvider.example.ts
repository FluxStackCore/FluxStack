// 🔒 Exemplo: Como criar um LiveAuthProvider customizado (JWT)
//
// Este arquivo mostra como criar um provider de autenticação para Live Components.
// Copie e adapte para o seu caso de uso.
//
// Registro:
//   import { liveAuthManager } from '@core/server/live/auth'
//   import { JWTAuthProvider } from './auth/JWTAuthProvider'
//
//   liveAuthManager.register(new JWTAuthProvider('your-secret-key'))

import type {
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthContext,
} from '@fluxstack/live'
import { AuthenticatedContext } from '@fluxstack/live'

/**
 * Exemplo de provider JWT para Live Components.
 *
 * Em produção, use uma lib real como 'jose' ou 'jsonwebtoken'.
 * Este exemplo usa decode simples para fins didáticos.
 */
export class JWTAuthProvider implements LiveAuthProvider {
  readonly name = 'jwt'
  private secret: string

  constructor(secret: string) {
    this.secret = secret
  }

  async authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null> {
    const token = credentials.token as string
    if (!token) return null

    try {
      // Em produção: const payload = jwt.verify(token, this.secret)
      const payload = this.decodeToken(token)
      if (!payload) return null

      return new AuthenticatedContext(
        {
          id: payload.sub,
          roles: payload.roles || [],
          permissions: payload.permissions || [],
          name: payload.name,
          email: payload.email,
        },
        token
      )
    } catch {
      return null
    }
  }

  /**
   * (Opcional) Autorização customizada por action.
   * Se implementado, é chamado ALÉM da verificação de roles/permissions.
   * Útil para lógica de negócio complexa (ex: limites por plano, rate limiting).
   */
  async authorizeAction(
    context: LiveAuthContext,
    componentName: string,
    action: string
  ): Promise<boolean> {
    // Exemplo: bloquear ações destrutivas fora do horário comercial
    // const hour = new Date().getHours()
    // if (action === 'deleteAll' && (hour < 9 || hour > 18)) return false

    return true // Allow by default
  }

  /**
   * (Opcional) Autorização customizada por sala.
   * Útil para salas privadas, premium, etc.
   */
  async authorizeRoom(
    context: LiveAuthContext,
    roomId: string
  ): Promise<boolean> {
    // Exemplo: salas "vip-*" requerem role premium
    // if (roomId.startsWith('vip-') && !context.hasRole('premium')) return false

    return true // Allow by default
  }

  // Decode simplificado (NÃO USAR EM PRODUÇÃO - não valida assinatura)
  private decodeToken(token: string): any {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const payload = JSON.parse(atob(parts[1]))
      // Em produção: verificar expiração, assinatura, etc.
      if (payload.exp && payload.exp * 1000 < Date.now()) return null
      return payload
    } catch {
      return null
    }
  }
}
