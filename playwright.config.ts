import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,

  use: {
    // Entrar pela 3000 (Elysia) — o app de verdade: API + WebSocket + frontend
    // (via proxy Vite). A 5173 é o Vite dev cru (sem WebSocket Live), detalhe
    // interno. Pela 3000 tudo é mesma origem, então o WS conecta sozinho.
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'bun run dev',
    // Espera a 3000 (Elysia) ficar pronta — é por onde os testes entram.
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
