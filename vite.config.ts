import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { clientConfig } from './config/system/client.config'
import { fluxstackVitePlugins } from './core/build/vite-plugins'

// Root directory (vite.config.ts is in project root)
const rootDir = import.meta.dirname

// RSC (React Server Components) — modo PADRÃO do FluxStack. Adiciona os 3
// ambientes (rsc/ssr/client) ao Vite e o Elysia dirige o handler RSC
// (serverHandler:false = plugin não instala middleware próprio). Paths dos
// entries relativos ao `root` do Vite (app/client).
// Para SPA puro: RSC_ENABLED=false no ambiente.
const RSC_ENABLED = process.env.RSC_ENABLED !== 'false'

// When using bun-linked @fluxstack/live-* packages locally, point Vite at the
// TypeScript source instead of pre-built dist. This ensures a single React
// context (no dual-instance problem) and gives us HMR for the library code.
// In CI or when the sibling repo doesn't exist, resolve from node_modules.
const liveMonorepoRoot = resolve(rootDir, '../fluxstack-live/packages')
const hasLocalLiveMonorepo = existsSync(resolve(liveMonorepoRoot, 'core/src/index.ts'))

const liveAliases: Record<string, string> = hasLocalLiveMonorepo
  ? {
      '@fluxstack/live-react': resolve(liveMonorepoRoot, 'react/src/index.ts'),
      '@fluxstack/live-client': resolve(liveMonorepoRoot, 'client/src/index.ts'),
      '@fluxstack/live': resolve(liveMonorepoRoot, 'core/src/index.ts'),
    }
  : {}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // FluxStack internal plugins (live-strip, tsconfig-paths, type-checker)
    ...fluxstackVitePlugins(),
    // RSC plugin ANTES do react() — quando ligado, ele gerencia os ambientes.
    // Entries com caminho ABSOLUTO: no dev relativo ao root funciona, mas no
    // `vite build` o rollup resolve relativo ao cwd e não acha — absoluto cobre os dois.
    ...(RSC_ENABLED
      ? [
          (await import('@vitejs/plugin-rsc')).default({
            serverHandler: false,
            entries: {
              rsc: resolve(rootDir, 'app/client/src/framework/entry.rsc.tsx'),
              ssr: resolve(rootDir, 'app/client/src/framework/entry.ssr.tsx'),
              client: resolve(rootDir, 'app/client/src/framework/entry.browser.tsx'),
            },
          }),
        ]
      : []),
    react(),
    tailwindcss(),
  ],

  root: resolve(rootDir, 'app/client'),

  // Aliases são lidos do tsconfig.json pelo plugin vite-tsconfig-paths

  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: liveAliases,
  },

  // Exclude linked packages from dep optimization when aliased to source
  optimizeDeps: {
    exclude: hasLocalLiveMonorepo
      ? ['@fluxstack/live', '@fluxstack/live-client', '@fluxstack/live-react']
      : [],
  },

  server: {
    port: clientConfig.vite.port,                    // ✅ From config
    host: clientConfig.vite.host,                    // ✅ From config
    strictPort: clientConfig.vite.strictPort,        // ✅ From config
    open: clientConfig.vite.open,                    // ✅ From config
    allowedHosts: clientConfig.vite.allowedHosts,    // ✅ From config (VITE_ALLOWED_HOSTS)

    // Allow Vite to serve files outside the client root (needed for monorepo aliases)
    fs: {
      allow: [
        rootDir,
        ...(hasLocalLiveMonorepo ? [liveMonorepoRoot] : []),
      ],
    },

    hmr: {
      protocol: 'ws',
      host: clientConfig.vite.host,
      port: clientConfig.vite.port,
      clientPort: clientConfig.vite.port
    },

    proxy: {
      '/api/': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // WebSocket goes directly to port 3000 (configured in App.tsx)
        // to avoid Vite proxy overhead and HMR contention
      },
      '/swagger': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
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
