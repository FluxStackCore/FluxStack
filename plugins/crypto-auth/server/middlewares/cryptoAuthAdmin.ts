/**
 * Middleware que REQUER privilégios de administrador
 * Bloqueia requisições não autenticadas (401) ou sem privilégios admin (403)
 */

import { Elysia } from 'elysia'
import { createGuard } from '@core/server/middleware/elysia-helpers'
import type { Logger } from '@core/utils/logger'
import { validateAuthSync, type CryptoAuthUser } from './helpers'

export interface CryptoAuthMiddlewareOptions {
  logger?: Logger
}

export const cryptoAuthAdmin = (options: CryptoAuthMiddlewareOptions = {}) => {
  return new Elysia({ name: 'crypto-auth-admin' })
    .derive(async ({ request }) => {
      const result = await validateAuthSync(request as Request, options.logger)

      if (result.success && result.user) {
        ;(request as any).user = result.user
      }

      return {}
    })
    .use(
      createGuard<{ request: Request & { user?: CryptoAuthUser } }>({
        name: 'crypto-auth-admin-check',
        check: ({ request }) => {
          const user = request.user
          return !!(user && user.isAdmin)
        },
        onFail: (set, { request }) => {
          const user = request.user
          const s = set as { status: number }

          if (!user) {
            s.status = 401
            return {
              error: {
                message: 'Authentication required',
                code: 'CRYPTO_AUTH_REQUIRED',
                statusCode: 401
              }
            }
          }

          options.logger?.warn('Admin access denied', {
            publicKey: user.publicKey.substring(0, 8) + '...',
            permissions: user.permissions
          })

          s.status = 403
          return {
            error: {
              message: 'Admin privileges required',
              code: 'ADMIN_REQUIRED',
              statusCode: 403,
              yourPermissions: user.permissions
            }
          }
        }
      })
    )

}
