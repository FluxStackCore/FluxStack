import { useState } from 'react'
import { Live, useLiveComponents } from '@/core/client'
import { LiveCounter } from '@server/live/LiveCounter'
import { LiveAdminPanel } from '@server/live/LiveAdminPanel'
import { FaKey, FaLock, FaShieldHalved, FaUserPlus, FaUsers } from 'react-icons/fa6'

function PublicCounter() {
  const counter = Live.use(LiveCounter, {
    room: 'public-counter',
    initialState: LiveCounter.defaultState,
    persistState: false,
  })

  return (
    <section className="rounded-lg border border-white/10 bg-[#07070b]/85 p-5 shadow-2xl shadow-black/20">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200">
            Public
          </span>
          <h2 className="mt-4 text-xl font-semibold text-white">Public counter</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Mounts without auth and exposes the proxy auth flag.</p>
        </div>
        <FaUsers className="text-theme" />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-4">
        <button onClick={() => counter.decrement()} className="h-10 w-10 rounded-lg border border-white/10 bg-white/[0.03] text-white">-</button>
        <span className="bg-theme-gradient bg-clip-text text-5xl font-semibold text-transparent">{counter.$state.count}</span>
        <button onClick={() => counter.increment()} className="h-10 w-10 rounded-lg bg-white text-black">+</button>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-gray-500">
        $authenticated: <code className="text-amber-200">{String(counter.$authenticated)}</code>
      </div>
    </section>
  )
}

function AdminPanel() {
  const [newUserName, setNewUserName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const panel = Live.use(LiveAdminPanel, { persistState: false })

  if (panel.$error?.includes('AUTH_DENIED')) {
    return (
      <section className="rounded-lg border border-red-400/20 bg-red-400/10 p-5">
        <div className="mb-3 flex items-center gap-2 text-red-200">
          <FaLock />
          <h2 className="text-lg font-semibold">Admin panel locked</h2>
        </div>
        <p className="text-sm leading-6 text-red-100/80">{panel.$error}</p>
        <p className="mt-2 text-xs text-gray-400">Use <code className="text-red-100">admin-token</code> to mount this protected component.</p>
      </section>
    )
  }

  if (panel.$status === 'mounting' || panel.$loading) {
    return (
      <section className="rounded-lg border border-white/10 bg-[#07070b]/85 p-5">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="h-4 w-4 rounded-full border-2 border-theme border-t-transparent animate-spin" />
          Mounting protected component...
        </div>
      </section>
    )
  }

  const handleAddUser = async () => {
    if (!newUserName.trim()) return
    try {
      await panel.addUser({ name: newUserName.trim(), role: 'user' })
      setNewUserName('')
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await panel.deleteUser({ userId })
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#07070b]/85 p-5 shadow-2xl shadow-black/20">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="rounded-full border border-theme-active bg-theme-muted px-2.5 py-1 text-xs text-theme">
            Protected
          </span>
          <h2 className="mt-4 text-xl font-semibold text-white">Admin panel</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Requires <code className="text-theme">admin</code> role and action permissions.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-right text-xs text-gray-500">
          <div>User: <span className="text-emerald-200">{panel.$state.currentUser || '...'}</span></div>
          <div className="mt-1">Roles: <span className="text-amber-200">{panel.$state.currentRoles?.join(', ') || '...'}</span></div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {(panel.$state.users ?? []).map(user => (
          <div key={user.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <button
              onClick={() => handleDeleteUser(user.id)}
              className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-400/15"
              title="Requires users.delete permission"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newUserName}
          onChange={e => setNewUserName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUser()}
          placeholder="User name..."
          className="min-w-0 flex-1 input-theme"
        />
        <button
          onClick={handleAddUser}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-gray-200"
        >
          <FaUserPlus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {(panel.$state.audit?.length ?? 0) > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Audit log</h3>
            <button onClick={() => panel.clearAudit()} className="rounded bg-white/[0.04] px-2 py-1 text-xs text-gray-400">
              Clear
            </button>
          </div>
          <div className="max-h-32 space-y-1 overflow-auto">
            {(panel.$state.audit ?? []).map((entry, i) => (
              <div key={i} className="text-xs text-gray-500">
                <span className="text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                {' '}<span className="text-blue-300">{entry.action}</span>
                {' '}by <span className="text-emerald-300">{entry.performedBy}</span>
                {entry.target && <> on <span className="text-amber-300">{entry.target}</span></>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function AuthControls() {
  const { authenticated, authenticate, reconnect } = useLiveComponents()
  const [token, setToken] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLogin = async () => {
    if (!token.trim()) return
    setIsLoggingIn(true)
    await authenticate({ token: token.trim() })
    setIsLoggingIn(false)
  }

  const handleLogout = () => {
    setToken('')
    reconnect()
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#07070b]/85 p-5 shadow-2xl shadow-black/20">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-theme-active bg-theme-muted px-3 py-1 text-xs text-theme">
            <FaKey className="h-3 w-3" />
            WebSocket auth
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Authenticate the Live connection</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Pick a development token and remount protected components with the new auth context.</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs ${
          authenticated
            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
            : 'border-white/10 bg-white/[0.03] text-gray-400'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${authenticated ? 'bg-emerald-300' : 'bg-gray-500'}`} />
          {authenticated ? 'Authenticated' : 'Anonymous'}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="admin-token, user-token, mod-token"
          className="min-w-0 flex-1 input-theme"
        />
        <button onClick={handleLogin} disabled={isLoggingIn} className="h-11 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50">
          {isLoggingIn ? 'Authenticating...' : 'Login'}
        </button>
        {authenticated && (
          <button onClick={handleLogout} className="h-11 rounded-lg border border-red-400/20 bg-red-400/10 px-5 text-sm font-semibold text-red-200 transition hover:bg-red-400/15">
            Logout
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {['admin-token', 'user-token', 'mod-token'].map(value => (
          <button
            key={value}
            onClick={() => setToken(value)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/[0.06]"
          >
            {value}
          </button>
        ))}
      </div>
    </section>
  )
}

export function AuthDemo() {
  return (
    <div className="w-full max-w-5xl space-y-4">
      <AuthControls />

      <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <PublicCounter />
        <AdminPanel />
      </div>

      <section className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-4 text-xs text-gray-500 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <FaShieldHalved className="mb-3 text-theme" />
          <p className="font-semibold text-gray-300">Component guard</p>
          <code className="mt-2 block text-theme">static auth = {'{ required: true }'}</code>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <FaLock className="mb-3 text-theme" />
          <p className="font-semibold text-gray-300">Action guard</p>
          <code className="mt-2 block text-theme">permissions: ['users.delete']</code>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <FaKey className="mb-3 text-theme" />
          <p className="font-semibold text-gray-300">Client auth</p>
          <code className="mt-2 block text-theme">authenticate({'{ token }'})</code>
        </div>
      </section>
    </div>
  )
}
