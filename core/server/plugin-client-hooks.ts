/**
 * Plugin Client Hook Registry
 *
 * Singleton registry where server-side plugins register JavaScript code
 * to be executed on the client. The client fetches these hooks via
 * GET /api/__plugins/client-hooks and executes them at the right moment
 * (e.g., when Eden Treaty initializes, when LiveComponents WebSocket connects).
 *
 * Plugins call `pluginClientHooks.register(hookName, jsCode)` during their
 * setup phase to inject client-side behavior.
 *
 * Built-in hook points:
 * - 'onEdenInit'    — runs after the Eden Treaty client is created
 * - 'onLiveConnect'  — runs when the LiveComponents WebSocket connects
 */

class PluginClientHookRegistry {
  private hooks = new Map<string, string[]>()
  private _cachedSignature: string | null = null

  /**
   * Register a JavaScript code string to be executed on the client
   * for the given hook name.
   *
   * @param hookName - The hook point name (e.g., 'onEdenInit', 'onLiveConnect')
   * @param jsCode - JavaScript code string to execute on the client
   */
  register(hookName: string, jsCode: string): void {
    const existing = this.hooks.get(hookName)
    if (existing) {
      existing.push(jsCode)
    } else {
      this.hooks.set(hookName, [jsCode])
    }
    this._cachedSignature = null // invalidate on change
  }

  /**
   * Get all registered hooks as a plain object.
   * Used by the HTTP endpoint to serialize the response.
   */
  getHooks(): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const [name, codes] of this.hooks) {
      result[name] = [...codes]
    }
    return result
  }

  /**
   * Get code strings for a specific hook name.
   */
  getHook(name: string): string[] {
    return this.hooks.get(name) ? [...this.hooks.get(name)!] : []
  }

  /**
   * Get HMAC-SHA256 signature of the hooks payload.
   * Uses a per-process secret (random on startup) so the signature
   * is only valid for this server instance.
   *
   * The client receives this signature via WebSocket (CONNECTION_ESTABLISHED)
   * and verifies it against the HTTP response to prevent injection.
   */
  getSignature(): string {
    if (this._cachedSignature) return this._cachedSignature
    const { createHmac, randomBytes } = require('crypto')
    if (!this._secret) this._secret = randomBytes(32)
    const payload = JSON.stringify(this.getHooks())
    this._cachedSignature = createHmac('sha256', this._secret).update(payload).digest('hex') as string
    return this._cachedSignature!
  }

  /** @internal Per-process secret for HMAC signing */
  private _secret: Buffer | null = null

  /**
   * Get hooks + signature for the HTTP response.
   */
  getSignedResponse(): { hooks: Record<string, string[]>; signature: string } {
    return {
      hooks: this.getHooks(),
      signature: this.getSignature(),
    }
  }

  /**
   * Clear all registered hooks. Useful for testing.
   */
  clear(): void {
    this.hooks.clear()
    this._cachedSignature = null
  }
}

export const pluginClientHooks = new PluginClientHookRegistry()
export type { PluginClientHookRegistry }
