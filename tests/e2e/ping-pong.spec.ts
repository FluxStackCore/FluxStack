import { test, expect } from './fixtures'

test.describe('Ping Pong', () => {
  test('should render ping pong interface', async ({ page }) => {
    await page.goto('/ping-pong')

    await expect(page.getByRole('heading', { name: 'Latency probe' })).toBeVisible({ timeout: 25_000 })

    // Botão de ping + métricas (redesign)
    await expect(page.getByRole('button', { name: 'Ping' })).toBeVisible()
    await expect(page.getByText('Online')).toBeVisible()
    await expect(page.getByText('Total pings')).toBeVisible()
  })

  test('should show connection status', async ({ page }) => {
    await page.goto('/ping-pong')

    // Espera o WS conectar (badge Connected)
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 25_000 })
  })
})
