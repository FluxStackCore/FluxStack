/**
 * ClientBoundary — marks where client components should be hydrated.
 *
 * On the server: renders a <div> with data attributes that the
 * client bootstrap uses to find and hydrate/render client components.
 *
 * Modes:
 * - "hydrate": server renders the real component, client calls hydrateRoot()
 * - "client-only": server renders a fallback/skeleton, client calls createRoot()
 */

import React from "react"

export interface ClientBoundaryProps {
  /** Component identifier (path relative to project root, without extension) */
  component: string
  /** Serializable props to pass to the client component */
  props?: Record<string, unknown>
  /** Hydration mode */
  mode?: "hydrate" | "client-only"
  /** Fallback content shown during SSR for client-only components */
  fallback?: React.ReactNode
  /** Children — used in "hydrate" mode (server-rendered component) */
  children?: React.ReactNode
}

export function ClientBoundary({
  component,
  props = {},
  mode = "client-only",
  fallback,
  children,
}: ClientBoundaryProps) {
  const serializedProps = JSON.stringify(props)

  return React.createElement("div", {
    "data-client": component,
    "data-client-props": serializedProps,
    "data-client-mode": mode,
    style: { display: "contents" }, // No visual impact on layout
  },
    mode === "hydrate" ? children : (fallback || React.createElement(DefaultSkeleton, null))
  )
}

/** Default loading skeleton for client-only components */
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

/**
 * ServerOnly — renders children only on the server.
 * On the client, renders nothing (children are not included in the bundle).
 */
export function ServerOnly({ children }: { children: React.ReactNode }) {
  // This always renders on the server during SSR.
  // The client bootstrap does NOT hydrate this — it stays as static HTML.
  return React.createElement("div", { "data-server-only": "true" }, children)
}
