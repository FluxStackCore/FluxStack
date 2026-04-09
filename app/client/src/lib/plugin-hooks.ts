/**
 * Plugin Client Hooks
 *
 * Fetches JavaScript hooks registered by server-side plugins
 * and executes them at specific hook points in the client lifecycle.
 *
 * Hooks are cached after the first fetch (one HTTP request per page load).
 * Errors in individual hooks are caught and logged without crashing the app.
 */

let cachedHooks: Record<string, string[]> | null = null
let loadPromise: Promise<Record<string, string[]>> | null = null

/**
 * Fetch plugin hooks from the server. Results are cached so only
 * one HTTP request is made per page load.
 *
 * The server signs the response with HMAC-SHA256 to ensure integrity.
 * The signature is included for auditability — the client trusts the
 * server via same-origin HTTPS.
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
      cachedHooks = data.hooks ?? {}
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
