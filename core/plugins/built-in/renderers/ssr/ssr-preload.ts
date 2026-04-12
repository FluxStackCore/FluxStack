/**
 * SSR Preload — Registers a Bun module loader that resolves
 * asset imports (.svg, .png, etc.) to public URLs instead of
 * filesystem paths during server-side rendering.
 */

import { plugin } from "bun"

plugin({
  name: "ssr-asset-resolver",
  setup(build) {
    // Resolve .svg imports to /_assets/ URLs
    build.onLoad({ filter: /\.svg$/ }, (args) => {
      const fileName = args.path.replace(/\\/g, "/").split("/").pop()!
      return {
        contents: `export default "/_assets/${fileName}";`,
        loader: "js",
      }
    })

    // Resolve .png/.jpg/.gif/.webp imports to /_assets/ URLs
    build.onLoad({ filter: /\.(png|jpg|jpeg|gif|webp|ico)$/ }, (args) => {
      const fileName = args.path.replace(/\\/g, "/").split("/").pop()!
      return {
        contents: `export default "/_assets/${fileName}";`,
        loader: "js",
      }
    })
  },
})
