/**
 * ClientBoundary — SSR-aware component boundary
 *
 * On the SERVER (SSR): renders fallback HTML with data-client marker
 * On the CLIENT (after hydration): lazy-loads the component chunk,
 * wraps it with LiveComponentsProvider, and renders it
 *
 * This handles both initial page load AND SPA navigation:
 * - Page load: SSR sends skeleton, ClientBoundary mounts chunk after hydration
 * - SPA nav: React renders ClientBoundary, which mounts chunk on mount
 */

import React, { useState, useEffect } from "react"

const isServer = typeof window === "undefined"

export interface ClientBoundaryProps {
  component: string
  props?: Record<string, unknown>
  mode?: "hydrate" | "client-only"
  fallback?: React.ReactNode
  children?: React.ReactNode
}

export function ClientBoundary({
  component,
  props = {},
  mode = "client-only",
  fallback,
  children,
}: ClientBoundaryProps) {
  const [ClientComponent, setClientComponent] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only runs on the client — load the component chunk
    const manifest = (window as any).__CLIENT_MANIFEST__ || {}
    const entry = manifest[component]

    // Determine the import URL:
    // - SSR mode: use chunk URL from manifest (pre-built, code-split)
    // - Vite mode: import source file directly (Vite bundles on the fly)
    const importUrl = entry?.chunkUrl || `/${component.replace(/^app\/client\//, "")}.tsx`

    let cancelled = false

    import(/* @vite-ignore */ importUrl)
      .then(async (mod) => {
        if (cancelled) return
        const name = component.split("/").pop()!
        const Comp = mod.default || mod[name]
        if (Comp) {
          setClientComponent(() => Comp)
        } else {
          setError(`No export in "${component}"`)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(`Failed: ${err.message}`)
      })

    return () => { cancelled = true }
  }, [component])

  // Server-side: render marker div with fallback
  if (isServer) {
    return React.createElement("div", {
      "data-client": component,
      "data-client-props": JSON.stringify(props),
      "data-client-mode": mode,
      style: { display: "contents" },
    }, fallback || React.createElement(DefaultSkeleton, null))
  }

  // Client-side: component loaded — providers come from App tree above
  if (ClientComponent) {
    return React.createElement(ClientComponent, props as any)
  }

  // Client-side: loading or error
  if (error) {
    return React.createElement("div", {
      style: { color: "#ef4444", padding: "1rem", textAlign: "center" as const }
    }, error)
  }

  // Client-side: still loading
  return React.createElement(React.Fragment, null, fallback || React.createElement(DefaultSkeleton, null))
}

function DefaultSkeleton() {
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "200px",
      color: "#64748b",
      fontSize: "14px",
    }
  }, "Loading...")
}

/** Cache the WebSocket URL */
let cachedWsUrl: string | null = null
function getWsUrl() {
  if (cachedWsUrl) return cachedWsUrl
  if (typeof window === "undefined") return ""
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  cachedWsUrl = `${proto}//${window.location.host}/api/live/ws`
  return cachedWsUrl
}

/**
 * Wraps the client component with LiveComponentsProvider.
 * Lazy-loaded to avoid importing @fluxstack/live-react on the server.
 */
function ClientWrapper({ url, children }: { url: string; children: React.ReactNode }) {
  const [Provider, setProvider] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    import("@fluxstack/live-react").then((mod) => {
      setProvider(() => mod.LiveComponentsProvider)
    })
  }, [])

  // Don't render children until Provider is loaded — they need LiveComponentsProvider
  if (!Provider) {
    return React.createElement("div", {
      style: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100px", color: "#64748b" }
    }, "Connecting...")
  }

  return React.createElement(Provider, { url }, children)
}

/**
 * ServerOnly — renders children only on the server.
 */
export function ServerOnly({ children }: { children: React.ReactNode }) {
  if (isServer) return React.createElement(React.Fragment, null, children)
  return null
}
