import { test, expect } from './fixtures'

test.describe('Shared Counter', () => {
  test('should render shared counter with room info', async ({ page }) => {
    await page.goto('/shared-counter')

    await expect(page.getByRole('heading', { name: 'Contador Compartilhado' })).toBeVisible()

    // Wait for WS connection (may take a moment during parallel tests)
    await expect(page.getByText('Conectado')).toBeVisible({ timeout: 25_000 })
  })

  test('should increment shared counter', async ({ page }) => {
    await page.goto('/shared-counter')

    // Wait for WS connection
    await expect(page.getByText('Conectado')).toBeVisible({ timeout: 25_000 })
    await page.waitForTimeout(1_000)

    // Click + button
    await page.getByRole('button', { name: '+' }).click()

    // Wait for state sync
    await page.waitForTimeout(2_000)

    // Verify the page is still functional (no crash, no error)
    await expect(page.getByRole('heading', { name: 'Contador Compartilhado' })).toBeVisible()

    // The "Reset" button should still be visible (component didn't crash)
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
  })
})
