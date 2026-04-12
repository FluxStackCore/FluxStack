/**
 * Standalone Bun dev server for the embed plugin.
 *
 * Runs as a separate process so that bunfig.toml [serve.static]
 * plugins (like react-dedupe) are loaded correctly.
 *
 * Usage: bun run plugins/embed/dev-server.ts
 */

import homepage from "../../app/client/index.html"

const port = Number(process.env.EMBED_DEV_PORT) || 5180

const server = Bun.serve({
  port,
  hostname: "localhost",

  routes: {
    "/*": homepage,
  },

  development: {
    hmr: true,
    console: true,
  },

  fetch(req) {
    return new Response("Not Found", { status: 404 })
  },
})

console.log(`Embed dev server running on http://localhost:${port}`)
