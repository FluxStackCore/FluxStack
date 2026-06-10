// Plugin hooks integrity via SSR (SRI-style) — server side.
//
// The plugin client-hooks endpoint returns JS code that the client runs via
// `new Function`. To stop a tampered HTTP response from injecting code, the SSR
// render embeds a hash of the LEGITIMATE hooks in <meta name="plugin-hooks-hash">.
// The client recomputes the hash of what it fetched and refuses to execute if it
// doesn't match — the trusted channel (server-rendered HTML) vouches for the code,
// exactly like Subresource Integrity. Same idea as the CSRF-token-via-SSR pattern.
//
// The hash is computed over the SAME canonical JSON the client hashes
// (`JSON.stringify(hooks)`), so server and client agree byte-for-byte.

import { createHash } from 'crypto'

export const PLUGIN_HOOKS_HASH_META = 'plugin-hooks-hash'

/** sha256 (hex, prefixed) of the canonical hooks payload. */
export function hashPluginHooks(hooks: Record<string, string[]>): string {
  const canonical = JSON.stringify(hooks)
  return 'sha256-' + createHash('sha256').update(canonical).digest('hex')
}
