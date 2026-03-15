import { test, expect } from './fixtures'

test.describe('Ping Pong', () => {
  test('should render ping pong interface', async ({ page }) => {
    await page.goto('/ping-pong')

    await expect(page.getByRole('heading', { name: 'Ping Pong Binary' })).toBeVisible()

    // Ping button
    await expect(page.getByRole('button', { name: 'Ping!' })).toBeVisible()

    // Stats cards
    await expect(page.getByText('AVG RTT')).toBeVisible()
    await expect(page.getByText('MIN RTT')).toBeVisible()
    await expect(page.getByText('MAX RTT')).toBeVisible()
  })

  test('should show connection status', async ({ page }) => {
    await page.goto('/ping-pong')

    // Wait for WS connection
    await expect(page.getByText('Conectado')).toBeVisible({ timeout: 10_000 })

    // Online count visible
    await expect(page.getByText(/\d+ online/)).toBeVisible()
  })
})
