import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import checker from 'vite-plugin-checker'
import { resolve } from 'path'
import { clientConfig } from './config/system/client.config'

// Root directory (vite.config.ts is in project root)
const rootDir = import.meta.dirname

// Skip type checking in production builds (CI already does this separately)
const isProduction = process.env.NODE_ENV === 'production'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths({
      projects: [resolve(rootDir, 'tsconfig.json')]
    }),
    // Only run type checker in development (saves ~5+ minutes in Docker builds)
    !isProduction && checker({
      typescript: true,
      overlay: true
    })
  ].filter(Boolean),

  root: resolve(rootDir, 'app/client'),

  // Aliases são lidos do tsconfig.json pelo plugin vite-tsconfig-paths

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
