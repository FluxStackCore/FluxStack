import { defineConfig } from 'vite'
import rsc from '@vitejs/plugin-rsc'

// Spike RSC isolado — prova @vitejs/plugin-rsc com React 19.
// 3 ambientes: rsc (server components), ssr (payload->HTML), client (browser).
export default defineConfig({
  plugins: [
    rsc({
      entries: {
        rsc: './src/framework/entry.rsc.tsx',
        ssr: './src/framework/entry.ssr.tsx',
        client: './src/framework/entry.browser.tsx',
      },
    }),
  ],
})
