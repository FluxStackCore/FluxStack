/**
 * Client Bootstrap — Selective Hydration
 *
 * Finds all [data-client] markers in the DOM and hydrates/renders
 * each client component by dynamically importing its chunk.
 *
 * Wraps components with necessary providers (LiveComponentsProvider,
 * BrowserRouter) so they have access to context.
 */

import { createRoot, hydrateRoot } from "react-dom/client"
import { createElement, StrictMode } from "react"
import { BrowserRouter } from "react-router"
import { LiveComponentsProvider } from "@fluxstack/live-react"

interface ManifestEntry {
  source: string
  chunkUrl: string
}

type ClientManifest = Record<string, ManifestEntry>

// WebSocket URL for LiveComponents
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
const wsUrl = `${wsProtocol}//${window.location.host}/api/live/ws`

async function bootstrap() {
  const manifest: ClientManifest = (window as any).__CLIENT_MANIFEST__ || {}
  const markers = document.querySelectorAll<HTMLElement>("[data-client]")

  if (markers.length === 0) {
    console.debug("[BunNext] No client components found")
    return
  }

  console.debug(`[BunNext] Found ${markers.length} client component(s) to hydrate`)

  for (const marker of markers) {
    const componentId = marker.getAttribute("data-client")
    const mode = marker.getAttribute("data-client-mode") || "client-only"
    const propsJson = marker.getAttribute("data-client-props") || "{}"

    if (!componentId) continue

    const entry = manifest[componentId]
    if (!entry || !entry.chunkUrl) {
      console.warn(`[BunNext] No chunk for "${componentId}"`)
      continue
    }

    try {
      const mod = await import(/* @vite-ignore */ entry.chunkUrl)
      const Component = mod.default || mod[componentId.split("/").pop()!]

      if (!Component) {
        console.warn(`[BunNext] No default export in "${componentId}"`)
        continue
      }

      const props = JSON.parse(propsJson)

      // Build element with necessary providers
      let element = createElement(Component, props)

      // Wrap with LiveComponentsProvider (needed for Live.use() components)
      element = createElement(LiveComponentsProvider, { url: wsUrl }, element)

      // Wrap with BrowserRouter (needed for useLocation, Link, etc.)
      element = createElement(BrowserRouter, null, element)

      // Wrap with StrictMode
      element = createElement(StrictMode, null, element)

      if (mode === "hydrate") {
        hydrateRoot(marker, element)
        console.debug(`[BunNext] Hydrated "${componentId}"`)
      } else {
        const root = createRoot(marker)
        root.render(element)
        console.debug(`[BunNext] Rendered "${componentId}" (client-only)`)
      }
    } catch (err) {
      console.error(`[BunNext] Failed to load "${componentId}":`, err)
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap)
} else {
  bootstrap()
}
