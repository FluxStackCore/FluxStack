/**
 * Plugin Client Hooks
 *
 * Fetches JavaScript hooks registered by server-side plugins
 * and executes them at specific hook points in the client lifecycle.
 *
 * Hooks are cached after the first fetch (one HTTP request per page load).
 * Errors in individual hooks are caught and logged without crashing the app.
 */

/**
 * Allowlist of hook points the client is willing to execute.
 *
 * The hook code is injected by server-side plugins and runs via `new Function`,
 * so it is effectively trusted code from the same origin. As defense-in-depth we
 * (1) only accept hook names from this allowlist and (2) only accept string code
 * entries — anything else is dropped before it can reach `new Function`. This
 * blocks injection of arbitrary hook names / malformed payloads even if the
 * endpoint response is tampered with.
 */
export const ALLOWED_HOOKS = new Set(['onEdenInit', 'onLiveConnect'])

let cachedHooks: Record<string, string[]> | null = null
let loadPromise: Promise<Record<string, string[]>> | null = null

/** Keep only allowlisted hook names whose entries are all strings. */
export function sanitizeHooks(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [name, codes] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_HOOKS.has(name)) {
      console.warn(`[plugin-hooks] Ignoring unknown hook "${name}"`)
      continue
    }
    if (!Array.isArray(codes)) continue
    const strings = codes.filter((c): c is string => typeof c === 'string')
    if (strings.length !== codes.length) {
      console.warn(`[plugin-hooks] Dropped non-string code in hook "${name}"`)
    }
    if (strings.length) out[name] = strings
  }
  return out
}

/** Reads the SSR-embedded integrity hash, if present (SRI-style). */
function getTrustedHooksHash(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.querySelector('meta[name="plugin-hooks-hash"]')
  return m?.getAttribute('content') || null
}

/** sha256(canonicalJson) in the same `sha256-<hex>` format the server emits. */
export async function computeHooksHash(canonicalJson: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  return 'sha256-' + hex
}

/**
 * Fetch plugin hooks from the server. Results are cached so only one HTTP
 * request is made per page load.
 *
 * Integrity (SRI-style): when the SSR HTML embeds <meta name="plugin-hooks-hash">
 * (the trusted channel), the fetched payload's hash MUST match it, otherwise the
 * hooks are rejected (a tampered HTTP response can't forge the SSR-embedded hash).
 * If no hash is present (e.g. pure SPA without SSR), we fall back to the allowlist
 * sanitization only.
 */
export async function loadPluginHooks(): Promise<Record<string, string[]>> {
  if (cachedHooks) return cachedHooks

  // Deduplicate concurrent calls during initial load
  if (loadPromise) return loadPromise

  loadPromise = (async (): Promise<Record<string, string[]>> => {
    try {
      const res = await fetch('/api/__plugins/client-hooks')
      if (!res.ok) {
        console.warn(`[plugin-hooks] Failed to load hooks: HTTP ${res.status}`)
        cachedHooks = {}
        return cachedHooks
      }
      const data = await res.json()

      // Integrity check against the SSR-trusted hash, if present.
      const trustedHash = getTrustedHooksHash()
      if (trustedHash) {
        const actualHash = await computeHooksHash(JSON.stringify(data.hooks ?? {}))
        if (actualHash !== trustedHash) {
          console.error(
            '[plugin-hooks] Integrity check FAILED — fetched hooks do not match the ' +
            'SSR-embedded hash. Refusing to execute (possible tampering).',
          )
          cachedHooks = {}
          return cachedHooks
        }
      }

      cachedHooks = sanitizeHooks(data.hooks)
      return cachedHooks!
    } catch (e) {
      console.warn('[plugin-hooks] Failed to fetch hooks:', e)
      cachedHooks = {}
      return cachedHooks!
    }
  })()

  return loadPromise
}

/**
 * Execute all code strings registered for a given hook name.
 *
 * Each code string is wrapped in a `new Function(...)` call with the
 * provided context keys as parameter names, so the code can reference
 * them directly (e.g., `eden`, `connection`).
 *
 * Errors in individual hooks are caught and logged — they never crash
 * the calling code.
 *
 * @param hookName - The hook point to execute (e.g., 'onEdenInit', 'onLiveConnect')
 * @param context - Key/value pairs available as local variables inside the hook code
 */
export async function executeHook(
  hookName: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!ALLOWED_HOOKS.has(hookName)) {
    console.warn(`[plugin-hooks] Refusing to execute unknown hook "${hookName}"`)
    return
  }

  const hooks = await loadPluginHooks()
  const codes = hooks[hookName] || []

  if (codes.length === 0) return

  const keys = Object.keys(context || {})
  const values = Object.values(context || {})

  for (const code of codes) {
    try {
      const fn = new Function(...keys, code)
      fn(...values)
    } catch (e) {
      console.warn(`[plugin-hooks] Error executing "${hookName}" hook:`, e)
    }
  }
}
