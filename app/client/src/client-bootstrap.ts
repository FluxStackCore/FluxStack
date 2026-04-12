/**
 * Client Bootstrap — Selective Hydration
 *
 * Finds all [data-client] markers in the DOM and hydrates/renders
 * each client component by dynamically importing its chunk.
 *
 * This runs in the BROWSER after the SSR HTML is loaded.
 */

import { createRoot, hydrateRoot } from "react-dom/client"
import { createElement, StrictMode } from "react"
import { BrowserRouter } from "react-router"

interface ManifestEntry {
  source: string
  chunkUrl: string
}

type ClientManifest = Record<string, ManifestEntry>

async function bootstrap() {
  // Read the manifest injected by the SSR renderer
  const manifest: ClientManifest = (window as any).__CLIENT_MANIFEST__ || {}

  // Find all client component markers
  const markers = document.querySelectorAll<HTMLElement>("[data-client]")

  if (markers.length === 0) {
    console.debug("[BunNext] No client components found, skipping hydration")
    return
  }

  console.debug(`[BunNext] Found ${markers.length} client component(s) to hydrate`)

  for (const marker of markers) {
    const componentId = marker.getAttribute("data-client")
    const mode = marker.getAttribute("data-client-mode") || "client-only"
    const propsJson = marker.getAttribute("data-client-props") || "{}"

    if (!componentId) continue

    const entry = manifest[componentId]
    if (!entry) {
      console.warn(`[BunNext] No manifest entry for "${componentId}"`)
      continue
    }

    try {
      // Dynamic import the client component chunk
      const mod = await import(/* @vite-ignore */ entry.chunkUrl)
      const Component = mod.default || mod[componentId.split("/").pop()!]

      if (!Component) {
        console.warn(`[BunNext] No default export in "${componentId}"`)
        continue
      }

      const props = JSON.parse(propsJson)

      // Build the element — wrap with router if it's the root App
      let element = createElement(Component, props)

      // If the component is the App (root), wrap with BrowserRouter
      if (componentId.includes("App")) {
        element = createElement(StrictMode, null,
          createElement(BrowserRouter, null, element)
        )
      }

      if (mode === "hydrate") {
        hydrateRoot(marker, element)
        console.debug(`[BunNext] Hydrated "${componentId}"`)
      } else {
        // client-only: replace server skeleton with real component
        const root = createRoot(marker)
        root.render(element)
        console.debug(`[BunNext] Rendered "${componentId}" (client-only)`)
      }
    } catch (err) {
      console.error(`[BunNext] Failed to load "${componentId}":`, err)
    }
  }
}

// Run bootstrap when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap)
} else {
  bootstrap()
}
