// Página /auth (file-based). Demo Live — React normal.
import { LivePage } from '../framework/LivePage'
import { AuthDemo } from '../live/AuthDemo'

export const title = 'Auth'

export default function AuthPage() {
  return (
    <LivePage title="Auth" description="Autenticação declarativa para Live Components com $auth.">
      <AuthDemo />
    </LivePage>
  )
}
