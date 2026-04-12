/**
 * Client Bootstrap — Hydration
 *
 * hydrateRoot on #root — attaches event handlers to server-rendered HTML.
 * Server components stay as-is (zero flash).
 * ClientBoundary components self-mount their chunks after hydration.
 */

import { createRoot, hydrateRoot } from "react-dom/client"
import { createElement, StrictMode } from "react"
import { BrowserRouter } from "react-router"
import App from "./App"
import "./index.css"

function bootstrap() {
  const root = document.getElementById("root")
  if (!root) return

  // hydrateRoot keeps existing server-rendered DOM and attaches React handlers
  try {
    hydrateRoot(
      root,
      createElement(StrictMode, null,
        createElement(BrowserRouter, null,
          createElement(App)
        )
      )
    )
    console.debug("[BunNext] Hydrated (zero flash)")
  } catch (err) {
    // Fallback: if hydration fails, do full client render
    console.error("[BunNext] Hydration failed, falling back to createRoot:", err)
    const fallback = createRoot(root)
    fallback.render(
      createElement(StrictMode, null,
        createElement(BrowserRouter, null,
          createElement(App)
        )
      )
    )
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap)
} else {
  bootstrap()
}
