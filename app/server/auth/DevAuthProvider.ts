// 🧪 DevAuthProvider - Provider de desenvolvimento para testes de auth
//
// Aceita tokens simples para facilitar testes da demo de autenticação.
// NÃO USAR EM PRODUÇÃO!
//
// Tokens válidos:
//   - "admin-token" → role: admin, permissions: all
//   - "user-token"  → role: user, permissions: básicas
//   - "mod-token"   → role: moderator, permissions: moderação

import type {
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthContext,
} from '@fluxstack/live'
import { AuthenticatedContext } from '@fluxstack/live'

interface DevUser {
  id: string
  name: string
  roles: string[]
  permissions: string[]
}

const DEV_USERS: Record<string, DevUser> = {
  'admin-token': {
    id: 'admin-1',
    name: 'Admin User',
    roles: ['admin', 'user'],
    permissions: ['users.read', 'users.write', 'users.delete', 'chat.read', 'chat.write', 'chat.admin'],
  },
  'user-token': {
    id: 'user-1',
    name: 'Regular User',
    roles: ['user'],
    permissions: ['chat.read', 'chat.write'],
  },
  'mod-token': {
    id: 'mod-1',
    name: 'Moderator',
    roles: ['moderator', 'user'],
    permissions: ['chat.read', 'chat.write', 'chat.moderate'],
  },
}

export class DevAuthProvider implements LiveAuthProvider {
  readonly name = 'dev'

  async authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null> {
    const token = credentials.token as string
    if (!token) return null

    const user = DEV_USERS[token]
    if (!user) return null

    return new AuthenticatedContext(
      {
        id: user.id,
        name: user.name,
        roles: user.roles,
        permissions: user.permissions,
      },
      token
    )
  }
}
