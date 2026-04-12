/**
 * Bun bundler plugin that forces all React imports to resolve
 * to the FluxStack project's node_modules, preventing duplicate
 * React instances from monorepo linked packages.
 */

import { resolve } from "path"
import type { BunPlugin } from "bun"

// Resolve to project root (5 levels up from core/plugins/built-in/renderers/ssr/)
const projectRoot = resolve(import.meta.dirname, "../../../../..")
const reactPath = resolve(projectRoot, "node_modules/react")
const reactDomPath = resolve(projectRoot, "node_modules/react-dom")

const reactDedupePlugin: BunPlugin = {
  name: "react-dedupe",
  setup(build) {
    // Redirect all 'react' imports to the project's copy
    build.onResolve({ filter: /^react$/ }, () => ({
      path: resolve(reactPath, "index.js"),
    }))

    build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
      path: resolve(reactPath, "jsx-runtime.js"),
    }))

    build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
      path: resolve(reactPath, "jsx-dev-runtime.js"),
    }))

    build.onResolve({ filter: /^react-dom$/ }, () => ({
      path: resolve(reactDomPath, "index.js"),
    }))

    build.onResolve({ filter: /^react-dom\/client$/ }, () => ({
      path: resolve(reactDomPath, "client.js"),
    }))

    build.onResolve({ filter: /^react-dom\/server$/ }, () => ({
      path: resolve(reactDomPath, "server.browser.js"),
    }))
  },
}

export default reactDedupePlugin
