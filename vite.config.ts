import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import checker from 'vite-plugin-checker'
import { resolve } from 'path'
import { clientConfig } from './config/system/client.config'

// Root directory (vite.config.ts is in project root)
const rootDir = import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths({
      projects: [resolve(rootDir, 'tsconfig.json')]
    }),
    checker({
      typescript: true,
      overlay: true
    })
  ],

  // ℹ️ nodePolyfills removed: Not needed - client code doesn't use Node.js APIs
  // ℹ️ define.global removed: Not needed - modern browsers support globalThis natively
  // ℹ️ define.process.env.NODE_ENV removed: Vite handles this automatically

  root: resolve(rootDir, 'app/client'),

  server: {
    port: clientConfig.vite.port,                    // ✅ From config
    host: clientConfig.vite.host,                    // ✅ From config
    strictPort: clientConfig.vite.strictPort,        // ✅ From config
    open: clientConfig.vite.open,                    // ✅ From config

    hmr: {
      protocol: 'ws',
      host: clientConfig.vite.host,
      port: clientConfig.vite.port,
      clientPort: clientConfig.vite.port
    }

    // ℹ️ No proxy needed: All requests go through Elysia (localhost:3000)
    // Elysia's Vite plugin handles routing:
    //   - /api, /swagger → Elysia handlers (viteExcludePaths)
    //   - Everything else → Proxy to Vite dev server
  },

  build: {
    target: clientConfig.build.target,               // ✅ From config
    outDir: resolve(rootDir, clientConfig.build.outDir ?? 'dist/client'), // ✅ From config
    sourcemap: clientConfig.build.sourceMaps,        // ✅ From config
    minify: clientConfig.build.minify,               // ✅ From config
    assetsDir: clientConfig.build.assetsDir,         // ✅ From config
    cssCodeSplit: clientConfig.build.cssCodeSplit,   // ✅ From config
    chunkSizeWarningLimit: clientConfig.build.chunkSizeWarningLimit, // ✅ From config
    emptyOutDir: clientConfig.build.emptyOutDir      // ✅ From config
  }
})
